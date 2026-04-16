from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime, date, time

from app.core.security import get_current_user
from app.db.supabase import supabase
from app.core.pricing import calculate_fare

router = APIRouter()

class TripRequest(BaseModel):
    origen: Dict[str, Any]
    destino: Dict[str, Any]
    precio_estimado: float
    distancia_km: float
    usar_viaje_gratis: Optional[bool] = False
    tipo_viaje: Optional[str] = "PERSONAL"

@router.get("/empresa")
def get_empresa_info(claims: Dict[str, Any] = Depends(get_current_user)):
    """Obtiene la empresa y beneficios asignados al cliente (si los hay)."""
    user_id = claims.get("sub")
    
    # Check if user is in an active company
    eu_resp = supabase.table("empresa_usuarios").select("empresa_id, activo, empresas!inner(nombre_empresa, activo)").eq("user_id", user_id).execute()
    
    if not eu_resp.data or not eu_resp.data[0].get("activo") or not eu_resp.data[0]["empresas"].get("activo"):
        return {"has_empresa": False}
        
    empresa_id = eu_resp.data[0]["empresa_id"]
    nombre_empresa = eu_resp.data[0]["empresas"]["nombre_empresa"]
    
    # Obtener beneficios
    ben_resp = supabase.table("empresa_beneficios").select("*").eq("empresa_id", empresa_id).eq("activo", True).execute()
    beneficios = ben_resp.data[0] if ben_resp.data else None
    
    return {
        "has_empresa": True,
        "empresa_id": empresa_id,
        "nombre_empresa": nombre_empresa,
        "beneficios": beneficios
    }

@router.get("/promociones/activas")
def get_active_promotions(claims: Dict[str, Any] = Depends(get_current_user)):
    """Obtiene las promociones activas para la organización del cliente."""
    org_id = claims.get("organizacion_id")
    
    # Filtrar solo las activas
    query = supabase.table("promociones").select("*").eq("organizacion_id", org_id).eq("activa", True)
    resp = query.execute()
    
    # Aquí podríamos filtrar por fecha si quisiéramos, 
    # pero como tenemos fechas de inicio y fin, lo hacemos en python por simplicidad o dejamos que el front muestre.
    return resp.data

@router.post("/viaje/cotizar")
def cotizar_viaje(data: TripRequest, claims: Dict[str, Any] = Depends(get_current_user)):
    """Cotiza el viaje consusltando la tarifa oficial del backend y busca la mejor promo aplicable."""
    org_id = claims.get("organizacion_id")
    user_id = claims.get("sub")
    
    # NUEVO: Calcular la base oficial usando "pricing.py" en vez de confiar ciegamente en "data.precio_estimado"
    calc_result = calculate_fare(data.distancia_km, org_id)
    precio_base_oficial = calc_result["total"]
    
    precio_final = precio_base_oficial
    monto_descontado = 0
    promocion_aplicada = None
    empresa_id_aplicable = None
    
    # ---- LOGICA EMPRESARIAL ----
    if data.tipo_viaje == "EMPRESARIAL":
        # Validar empresa del usuario
        eu_resp = supabase.table("empresa_usuarios").select("empresa_id, activo, empresas!inner(activo)").eq("user_id", user_id).execute()
        if eu_resp.data and eu_resp.data[0].get("activo") and eu_resp.data[0]["empresas"].get("activo"):
            empresa_id_aplicable = eu_resp.data[0]["empresa_id"]
            
            # Obtener beneficio activo
            ben_resp = supabase.table("empresa_beneficios").select("*").eq("empresa_id", empresa_id_aplicable).eq("activo", True).execute()
            if ben_resp.data:
                ben = ben_resp.data[0]
                
                # Check horario
                aplica_horario = True
                if ben.get("horario_inicio") and ben.get("horario_fin"):
                    now_time = datetime.now().time()
                    h_ini = datetime.strptime(ben["horario_inicio"], "%H:%M:%S").time()
                    h_fin = datetime.strptime(ben["horario_fin"], "%H:%M:%S").time()
                    if not (h_ini <= now_time <= h_fin):
                        aplica_horario = False
                        
                if aplica_horario:
                    if ben.get("tipo_descuento") == "PORCENTAJE":
                        monto_descontado = precio_final * (float(ben.get("valor", 0)) / 100.0)
                    elif ben.get("tipo_descuento") == "FIJO":
                        monto_descontado = float(ben.get("valor", 0))
    # ---- LOGICA NORMAL (PROMOCIONES) ----
    else:
        # 1. Obtener promociones activas
        promos_resp = supabase.table("promociones").select("*").eq("organizacion_id", org_id).eq("activa", True).execute()
        
        if promos_resp.data:
            hoy = datetime.now().date()
            promos_validas = []
            for p in promos_resp.data:
                valida = True
                if p.get("fecha_inicio") and datetime.strptime(p["fecha_inicio"], "%Y-%m-%d").date() > hoy:
                    valida = False
                if p.get("fecha_fin") and datetime.strptime(p["fecha_fin"], "%Y-%m-%d").date() < hoy:
                    valida = False
                if valida:
                    promos_validas.append(p)
                    
            if promos_validas:
                promo = promos_validas[0]
                promocion_aplicada = promo["id"]
                
                if promo.get("tipo_descuento") == "porcentaje":
                    pct = float(promo.get("valor_descuento", 0))
                    monto_descontado = precio_final * (pct / 100.0)
                elif promo.get("tipo_descuento") == "fijo":
                    val = float(promo.get("valor_descuento", 0))
                    monto_descontado = val
                    
    precio_final = max(0, precio_final - monto_descontado)

    return {
        "precio_original": precio_base_oficial,
        "precio_final": precio_final,
        "monto_descontado": monto_descontado,
        "promocion_id": promocion_aplicada,
        "empresa_id": empresa_id_aplicable
    }

@router.post("/viaje")
def solicitar_viaje(data: TripRequest, claims: Dict[str, Any] = Depends(get_current_user)):
    """Crea el viaje desde el panel del cliente pasajero."""
    cliente_id = claims.get("sub")
    
    # 1. Cotizar para obtener el precio real a cobrar y la promo
    cotizacion = cotizar_viaje(data, claims)
    
    precio_final = cotizacion["precio_final"]
    usado_viaje_gratis = False
    
    # 2. Lógica de Viaje Gratis
    if data.usar_viaje_gratis:
        # Validar si tiene viajes gratis
        u_resp = supabase.table("usuarios").select("viajes_gratis").eq("id", cliente_id).execute()
        if u_resp.data and int(u_resp.data[0].get("viajes_gratis") or 0) > 0:
            precio_final = 0
            usado_viaje_gratis = True
            # Descontar viaje gratis
            nuevos_viajes = int(u_resp.data[0].get("viajes_gratis")) - 1
            supabase.table("usuarios").update({"viajes_gratis": nuevos_viajes}).eq("id", cliente_id).execute()
            
            # Registrar canje en historial
            supabase.table("historial_puntos").insert({
                "user_id": cliente_id,
                "puntos": 100,
                "tipo": "CANJE",
                "descripcion": "Canje de viaje gratis"
            }).execute()
        else:
            raise HTTPException(status_code=400, detail="No tienes viajes gratis disponibles.")

    nuevo_viaje = {
        "organizacion_id": claims.get("organizacion_id"),
        "cliente_id": cliente_id,
        "origen": data.origen,
        "destino": data.destino,
        "precio": precio_final,
        "final_price": precio_final, # Sync with new logic
        "precio_original": cotizacion["precio_original"],
        "monto_descontado": cotizacion["monto_descontado"],
        "promocion_id": cotizacion["promocion_id"],
        "estado": "solicitado",
        "metodo_pago": "efectivo",
        "usado_viaje_gratis": usado_viaje_gratis,
        "tipo_viaje": data.tipo_viaje,
        "empresa_id": cotizacion.get("empresa_id"),
        "fecha_solicitud": datetime.now().isoformat()
    }
    
    # 3. Lógica de Cuenta Familiar (Control Parental y Reglas PRO)
    fam_check = supabase.table("miembros_familiares").select("rol, estado, grupo_id, grupos_familiares(tutor_user_id)").eq("user_id", cliente_id).eq("estado", "activo").execute()
    if fam_check.data and fam_check.data[0].get("rol") == "dependiente":
        tutor_id = fam_check.data[0].get("grupos_familiares", {}).get("tutor_user_id")
        grupo_id = fam_check.data[0].get("grupo_id")
        
        if tutor_id:
            # Validaciones PRO
            orga_data = supabase.table("organizaciones").select("plan").eq("id", claims.get("organizacion_id")).execute()
            is_pro = orga_data.data and orga_data.data[0].get("plan", "").lower() in ["pro", "premium", "enterprise"]
            
            mensajes_rechazo = []
            requiere_aprobacion = False
            
            if is_pro and grupo_id:
                try:
                    rules = supabase.table("family_rules").select("*").eq("grupo_id", grupo_id).execute()
                    if rules.data:
                        rule = rules.data[0]
                        if rule.get("require_approval"):
                            requiere_aprobacion = True
                            
                        if rule.get("max_amount_per_trip") is not None:
                            if precio_final > float(rule["max_amount_per_trip"]):
                                mensajes_rechazo.append(f"Excede el tope por viaje (${rule['max_amount_per_trip']})")
                                
                        if rule.get("allowed_start_time") and rule.get("allowed_end_time"):
                            from datetime import datetime
                            import pytz
                            ahora = datetime.now(pytz.timezone('America/Argentina/Buenos_Aires')).time()
                            h_ini = datetime.strptime(rule["allowed_start_time"], "%H:%M:%S").time()
                            h_fin = datetime.strptime(rule["allowed_end_time"], "%H:%M:%S").time()
                            if h_ini < h_fin:
                                if not (h_ini <= ahora <= h_fin): mensajes_rechazo.append("Horario no escolar/restringido")
                            else:
                                if not (ahora >= h_ini or ahora <= h_fin): mensajes_rechazo.append("Horario restringido extremo")
                                
                        if rule.get("max_trips_per_day") is not None:
                            from datetime import datetime
                            import pytz
                            today = datetime.now(pytz.timezone('America/Argentina/Buenos_Aires')).strftime('%Y-%m-%d')
                            vt = supabase.table("viajes").select("id").eq("cliente_id", cliente_id).gte("creado_en", today).execute()
                            if vt.data and len(vt.data) >= rule["max_trips_per_day"]:
                                mensajes_rechazo.append("Supera cupo de viajes diarios")
                                
                    zones = supabase.table("family_zones").select("*").eq("grupo_id", grupo_id).execute()
                    if zones.data:
                        import math
                        def haversine(lat1, lon1, lat2, lon2):
                            R = 6371000
                            phi1, phi2 = math.radians(lat1), math.radians(lat2)
                            dphi = math.radians(lat2 - lat1)
                            dlbd = math.radians(lon2 - lon1)
                            a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlbd/2)**2
                            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                        
                        o_lat, o_lng = float(data.origen.get("lat", 0)), float(data.origen.get("lng", 0))
                        d_lat, d_lng = float(data.destino.get("lat", 0)), float(data.destino.get("lng", 0))
                        
                        has_allowed_rules = any(z["tipo"] == "permitida" for z in zones.data)
                        o_in_allowed = False
                        d_in_allowed = False
                        
                        for z in zones.data:
                            dist_o = haversine(o_lat, o_lng, z["lat"], z["lng"])
                            dist_d = haversine(d_lat, d_lng, z["lat"], z["lng"])
                            
                            if z["tipo"] == "restringida":
                                if dist_o <= z["radio_metros"] or dist_d <= z["radio_metros"]:
                                    mensajes_rechazo.append(f"Zona prohibida: {z['nombre']}")
                            elif z["tipo"] == "permitida":
                                if dist_o <= z["radio_metros"]: o_in_allowed = True
                                if dist_d <= z["radio_metros"]: d_in_allowed = True
                        
                        if has_allowed_rules:
                            if not o_in_allowed: mensajes_rechazo.append("Origen fuera de zona permitida")
                            if not d_in_allowed: mensajes_rechazo.append("Destino fuera de zona permitida")
                except Exception as e:
                    print("Error parseando reglas:", e)
                    
            if mensajes_rechazo:
                msg_err = " y ".join(mensajes_rechazo)
                try:
                    from app.api.v1.endpoints.webhooks import send_whatsapp_message
                    t_data = supabase.table("usuarios").select("telefono").eq("id", tutor_id).execute()
                    if t_data.data and t_data.data[0].get("telefono"):
                        import asyncio
                        msg_wa = f"⚠️ *Alerta Control Parental*\n\nTu dependiente intentó pedir un viaje pero fue bloqueado por: *{msg_err}*"
                        asyncio.create_task(send_whatsapp_message(t_data.data[0]["telefono"], msg_wa, claims.get("organizacion_id")))
                except: pass
                raise HTTPException(status_code=403, detail="Restricción parental: " + msg_err)


            nuevo_viaje["tutor_responsable_id"] = tutor_id
            nuevo_viaje["metodo_pago"] = "cargo_tutor"
            
            if requiere_aprobacion:
                nuevo_viaje["estado"] = "esperando_tutor"
                
            # Notificamos
            try:
                from app.api.v1.endpoints.webhooks import send_whatsapp_message
                t_data = supabase.table("usuarios").select("telefono").eq("id", tutor_id).execute()
                if t_data.data and t_data.data[0].get("telefono"):
                    nombre_hijo = claims.get("nombre", "Tu dependiente")
                    origen_str = data.origen.get("direccion", "Su ubicación")
                    destino_str = data.destino.get("direccion", "Un destino")
                    import asyncio
                    
                    if requiere_aprobacion:
                        msg = f"🛡️ *Viajes NEA - Autorización Requerida*\n\n{nombre_hijo} quiere solicitar un viaje:\n📍 Desde: {origen_str}\n🏁 Hasta: {destino_str}\n💵 Estimado: ${precio_final}\n\nIngresa a tu App, pestaña Familia, para *APROBAR* o *RECHAZAR*."
                    else:
                        msg = f"🚗 *Viajes NEA - Control Familiar*\n\n{nombre_hijo} acaba de solicitar un viaje:\n📍 Desde: {origen_str}\n🏁 Hasta: {destino_str}\n\nPuedes supervisarlo en vivo desde tu panel."
                        
                    asyncio.create_task(send_whatsapp_message(t_data.data[0]["telefono"], msg, claims.get("organizacion_id")))
            except Exception as e:
                print("Aviso de viaje tutelado no enviado:", e)
                
    # 4. Inserción del viaje
    resp = supabase.table("viajes").insert(nuevo_viaje).execute()
    
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al crear el viaje")
        
    return resp.data[0]

@router.get("/viajes")
def historial_viajes(claims: Dict[str, Any] = Depends(get_current_user)):
    """Historial de viajes del cliente pasajero."""
    cliente_id = claims.get("sub")
    resp = supabase.table("viajes").select("*, promocion_id(titulo)").eq("cliente_id", cliente_id).order("creado_en", desc=True).limit(50).execute()
    return resp.data

@router.post("/viaje/{viaje_id}/cancelar")
def cancelar_viaje_cliente(viaje_id: str, claims: Dict[str, Any] = Depends(get_current_user)):
    """El pasajero cancela su propio viaje."""
    cliente_id = claims.get("sub")
    
    # 1. Validar propiedad y estado
    try:
        v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).eq("cliente_id", cliente_id).execute()
        if not v_resp.data:
             raise HTTPException(status_code=404, detail="Viaje no encontrado.")
        
        viaje = v_resp.data[0]
        # Permitir cancelar en estados iniciales o de asignación (Case-insensitive)
        estado_normalizado = (viaje["estado"] or "").upper()
        estados_cancelables = ["SOLICITADO", "REQUESTED", "ASIGNADO", "ACCEPTED", "ARRIVED", "EN_PUERTA"]
        
        if estado_normalizado not in estados_cancelables:
            raise HTTPException(status_code=400, detail=f"No se puede cancelar el viaje en estado: {viaje['estado']}. El chofer ya inició el recorrido.")
            
        res = supabase.table("viajes").update({"estado": "cancelado"}).eq("id", viaje_id).execute()
        return {"status": "ok", "message": "Viaje cancelado.", "data": res.data}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cancelar: {str(e)}")

class ReservaClienteRequest(BaseModel):
    origen: str
    destino: str
    fecha: str
    hora: str

@router.post("/reservas")
def crear_reserva_cliente(req: ReservaClienteRequest, claims: Dict[str, Any] = Depends(get_current_user)):
    """El pasajero crea una reserva."""
    # Obtenemos nombre y tel del perfil
    u_resp = supabase.table("usuarios").select("nombre, telefono").eq("id", claims.get("sub")).limit(1).execute()
    nombre = u_resp.data[0]["nombre"] if u_resp.data else "Pasajero"
    telefono = u_resp.data[0]["telefono"] if u_resp.data and "telefono" in u_resp.data[0] else ""
    
    nueva_reserva = {
        "organizacion_id": claims.get("organizacion_id"),
        "nombre_cliente": nombre,
        "telefono": telefono,
        "origen": req.origen,
        "destino": req.destino,
        "fecha_viaje": req.fecha,
        "hora_viaje": req.hora,
        "estado": "pendiente"
    }
    
    resp = supabase.table("reservations").insert(nueva_reserva).execute()
    return resp.data[0]

@router.get("/reservas")
def get_reservas_cliente(claims: Dict[str, Any] = Depends(get_current_user)):
    """Obtiene las reservas futuras del pasajero."""
    # Como el cliente está asociado al telefono, macheamos las reservas de esa organizacion.
    # Podriamos agregar `cliente_id` a reservations, pero usando el teléfono sirve.
    u_resp = supabase.table("usuarios").select("telefono").eq("id", claims.get("sub")).limit(1).execute()
    telefono = u_resp.data[0]["telefono"] if u_resp.data and "telefono" in u_resp.data[0] else None
    
    if not telefono:
        return []
        
    query = supabase.table("reservations").select("*").eq("organizacion_id", claims.get("organizacion_id")).eq("telefono", telefono)
    resp = query.order("fecha_viaje", desc=False).order("hora_viaje", desc=False).execute()
    return resp.data

@router.get("/organizacion")
def get_organizacion_info(claims: Dict[str, Any] = Depends(get_current_user)):
    """Datos de soporte para el dashboard de cliente."""
    org_id = claims.get("organizacion_id")
    resp = supabase.table("organizaciones").select("whatsapp_numero, nombre").eq("id", org_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")
    return resp.data[0]

@router.get("/puntos/status")
def get_puntos_status(claims: Dict[str, Any] = Depends(get_current_user)):
    """Obtiene el balance de puntos y viajes gratis del cliente."""
    user_id = claims.get("sub")
    resp = supabase.table("usuarios").select("puntos_actuales, viajes_gratis").eq("id", user_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    # También obtenemos el historial reciente
    historial = supabase.table("historial_puntos").select("*").eq("user_id", user_id).order("fecha", desc=True).limit(10).execute()
    
    return {
        "puntos_actuales": resp.data[0].get("puntos_actuales", 0),
        "viajes_gratis": resp.data[0].get("viajes_gratis", 0),
        "historial": historial.data
    }

class CalificacionRequest(BaseModel):
    puntuacion: int
    comentario: Optional[str] = None

@router.post("/viaje/{viaje_id}/calificar")
def calificar_viaje(viaje_id: str, data: CalificacionRequest, claims: Dict[str, Any] = Depends(get_current_user)):
    """Permite al pasajero calificar un viaje finalizado."""
    cliente_id = claims.get("sub")
    
    # 1. Validar el viaje
    v_resp = supabase.table("viajes").select("cliente_id, chofer_id, estado").eq("id", viaje_id).execute()
    if not v_resp.data:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")
        
    viaje = v_resp.data[0]
    
    # 2. Validar propiedad y estado
    if viaje["cliente_id"] != cliente_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para calificar este viaje.")
    
    if viaje["estado"] != "FINISHED":
        raise HTTPException(status_code=400, detail="Solo se pueden calificar viajes finalizados.")
        
    if not viaje["chofer_id"]:
        raise HTTPException(status_code=400, detail="El viaje no tiene un chofer asignado para calificar.")
        
    # 3. Validar si ya fue calificado
    c_resp = supabase.table("calificaciones").select("id").eq("viaje_id", viaje_id).execute()
    if c_resp.data:
        raise HTTPException(status_code=400, detail="Este viaje ya ha sido calificado.")
        
    # 4. Insertar calificación
    nueva_calificacion = {
        "viaje_id": viaje_id,
        "pasajero_id": cliente_id,
        "chofer_id": viaje["chofer_id"],
        "puntuacion": data.puntuacion,
        "comentario": data.comentario
    }
    
    resp = supabase.table("calificaciones").insert(nueva_calificacion).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al guardar la calificación.")
        
    return {"message": "Calificación registrada con éxito.", "calificacion": resp.data[0]}
