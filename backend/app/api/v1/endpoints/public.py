from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.db.supabase import supabase
from app.core.evolution import send_whatsapp_message
import asyncio

router = APIRouter()

@router.get("/organizaciones/default")
def get_default_organization():
    """
    Endpoint para obtener el ID de la organización por defecto.
    Útil para el registro público de nuevos clientes vía frontend donde RLS bloquea selects anónimos.
    """
    resp = supabase.table("organizaciones").select("id").limit(1).execute()
    if not resp.data:
         raise HTTPException(status_code=404, detail="No hay organizaciones configuradas en la plataforma.")
    return {"id": resp.data[0]["id"]}

import httpx
from app.core.config import settings

@router.get("/test-wpp/{phone}")
async def test_wpp(phone: str):
    """
    Endpoint de debug para verificar respuesta de Evolution API
    """
    url = f"{settings.EVOLUTION_URL}/message/sendText/Viejes-Nea"
    headers = {
        "apikey": settings.EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "number": phone,
        "text": "Prueba de diagnóstico de WhatsApp (Viajes NEA)"
    }
    async with httpx.AsyncClient() as client:
        try:
             res = await client.post(url, headers=headers, json=payload, timeout=10.0)
             return {
                 "status_code": res.status_code,
                 "response_text": res.text,
                 "url_used": url,
                 "payload": payload
             }
        except Exception as e:
             return {"error": str(e)}

from pydantic import BaseModel

class RegistroPerfilRequest(BaseModel):
    id: str
    organizacion_id: str
    email: str
    nombre: str
    telefono: str
    rol: str = "cliente"

@router.post("/registro/perfil")
def crear_perfil_publico(req: RegistroPerfilRequest, background_tasks: BackgroundTasks):
    """
    Crea el perfil en public.usuarios saltando las reglas de RLS del frontend.
    Se asume que Auth ya fue creado en Supabase por el cliente.
    """
    try:
        resp = supabase.table("usuarios").insert({
            "id": req.id,
            "organizacion_id": req.organizacion_id,
            "email": req.email,
            "nombre": req.nombre,
            "telefono": req.telefono,
            "rol": req.rol
        }).execute()
        
        # Enviar mensaje de bienvenida por WhatsApp en segundo plano
        if req.telefono:
            # Limpiar el número y formatear para WhatsApp Evolution
            tel = ''.join(filter(str.isdigit, req.telefono))
            if tel.startswith("0"): 
                tel = tel[1:]
            if not tel.startswith("54"):
                tel = "549" + tel
            if not tel.endswith("@s.whatsapp.net"):
                tel = tel + "@s.whatsapp.net"
                
            mensaje_bienvenida = (
                f"👋 ¡Hola {req.nombre}! Bienvenido a *Viajes NEA*.\n\n"
                "Tu cuenta de pasajero ha sido creada exitosamente. "
                "Desde nuestro panel web vas a poder:\n"
                "🚗 Pedir móviles al instante\n"
                "💳 Pagar con Mercado Pago\n"
                "🎁 Acceder a nuestras promociones exclusivas\n\n"
                "¡Estamos listos para llevarte a donde necesites!"
            )
            # Función síncrona auxiliar para BackgroundTasks
            def _send_sync():
                asyncio.run(send_whatsapp_message("Viejes-Nea", tel, mensaje_bienvenida))
            
            background_tasks.add_task(_send_sync)

        return {"status": "ok", "perfil": resp.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/viajes/{viaje_id}/tracking")
def get_viaje_tracking(viaje_id: str):
    """
    Endpoint público para visualizar el estado y datos del chofer asignado 
    a un viaje, usado para el Live Tracker. No requiere autenticación JWT.
    """
    
    v_resp = supabase.table("viajes").select("id, estado, origen, destino, chofer_id, precio, organizacion_id").eq("id", viaje_id).execute()
    
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado o link vencido.")
    
    viaje = v_resp.data[0]
    
    safe_viaje = {
        "id": viaje.get("id"),
        "estado": viaje.get("estado"),
        "origen": viaje.get("origen"),
        "destino": viaje.get("destino"),
        "precio": viaje.get("precio"),
        "organizacion_id": viaje.get("organizacion_id"),
        "chofer": None
    }
    
    if viaje.get("chofer_id"):
        ch_resp = supabase.table("choferes").select("vehiculo, patente, lat, lng, usuario_id").eq("id", viaje["chofer_id"]).execute()
        if ch_resp.data:
            chofer_data = ch_resp.data[0]
            
            usr_resp = supabase.table("usuarios").select("nombre").eq("id", chofer_data["usuario_id"]).execute()
            nombre = usr_resp.data[0]["nombre"] if usr_resp.data else "Chofer"
            
            safe_viaje["chofer"] = {
                "nombre": nombre,
                "vehiculo": chofer_data.get("vehiculo"),
                "patente": chofer_data.get("patente", ""),
                "usuario_id": chofer_data.get("usuario_id"),  
                "lat": chofer_data.get("lat"),
                "lng": chofer_data.get("lng")
            }
            
    return safe_viaje
