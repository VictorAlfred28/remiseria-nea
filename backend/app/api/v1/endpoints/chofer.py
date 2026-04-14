from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Form, File, UploadFile
from typing import Dict, Any, List
from app.core.security import get_current_chofer
from app.db.supabase import supabase
from app.schemas.domain import Viaje, Promocion
from app.core.evolution import send_whatsapp_message
from app.core.config import settings
import datetime

router = APIRouter()

@router.get("/viajes/asignados", response_model=List[Viaje])
def list_viajes(claims: Dict[str, Any] = Depends(get_current_chofer)):
    """
    Obtener viajes asignados al chofer autenticado.
    """
    chofer_user_id = claims.get("sub")
    # Para más optimización, se buscaría en la DB el profile del chofer.
    # Dado que los roles están vinculados, usaremos el usuario_id del chofer.
    
    response = supabase.table("choferes").select("id").eq("usuario_id", chofer_user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Perfíl de chofer no encontrado.")
    
    chofer_pk = response.data[0]["id"]
    
    viajes_resp = supabase.table("viajes").select("*").eq("chofer_id", chofer_pk).execute()
    return viajes_resp.data

@router.get("/promociones/recompensas", response_model=List[Promocion])
def list_promociones(claims: Dict[str, Any] = Depends(get_current_chofer)):
    """
    Muestra la pestaña de promociones y beneficios asociados a la remisería del chofer actual.
    """
    org_id = claims.get("organizacion_id")
    promos_resp = supabase.table("promociones").select("*").eq("organizacion_id", org_id).execute()
    return promos_resp.data

@router.post("/ubicacion/actualizar")
def update_ubicacion(lat: float, lng: float, claims: Dict[str, Any] = Depends(get_current_chofer)):
    chofer_user_id = claims.get("sub")
    
    # Eliminar Select redundante (Cuello de Botella "N+1"). Hacemos Update Directo atómico.
    u_resp = supabase.table("choferes").update({"lat": lat, "lng": lng}).eq("usuario_id", chofer_user_id).execute()
    
    if not u_resp.data:
        raise HTTPException(status_code=404, detail="Chofer no hallado.")
        
    return {"message": "Ubicación actualizada."}

@router.post("/viajes/{viaje_id}/notificar-aceptacion")
def notificar_aceptacion(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    chofer_user_id = claims.get("sub")
    
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    origen_data = viaje.get("origen", {})
    pasajero_phone = origen_data.get("cliente_telefono")
    ai_instance = origen_data.get("ai_instance", "viajesnea") 
    origen_dir = origen_data.get("direccion", "tu ubicación")
    
    if not pasajero_phone:
         return {"message": "Sin telefono de contacto", "sent": False}
    
    # Colapsamos 2 consultas ineficientes (N+1) en 1 sola con join relacional (usuarios + choferes)
    chf_resp = supabase.table("choferes").select("vehiculo, patente, usuarios(nombre)").eq("usuario_id", chofer_user_id).execute()
    chofer_nombre = "Tu Chofer"
    auto_info = ""
    if chf_resp.data:
        chf_data = chf_resp.data[0]
        chofer_nombre = chf_data.get("usuarios", {}).get("nombre", "Tu Chofer") if chf_data.get("usuarios") else "Tu Chofer"
        vehiculo = chf_data.get("vehiculo", "Auto")
        patente = chf_data.get("patente", "N/A")
        auto_info = f"en un *{vehiculo}* (Patente: *{patente}*)"

    mensaje = f"✅ ¡Tu viaje en {origen_dir} fue aceptado!\n\nTu chofer asignado es *{chofer_nombre}* {auto_info}. Llegará en breve.\n\n📍 *Sigue tu viaje en vivo aquí:*\n{settings.FRONTEND_URL}/track/{viaje_id}\n\n👉 Aguarda relajado en el punto de encuentro."
    
    # 3. Actualizar estado y timestamp
    supabase.table("viajes").update({
        "estado": "ACCEPTED",
        "accepted_at": datetime.datetime.now().isoformat(),
        "fecha_aceptacion": datetime.datetime.now().isoformat()
    }).eq("id", viaje_id).execute()

    # 4. Disparar WhatsApp en segundo plano
    background_tasks.add_task(send_whatsapp_message, ai_instance, pasajero_phone, mensaje)
    
    return {"message": "Viaje aceptado y notificado", "sent": True}

@router.post("/viajes/{viaje_id}/iniciar")
def iniciar_viaje(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    """
    Marca el inicio real del viaje (pasajero a bordo).
    Corta el tiempo de espera.
    """
    # 1. Actualizar estado y timestamp
    supabase.table("viajes").update({
        "estado": "STARTED",
        "started_at": datetime.datetime.now().isoformat(),
        "fecha_inicio_viaje": datetime.datetime.now().isoformat()
    }).eq("id", viaje_id).execute()
    
    return {"message": "Viaje iniciado (STARTED).", "status": "ok"}

from app.core.evolution import send_whatsapp_list_message

from app.core.pricing import calculate_fare

@router.post("/viajes/{viaje_id}/finalizar")
def finalizar_viaje(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    """
    Finaliza el viaje, calcula precio final (espera + extras) y envía ticket.
    """
    chofer_user_id = claims.get("sub")
    
    # 1. Obtener datos del viaje completo
    v_resp = supabase.table("viajes").select("*, choferes(*)").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    if viaje["estado"] == "FINISHED":
        return {"message": "Viaje ya finalizado anteriormente."}

    # 2. Cálculos de Tiempos
    now = datetime.datetime.now(datetime.timezone.utc)
    finished_at = now.isoformat()
    
    # Recuperar timestamps (pueden venir como strings de Supabase)
    arrived_at_str = viaje.get("arrived_at")
    started_at_str = viaje.get("started_at")
    
    wait_minutes = 0
    if arrived_at_str and started_at_str:
        # parsed dates
        from dateutil import parser
        arr = parser.isoparse(arrived_at_str)
        st = parser.isoparse(started_at_str)
        wait_delta = st - arr
        wait_minutes = int(wait_delta.total_seconds() / 60)
    
    # 3. Distancia (Rough estimate if not provided by Google/Panel)
    # Si el panel mandó distancia, usar esa. Si no, calcular euclideana.
    dist_km = float(viaje.get("distancia_recorrida") or 1.0) # Fallback 1km
    if not viaje.get("distancia_recorrida"):
        try:
            import math
            o = viaje["origen"]
            d = viaje["destino"]
            dist_km = math.sqrt((o["lat"] - d["lat"])**2 + (o["lng"] - d["lng"])**2) * 111.0
        except:
             dist_km = 1.0

    # 4. Cálculo de Precio Final
    org_id = viaje["organizacion_id"]
    extras = viaje.get("extras", {})
    calc_res = calculate_fare(dist_km, org_id, wait_minutes, extras)
    
    final_price = calc_res["total"]
    wait_cost = calc_res["breakdown"].get("wait_cost", 0.0)
    
    # 5. Actualizar DB
    update_data = {
        "estado": "FINISHED",
        "finished_at": finished_at,
        "fecha_fin_viaje": finished_at,
        "wait_minutes": wait_minutes,
        "wait_cost": wait_cost,
        "final_price": final_price,
        "precio": final_price # Sync deprecated field
    }
    supabase.table("viajes").update(update_data).eq("id", viaje_id).execute()
    
    # 5.5 CUENTA CORRIENTE EMPRESA
    empresa_id = viaje.get("empresa_id")
    if empresa_id:
        try:
            em_resp = supabase.table("empresas").select("saldo").eq("id", empresa_id).execute()
            if em_resp.data:
                saldo_actual = float(em_resp.data[0].get("saldo", 0))
                nuevo_saldo = saldo_actual + final_price # Deuda incrementa
                
                # 1. Update saldo
                supabase.table("empresas").update({"saldo": nuevo_saldo}).eq("id", empresa_id).execute()
                
                # 2. Add movement
                emp_user_nombre = "Usuario de Empresa"
                if viaje.get("cliente_id"):
                    us_resp = supabase.table("usuarios").select("nombre").eq("id", viaje["cliente_id"]).execute()
                    if us_resp.data:
                        emp_user_nombre = us_resp.data[0]["nombre"]
                        
                supabase.table("cuenta_corriente_empresas").insert({
                    "empresa_id": empresa_id,
                    "tipo": "DEBITO",
                    "monto": final_price,
                    "descripcion": f"Viaje de {emp_user_nombre} (Ref: {viaje_id[:8]})",
                    "referencia_viaje_id": viaje_id
                }).execute()
        except BaseException as e:
            # Not blocking the finish, just log or print
            print("Error recording corporate debt:", e)

    # 6. Lógica de Comisión (Billetera)
    chofer_data = viaje.get("choferes")
    if chofer_data and chofer_data.get("tipo_pago") == "comision":
        pct_comision = float(chofer_data.get("valor_pago", 0))
        deduccion = final_price * (pct_comision / 100)
        nuevo_saldo = float(chofer_data.get("saldo", 0)) - deduccion
        supabase.table("choferes").update({"saldo": nuevo_saldo}).eq("id", chofer_data["id"]).execute()

    # 7. SISTEMA DE PUNTOS
    if viaje.get("cliente_id") and not viaje.get("usado_viaje_gratis"):
        import math
        puntos_ganados = math.floor(final_price / 1000) * 10
        
        if puntos_ganados > 0:
            cliente_id = viaje["cliente_id"]
            # Obtener puntos actuales
            u_resp = supabase.table("usuarios").select("nombre, puntos_actuales, viajes_gratis, telefono").eq("id", cliente_id).execute()
            if u_resp.data:
                user_data = u_resp.data[0]
                total_puntos = int(user_data.get("puntos_actuales") or 0) + puntos_ganados
                nuevos_viajes_gratis = int(user_data.get("viajes_gratis") or 0)
                
                # Verificar si alcanza 100
                if total_puntos >= 100:
                    total_puntos -= 100
                    nuevos_viajes_gratis += 1
                    
                    # Notificar Viaje Gratis via WhatsApp
                    nombre_pasajero = user_data.get("nombre", "Pasajero")
                    wpp_msg = f"🎉 ¡Felicidades {nombre_pasajero}! Por llegar a 100 puntos, ¡tienes un viaje gratis! Canjéalo cuando quieras. 🚗💨"
                    ai_inst = viaje.get("origen", {}).get("ai_instance", "viajesnea")
                    if user_data.get("telefono"):
                        background_tasks.add_task(send_whatsapp_message, ai_inst, user_data["telefono"], wpp_msg)

                # Actualizar Usuario
                supabase.table("usuarios").update({
                    "puntos_actuales": total_puntos,
                    "viajes_gratis": nuevos_viajes_gratis
                }).eq("id", cliente_id).execute()

                # Registrar Historial
                supabase.table("historial_puntos").insert({
                    "user_id": cliente_id,
                    "viaje_id": viaje_id,
                    "puntos": puntos_ganados,
                    "tipo": "ACUMULACION",
                    "descripcion": f"Puntos por viaje #{viaje_id[:8]}"
                }).execute()

                # Actualizar viaje con puntos generados
                update_data["puntos_generados"] = puntos_ganados
                supabase.table("viajes").update({"puntos_generados": puntos_ganados}).eq("id", viaje_id).execute()

    # 8. Disparar notificaciones (Ticket)
    background_tasks.add_task(notificar_finalizacion_v2, viaje_id, calc_res, wait_minutes)
    
    return {"message": "Viaje finalizado con éxito.", "final_price": final_price, "wait_minutes": wait_minutes, "puntos_generados": update_data.get("puntos_generados", 0)}

def notificar_finalizacion_v2(viaje_id: str, calc_res: dict, wait_minutes: int):
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data: return
    
    viaje = v_resp.data[0]
    pasajero_phone = viaje.get("origen", {}).get("cliente_telefono")
    ai_instance = viaje.get("origen", {}).get("ai_instance", "Viejes-Nea")
    
    if not pasajero_phone: return

    # Ticket Formatted Message
    breakdown = calc_res["breakdown"]
    extras_list = ""
    if breakdown.get("extras_cost", 0) > 0:
        extras_list = f"\nBaúl/Extras: ${breakdown['extras_cost']:.0f}"

    msg = (
        f"🏁 *Viaje Finalizado*\n\n"
        f"Recorrido: ${breakdown['distance_cost']:.0f}\n"
        f"Espera: {wait_minutes} min → ${breakdown['wait_cost']:.0f}"
        f"{extras_list}\n\n"
        f"*TOTAL: ${calc_res['total']:.0f}*\n\n"
        "¡Gracias por viajar con nosotros! ⭐"
    )
    
    # Usar el loop de eventos actual para tareas async si se llama desde bg tasks
    import asyncio
    asyncio.run(send_whatsapp_message(ai_instance, pasajero_phone, msg))
    
    # Calificación
    title = "⭐ ¡Tu opinión cuenta!"
    description = "Califica la atención del chofer."
    sections = [
        {"title": "Calificación", "rows": [
            {"title": "5 Estrellas", "rowId": f"rate_5_{viaje_id}"},
            {"title": "4 Estrellas", "rowId": f"rate_4_{viaje_id}"},
            {"title": "3 Estrellas", "rowId": f"rate_3_{viaje_id}"},
            {"title": "2 Estrellas", "rowId": f"rate_2_{viaje_id}"},
            {"title": "1 Estrella", "rowId": f"rate_1_{viaje_id}"}
        ]}
    ]
    asyncio.run(send_whatsapp_list_message(ai_instance, pasajero_phone, title, description, "Calificar", sections))

@router.post("/viajes/{viaje_id}/notificar-finalizacion")
def notificar_finalizacion(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data:
         return {"message": "Viaje no encontrado para notificar"}
    
    viaje = v_resp.data[0]
    origen_data = viaje.get("origen", {})
    pasajero_phone = origen_data.get("cliente_telefono")
    ai_instance = origen_data.get("ai_instance", "viajesnea")
    
    if not pasajero_phone:
         return {"message": "Sin telefono de contacto", "sent": False}
    
    # Mensajes de WhatsApp
    cierre_msg = "🚗 Tu viaje ha finalizado. ¡Gracias por confiar en nosotros!"
    background_tasks.add_task(send_whatsapp_message, ai_instance, pasajero_phone, cierre_msg)
    
    title = "⭐ ¡Tu opinión cuenta!"
    description = "Por favor, califica la atención del chofer."
    button_text = "Calificar"
    sections = [
        {
            "title": "Calificación",
            "rows": [
                {"title": "5 Estrellas", "rowId": f"rate_5_{viaje_id}"},
                {"title": "4 Estrellas", "rowId": f"rate_4_{viaje_id}"},
                {"title": "3 Estrellas", "rowId": f"rate_3_{viaje_id}"},
                {"title": "2 Estrellas", "rowId": f"rate_2_{viaje_id}"},
                {"title": "1 Estrella", "rowId": f"rate_1_{viaje_id}"}
            ]
        }
    ]
    background_tasks.add_task(send_whatsapp_list_message, ai_instance, pasajero_phone, title, description, button_text, sections)
    
    return {"message": "Notificaciones enviadas", "sent": True}

@router.post("/viajes/{viaje_id}/notificar-llegada")
def notificar_llegada(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    chofer_user_id = claims.get("sub")
    
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    pasajero_phone = viaje.get("origen", {}).get("cliente_telefono")
    ai_instance = viaje.get("origen", {}).get("ai_instance", "viajesnea")
    
    # 2. Actualizar estado a 'ARRIVED' y timestamp
    supabase.table("viajes").update({
        "estado": "ARRIVED",
        "arrived_at": datetime.datetime.now().isoformat(),
        "fecha_llegada_origen": datetime.datetime.now().isoformat()
    }).eq("id", viaje_id).execute()
    
    if not pasajero_phone:
         return {"message": "Llegada marcada, pero sin telefono de contacto", "sent": False}
    
    # 3. Obtener info del chofer para WPP
    usr_resp = supabase.table("usuarios").select("nombre").eq("id", chofer_user_id).execute()
    chofer_nombre = usr_resp.data[0]["nombre"] if usr_resp.data else "Tu Chofer"
    
    chf_resp = supabase.table("choferes").select("vehiculo, patente").eq("usuario_id", chofer_user_id).execute()
    vehiculo = "Auto"
    patente = "N/A"
    if chf_resp.data:
        vehiculo = chf_resp.data[0].get("vehiculo", "Auto")
        patente = chf_resp.data[0].get("patente", "N/A")
    
    # 4. Notificar pasajero
    llegada_msg = f"🚖 *Tu móvil ya llegó.*\n\nPor favor salí al punto de encuentro.\n\n👤 Chofer: {chofer_nombre}\n🚗 Vehículo: {vehiculo}\n📌 Patente: {patente}"
    background_tasks.add_task(send_whatsapp_message, ai_instance, pasajero_phone, llegada_msg)
    
    return {"message": "Notificación de llegada enviada", "sent": True}

@router.post("/viajes/{viaje_id}/cancelar")
def cancelar_viaje(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    pasajero_phone = viaje.get("origen", {}).get("cliente_telefono")
    ai_instance = viaje.get("origen", {}).get("ai_instance", "viajesnea")
    
    # 2. Actualizar estado a 'cancelado' y liberar al chofer (ya no está en curso)
    supabase.table("viajes").update({"estado": "cancelado"}).eq("id", viaje_id).execute()
    
    if pasajero_phone:
        # 3. Notificar pasajero y sugerir pedir otro
        cancel_msg = "⚠️ *Viaje Cancelado*\n\nEl chofer asignado tuvo un inconveniente y no podrá realizar tu viaje. Por favor, solicita un nuevo móvil enviando un mensaje al bot. ¡Disculpa las molestias!"
        background_tasks.add_task(send_whatsapp_message, ai_instance, pasajero_phone, cancel_msg)
    
    return {"message": "Viaje cancelado exitosamente", "sent": True}

@router.post("/sos")
def notificar_emergencia(lat: float, lng: float, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    chofer_user_id = claims.get("sub")
    
    usr_resp = supabase.table("usuarios").select("nombre").eq("id", chofer_user_id).execute()
    chofer_nombre = usr_resp.data[0]["nombre"] if usr_resp.data else "Un Chofer Desconocido"
    
    chf_resp = supabase.table("choferes").select("vehiculo, patente").eq("usuario_id", chofer_user_id).execute()
    auto_info = ""
    if chf_resp.data:
        vehiculo = chf_resp.data[0].get("vehiculo", "Auto")
        patente = chf_resp.data[0].get("patente", "N/A")
        auto_info = f"en un *{vehiculo}* (Patente: *{patente}*)"
    
    if settings.EMERGENCY_PHONE:
        mensaje = f"🚨 *¡ALERTA SOS - BOTÓN DE PÁNICO!* 🚨\n\nEl chofer *{chofer_nombre}* {auto_info} ha activado la alerta de emergencia.\n\n📍 *Última ubicación GPS:*\nhttps://www.google.com/maps/search/?api=1&query={lat},{lng}\n\n⚠️ Revisar el Panel de Administración inmediatamente."
        # Se envía usando el webhook principal configurado al número maestro
        background_tasks.add_task(send_whatsapp_message, settings.EVOLUTION_INSTANCE, settings.EMERGENCY_PHONE, mensaje)
    
    return {"message": "Alerta SOS Procesada", "sent": True}

# === NUEVO MÓDULO: PAGOS MANUALES CON COMPROBANTE ===

@router.get("/pagos")
def get_pagos_chofer(claims: Dict[str, Any] = Depends(get_current_chofer)):
    """Obtener el historial de transferencias enviadas por el chofer"""
    chofer_user_id = claims.get("sub")
    c_resp = supabase.table("choferes").select("id").eq("usuario_id", chofer_user_id).execute()
    if not c_resp.data:
        raise HTTPException(status_code=404, detail="Chofer no hallado.")
    c_id = c_resp.data[0]["id"]

    org_id = claims.get("organizacion_id")
    pagos_resp = supabase.table("pagos_chofer").select("*").eq("chofer_id", c_id).eq("organizacion_id", org_id).order("fecha_pago", desc=True).execute()
    return pagos_resp.data

@router.post("/pagos/upload")
async def registrar_pago_chofer(
    monto: float = Form(...),
    comprobante: UploadFile = File(...),
    claims: Dict[str, Any] = Depends(get_current_chofer)
):
    """Sube un ticket/comprobante a Supabase Storage y registra el pago como PENDIENTE."""
    chofer_user_id = claims.get("sub")
    c_resp = supabase.table("choferes").select("id").eq("usuario_id", chofer_user_id).execute()
    if not c_resp.data:
        raise HTTPException(status_code=404, detail="Chofer no hallado.")
    c_id = c_resp.data[0]["id"]

    if monto <= 0:
        raise HTTPException(status_code=400, detail="Monto ínvalido")

    import uuid
    # 1. Leer el archivo
    file_bytes = await comprobante.read()
    file_ext = comprobante.filename.split(".")[-1] if "." in comprobante.filename else "jpg"
    file_name = f"{c_id}/{uuid.uuid4()}.{file_ext}"

    # 2. Subir a Supabase Storage (bucket 'comprobantes')
    try:
         supabase.storage.from_("comprobantes").upload(file_name, file_bytes)
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Error al subir comprobante a Supabase. ¿Existe el bucket 'comprobantes' como Public?: {str(e)}")

    # 3. Obtener URL pública
    file_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/comprobantes/{file_name}"

    # 4. Insertar en BD
    org_id = claims.get("organizacion_id")
    try:
        ins_resp = supabase.table("pagos_chofer").insert({
            "organizacion_id": org_id,
            "chofer_id": c_id,
            "monto": monto,
            "comprobante_url": file_url,
            "estado": "PENDIENTE"
        }).execute()
        return ins_resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en BD: {str(e)}")
