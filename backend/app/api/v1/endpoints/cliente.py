from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime, date, time
import logging

from app.core.security import get_current_cliente
from app.db.supabase import supabase
from app.core.pricing import calculate_fare

router = APIRouter()
logger = logging.getLogger(__name__)

class TripRequest(BaseModel):
    origen: Dict[str, Any]
    destino: Dict[str, Any]
    precio_estimado: float
    distancia_km: float
    usar_viaje_gratis: Optional[bool] = False
    tipo_viaje: Optional[str] = "PERSONAL"

class TripEditRequest(BaseModel):
    origen: Dict[str, Any]
    destino: Dict[str, Any]
    distancia_km: float

class ComercioSolicitudRequest(BaseModel):
    nombre: str
    rubro: str
    direccion: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    descripcion: Optional[str] = None
    logo_url: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None

class PromocionComercioRequest(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    valor_descuento: Optional[float] = 0
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    activa: Optional[bool] = True
    tipo_descuento: Optional[str] = "fijo" # o porcentaje
    imagen_url: Optional[str] = None
    es_exclusiva_profesionales: Optional[bool] = False
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
@router.get("/empresa")
def get_empresa_info(claims: Dict[str, Any] = Depends(get_current_cliente)):
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
def get_active_promotions(claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Obtiene las promociones activas para la organización del cliente."""
    org_id = claims.get("organizacion_id")
    
    # Filtrar solo las activas
    query = supabase.table("promociones").select("*").eq("organizacion_id", org_id).eq("activa", True)
    resp = query.execute()
    
    # Aquí podríamos filtrar por fecha si quisiéramos, 
    # pero como tenemos fechas de inicio y fin, lo hacemos en python por simplicidad o dejamos que el front muestre.
    return resp.data

@router.get("/promociones/recomendadas")
def recomendaciones_promos(claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Sistema predictivo de promociones (Opción 3)."""
    cliente_id = claims.get("sub")
    org_id = claims.get("organizacion_id")
    
    u_resp = supabase.table("usuarios").select("puntos_actuales, viajes_gratis").eq("id", cliente_id).execute()
    puntos = int(u_resp.data[0].get("puntos_actuales") or 0) if u_resp.data else 0
    viajes_gratis = int(u_resp.data[0].get("viajes_gratis") or 0) if u_resp.data else 0
        
    v_resp = supabase.table("viajes").select("creado_en").eq("cliente_id", cliente_id).order("creado_en", desc=True).limit(1).execute()
    dias_sin_viajar = 999
    if v_resp.data:
        try:
            ultimo = datetime.fromisoformat(v_resp.data[0]["creado_en"].replace("Z", "+00:00"))
            ahora = datetime.now(ultimo.tzinfo)
            dias_sin_viajar = (ahora - ultimo).days
        except: pass
        
    p_resp = supabase.table("promociones").select("*").eq("organizacion_id", org_id).eq("activa", True).execute()
    promo_activa = None
    if p_resp.data:
        hoy = datetime.now().date()
        validas = []
        for p in p_resp.data:
            val = True
            if p.get("fecha_inicio") and datetime.strptime(p["fecha_inicio"], "%Y-%m-%d").date() > hoy: val = False
            if p.get("fecha_fin") and datetime.strptime(p["fecha_fin"], "%Y-%m-%d").date() < hoy: val = False
            if val: validas.append(p)
        if validas:
            promo_activa = validas[0]
            
    if viajes_gratis > 0:
        return {
            "tipo": "VIAJE_GRATIS",
            "titulo": "¡Tienes viajes gratis disponibles!",
            "descripcion": f"Cuentas con {viajes_gratis} viaje(s) gratis. Marca la opción al pedir tu móvil.",
            "color": "emerald"
        }
        
    if puntos >= 100: # Asumimos 100 puntos = 1 canje (según req previos)
        return {
            "tipo": "CANJE_PUNTOS",
            "titulo": "¡Tus puntos valen viajes!",
            "descripcion": f"Tienes {puntos} puntos. Canjéalos por un viaje en la pestaña Beneficios.",
            "color": "violet"
        }
        
    if dias_sin_viajar >= 7 and promo_activa:
        return {
            "tipo": "RETENCION",
            "titulo": "¡Te extrañamos por aquí!",
            "descripcion": f"Usa el descuento '{promo_activa['titulo']}' en tu próximo traslado.",
            "color": "amber",
            "promo_id": promo_activa["id"]
        }
        
    if promo_activa:
        return {
            "tipo": "PROMO_DIA",
            "titulo": "Recomendación del Día",
            "descripcion": f"Aprovecha nuestra promoción: {promo_activa['titulo']}",
            "color": "blue",
            "promo_id": promo_activa["id"]
        }
        
    return None

@router.post("/viaje/cotizar")
def cotizar_viaje(data: TripRequest, claims: Dict[str, Any] = Depends(get_current_cliente)):
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
def solicitar_viaje(data: TripRequest, claims: Dict[str, Any] = Depends(get_current_cliente)):
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
        "estado": "SOLICITADO",
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
                            import pytz
                            ahora = datetime.now(pytz.timezone('America/Argentina/Buenos_Aires')).time()
                            h_ini = datetime.strptime(rule["allowed_start_time"], "%H:%M:%S").time()
                            h_fin = datetime.strptime(rule["allowed_end_time"], "%H:%M:%S").time()
                            if h_ini < h_fin:
                                if not (h_ini <= ahora <= h_fin): mensajes_rechazo.append("Horario no escolar/restringido")
                            else:
                                if not (ahora >= h_ini or ahora <= h_fin): mensajes_rechazo.append("Horario restringido extremo")
                                
                        if rule.get("max_trips_per_day") is not None:
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
                    logger.warning(f"Error evaluando reglas parentales: {e}")
                    
            if mensajes_rechazo:
                msg_err = " y ".join(mensajes_rechazo)
                try:
                    from app.core.evolution import send_whatsapp_message
                    from app.core.config import settings
                    t_data = supabase.table("usuarios").select("telefono").eq("id", tutor_id).execute()
                    if t_data.data and t_data.data[0].get("telefono"):
                        import asyncio
                        msg_wa = f"⚠️ *Alerta Control Parental*\n\nTu dependiente intentó pedir un viaje pero fue bloqueado por: *{msg_err}*"
                        asyncio.create_task(send_whatsapp_message(settings.EVOLUTION_INSTANCE, t_data.data[0]["telefono"], msg_wa))
                except Exception as e:
                    logger.warning(f"Error enviando alerta WhatsApp al tutor: {e}")
                raise HTTPException(status_code=403, detail="Restricción parental: " + msg_err)


            nuevo_viaje["tutor_responsable_id"] = tutor_id
            nuevo_viaje["metodo_pago"] = "cargo_tutor"
            
            if requiere_aprobacion:
                nuevo_viaje["estado"] = "ESPERANDO_TUTOR"
                
            # Notificamos
            try:
                from app.core.evolution import send_whatsapp_message
                from app.core.config import settings
                t_data = supabase.table("usuarios").select("telefono").eq("id", tutor_id).execute()
                if t_data.data and t_data.data[0].get("telefono"):
                    nombre_hijo = claims.get("nombre", "Tu dependiente")
                    origen_str = data.origen.get("direccion", "Su ubicación")
                    destino_str = data.destino.get("direccion", "Un destino")
                    import asyncio
                    
                    if requiere_aprobacion:
                        msg = f"🛡️ *Traslados UBI - Autorización Requerida*\n\n{nombre_hijo} quiere solicitar un viaje:\n📍 Desde: {origen_str}\n🏁 Hasta: {destino_str}\n💵 Estimado: ${precio_final}\n\nIngresa a tu App, pestaña Familia, para *APROBAR* o *RECHAZAR*."
                    else:
                        msg = f"🚗 *Traslados UBI - Control Familiar*\n\n{nombre_hijo} acaba de solicitar un viaje:\n📍 Desde: {origen_str}\n🏁 Hasta: {destino_str}\n\nPuedes supervisarlo en vivo desde tu panel."
                        
                    asyncio.create_task(send_whatsapp_message(settings.EVOLUTION_INSTANCE, t_data.data[0]["telefono"], msg))
            except Exception as e:
                logger.warning(f"Aviso de viaje tutelado no enviado: {e}")
                
    # 4. Inserción del viaje
    resp = supabase.table("viajes").insert(nuevo_viaje).execute()
    
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al crear el viaje")
        
    return resp.data[0]

@router.get("/viajes")
def historial_viajes(claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Historial de viajes del cliente pasajero."""
    cliente_id = claims.get("sub")
    resp = supabase.table("viajes").select("*, promocion_id(titulo)").eq("cliente_id", cliente_id).order("creado_en", desc=True).limit(50).execute()
    return resp.data

@router.get("/viajes/recomendaciones")
def recomendaciones_destinos(claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Sistema predictivo: devuelve los mejores destinos basándose en historial, frecuencia y hora del día."""
    cliente_id = claims.get("sub")
    
    resp = supabase.table("viajes").select("origen, destino, creado_en").eq("cliente_id", cliente_id).order("creado_en", desc=True).limit(100).execute()
    
    if not resp.data:
        return []
        
    import pytz
    ahora = datetime.now(pytz.timezone('America/Argentina/Buenos_Aires'))
    hora_actual = ahora.hour
    
    scores = {}
    
    for v in resp.data:
        o = v.get("origen", {})
        d = v.get("destino", {})
        o_dir = o.get("direccion")
        d_dir = d.get("direccion")
        if not o_dir or not d_dir:
            continue
            
        key = f"{o_dir}|{d_dir}"
        
        if key not in scores:
            scores[key] = {
                "score": 0,
                "origen": o_dir,
                "destino": d_dir,
                "origen_full": o,
                "destino_full": d,
                "count": 0
            }
        
        scores[key]["count"] += 1
        scores[key]["score"] += 10 # Base por frecuencia
        
        try:
            dt = datetime.fromisoformat(v["creado_en"].replace("Z", "+00:00"))
            dt_local = dt.astimezone(pytz.timezone('America/Argentina/Buenos_Aires'))
            hora_viaje = dt_local.hour
            
            # Bonus si es en horario similar (+/- 2 horas)
            diff = min((hora_viaje - hora_actual) % 24, (hora_actual - hora_viaje) % 24)
            if diff <= 2:
                scores[key]["score"] += 25
            elif diff <= 4:
                scores[key]["score"] += 10
                
        except Exception as e:
            pass
            
    sorted_recs = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
    return sorted_recs[:3]


@router.get("/choferes/favoritos")
def choferes_favoritos(claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Obtiene los choferes mejor calificados por el pasajero (Modo Informativo)."""
    cliente_id = claims.get("sub")
    
    resp = supabase.table("calificaciones") \
        .select("puntuacion, chofer_id, created_at, choferes(vehiculo, patente, usuarios(nombre, foto_perfil))") \
        .eq("pasajero_id", cliente_id) \
        .execute()
        
    if not resp.data:
        return []
        
    agrupado = {}
    for c in resp.data:
        chid = c.get("chofer_id")
        if not chid: continue
        
        if chid not in agrupado:
            agrupado[chid] = {
                "chofer_id": chid,
                "data": c.get("choferes", {}),
                "viajes_con_cliente": 0,
                "max_puntuacion_cliente": 0,
                "ultima_fecha": c.get("created_at", "")
            }
            
        agrupado[chid]["viajes_con_cliente"] += 1
        if c.get("puntuacion") and c.get("puntuacion") > agrupado[chid]["max_puntuacion_cliente"]:
            agrupado[chid]["max_puntuacion_cliente"] = c.get("puntuacion")
            
        if c.get("created_at") and c.get("created_at") > agrupado[chid]["ultima_fecha"]:
            agrupado[chid]["ultima_fecha"] = c.get("created_at")
            
    favoritos_ids = [k for k, v in agrupado.items() if v["max_puntuacion_cliente"] >= 4]
    
    if not favoritos_ids:
        return []
        
    resp_prom = supabase.table("calificaciones").select("chofer_id, puntuacion").in_("chofer_id", favoritos_ids).execute()
    promedios = {}
    if resp_prom.data:
        for p in resp_prom.data:
            chid = p.get("chofer_id")
            if chid not in promedios:
                promedios[chid] = {"sum": 0, "count": 0}
            if p.get("puntuacion"):
                promedios[chid]["sum"] += p.get("puntuacion")
                promedios[chid]["count"] += 1
            
    resultado = []
    for chid in favoritos_ids:
        chofer_data = agrupado[chid]["data"]
        usr = chofer_data.get("usuarios", {}) if chofer_data else {}
        
        prom = 5.0
        if chid in promedios and promedios[chid]["count"] > 0:
            prom = promedios[chid]["sum"] / promedios[chid]["count"]
            
        resultado.append({
            "id": chid,
            "nombre": usr.get("nombre", "") or "Chofer",
            "apellido": "",
            "foto_perfil": usr.get("foto_perfil"),
            "vehiculo": chofer_data.get("vehiculo") if chofer_data else "",
            "patente": chofer_data.get("patente") if chofer_data else "",
            "promedio_calificaciones": round(prom, 1),
            "cantidad_viajes_con_cliente": agrupado[chid]["viajes_con_cliente"],
            "ultima_fecha": agrupado[chid]["ultima_fecha"]
        })
        
    # Ordenar: 1. Mayor cantidad de viajes, 2. Mejor promedio, 3. Más reciente
    resultado.sort(key=lambda x: (x["cantidad_viajes_con_cliente"], x["promedio_calificaciones"], x["ultima_fecha"]), reverse=True)
    
    return resultado

@router.post("/viaje/{viaje_id}/cancelar")
def cancelar_viaje_cliente(viaje_id: str, claims: Dict[str, Any] = Depends(get_current_cliente)):
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
        estados_cancelables = ["SOLICITADO", "ACEPTADO", "EN_PUERTA"]
        
        if estado_normalizado not in estados_cancelables:
            raise HTTPException(status_code=400, detail=f"No se puede cancelar el viaje en estado: {viaje['estado']}. El chofer ya inició el recorrido.")
            
        res = supabase.table("viajes").update({"estado": "CANCELADO"}).eq("id", viaje_id).execute()
        return {"status": "ok", "message": "Viaje cancelado.", "data": res.data}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cancelar: {str(e)}")

@router.patch("/viaje/{viaje_id}")
def editar_viaje_cliente(viaje_id: str, data: TripEditRequest, claims: Dict[str, Any] = Depends(get_current_cliente)):
    """El pasajero edita su viaje antes de ser asignado."""
    cliente_id = claims.get("sub")
    
    try:
        # 1. Validar propiedad y estado
        v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).eq("cliente_id", cliente_id).execute()
        if not v_resp.data:
             raise HTTPException(status_code=404, detail="Viaje no encontrado.")
        
        viaje = v_resp.data[0]
        estado_normalizado = (viaje["estado"] or "").upper()
        
        if estado_normalizado not in ["SOLICITADO"]:
            raise HTTPException(status_code=400, detail="El viaje ya fue asignado a un chofer. Si necesita modificar origen o destino deberá cancelar el viaje y generar una nueva solicitud.")

        # 2. Bloquear edición si es cuenta tutelada
        if estado_normalizado == "ESPERANDO_TUTOR" or viaje.get("tutor_responsable_id"):
            raise HTTPException(status_code=403, detail="No se puede editar un viaje bajo supervisión parental. Por favor cancela y solicita uno nuevo.")

        # 3. Recalcular cotización
        cotiz_req = TripRequest(
            origen=data.origen,
            destino=data.destino,
            precio_estimado=0,
            distancia_km=data.distancia_km,
            tipo_viaje=viaje.get("tipo_viaje", "PERSONAL")
        )
        cotizacion = cotizar_viaje(cotiz_req, claims)
        
        precio_final = cotizacion["precio_final"] if not viaje.get("usado_viaje_gratis") else 0
        
        # 4. Actualizar DB
        payload_update = {
            "origen": data.origen,
            "destino": data.destino,
            "precio": precio_final,
            "final_price": precio_final,
            "precio_original": cotizacion["precio_original"],
            "monto_descontado": cotizacion["monto_descontado"],
            "promocion_id": cotizacion["promocion_id"],
            "empresa_id": cotizacion.get("empresa_id")
        }
        
        res = supabase.table("viajes").update(payload_update).eq("id", viaje_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="Error al actualizar el viaje.")
            
        return {"status": "ok", "message": "Viaje actualizado correctamente.", "data": res.data[0]}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al editar: {str(e)}")

class ReservaClienteRequest(BaseModel):
    origen: str
    destino: str
    fecha: str
    hora: str

@router.post("/reservas")
def crear_reserva_cliente(req: ReservaClienteRequest, claims: Dict[str, Any] = Depends(get_current_cliente)):
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
def get_reservas_cliente(claims: Dict[str, Any] = Depends(get_current_cliente)):
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
def get_organizacion_info(claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Datos de soporte para el dashboard de cliente."""
    org_id = claims.get("organizacion_id")
    resp = supabase.table("organizaciones").select("whatsapp_numero, nombre").eq("id", org_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")
    return resp.data[0]

@router.get("/puntos/status")
def get_puntos_status(claims: Dict[str, Any] = Depends(get_current_cliente)):
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
    recomendado: Optional[bool] = False

@router.post("/viaje/{viaje_id}/calificar")
def calificar_viaje(viaje_id: str, data: CalificacionRequest, claims: Dict[str, Any] = Depends(get_current_cliente)):
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
    
    if viaje["estado"] != "FINALIZADO":
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
        "comentario": data.comentario,
        "recomendado": data.recomendado
    }
    
    resp = supabase.table("calificaciones").insert(nueva_calificacion).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al guardar la calificación.")
        
    return {"message": "Calificación registrada con éxito.", "calificacion": resp.data[0]}

# ==========================================
# MI NEGOCIO (COMERCIOS)
# ==========================================

@router.get("/negocio/estado")
def get_negocio_estado(claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Obtiene el estado del negocio del usuario: NINGUNO, PENDIENTE, RECHAZADO o APROBADO."""
    user_id = claims.get("sub")
    
    # Check si tiene un comercio activo aprobado primero (en tabla comercios)
    comercio_resp = supabase.table("comercios").select("*").eq("user_id", user_id).execute()
    if comercio_resp.data:
        return {"estado": "APROBADO", "data_comercio": comercio_resp.data[0]}
        
    # Si no, buscar en solicitudes
    sol_resp = supabase.table("comercio_solicitudes").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
    if sol_resp.data:
        return {"estado": sol_resp.data[0]["estado"], "solicitud": sol_resp.data[0]}
        
    return {"estado": "NINGUNO"}

@router.post("/negocio/solicitud")
def solicitar_adhesion_comercio(data: ComercioSolicitudRequest, claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Crea una solicitud de adhesión para un comercio."""
    user_id = claims.get("sub")
    
    # Validar si ya tiene un comercio activo
    com_check = supabase.table("comercios").select("id").eq("user_id", user_id).execute()
    if com_check.data:
        raise HTTPException(status_code=400, detail="Ya posees un comercio aprobado.")
        
    # Upsert solicitud (permite reintentar si fue rechazado)
    # Por si hay Unique constraint error
    payload = data.model_dump()
    payload["user_id"] = user_id
    payload["estado"] = "PENDIENTE"
    payload["updated_at"] = datetime.now().isoformat()
    
    # Usar upsert para no fallar por UNIQUE(user_id) en caso de que esté reintentando tras rechazo
    resp = supabase.table("comercio_solicitudes").upsert(payload, on_conflict="user_id").execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al registrar la solicitud.")
        
    return {"mensaje": "Solicitud enviada exitosamente", "solicitud": resp.data[0]}

@router.get("/negocio/promociones")
def get_mid_negocio_promociones(claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Trae las promociones creadas por el comercio del usuario."""
    user_id = claims.get("sub")
    
    comercio_resp = supabase.table("comercios").select("id").eq("user_id", user_id).execute()
    if not comercio_resp.data:
        raise HTTPException(status_code=403, detail="No posees un comercio aprobado.")
        
    comercio_id = comercio_resp.data[0]["id"]
    
    resp = supabase.table("promociones").select("*").eq("comercio_id", comercio_id).order("creado_en", desc=True).execute()
    return resp.data

@router.post("/negocio/promociones")
def create_negocio_promocion(data: PromocionComercioRequest, claims: Dict[str, Any] = Depends(get_current_cliente)):
    """Crea una promoción (solo para comercios aprobados)."""
    user_id = claims.get("sub")
    org_id = claims.get("organizacion_id")
    
    # Validar que tiene comercio
    comercio_resp = supabase.table("comercios").select("id").eq("user_id", user_id).execute()
    if not comercio_resp.data:
        raise HTTPException(status_code=403, detail="No tienes un comercio aprobado o asignado.")
        
    comercio_id = comercio_resp.data[0]["id"]
    
    payload = data.model_dump()
    payload["comercio_id"] = comercio_id
    # En AdminDashboard vemos que requiere originar de algo, o asocia la org:
    payload["organizacion_id"] = org_id
    
    resp = supabase.table("promociones").insert(payload).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error creando la promoción.")
        
    return resp.data[0]

