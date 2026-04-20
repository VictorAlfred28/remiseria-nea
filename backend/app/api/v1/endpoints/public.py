from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from typing import Dict, Any, Optional
from pydantic import BaseModel
import asyncio
import httpx
import re
import logging

from app.db.supabase import supabase
from app.core.evolution import send_whatsapp_message
from app.core.config import settings
from app.core.security import get_current_admin, get_current_user

logger = logging.getLogger(__name__)

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

@router.get("/test-wpp/{phone}")
async def test_wpp(phone: str, claims: Dict[str, Any] = Depends(get_current_admin)):
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

@router.post("/registro/perfil")
def crear_perfil_publico(req: dict, background_tasks: BackgroundTasks):
    """
    Crea el perfil en public.usuarios con validaciones de seguridad.
    """
    try:
        u_id = req.get("id")
        org_id = req.get("organizacion_id")
        email = req.get("email")
        nombre = req.get("nombre")
        tel = req.get("telefono")
        
        # Security: Email validation (RFC 5322 simplified)
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            logger.warning(f"Invalid email format attempted: {email}")
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Security: Name length validation (prevent overflow)
        if not nombre or len(nombre) < 3 or len(nombre) > 100:
            logger.warning(f"Invalid nombre length: {len(nombre) if nombre else 0}")
            raise HTTPException(status_code=400, detail="Nombre must be 3-100 characters")
        
        # Security: Phone validation (7-15 digits)
        phone_pattern = r'^\d{7,15}$'
        if not re.match(phone_pattern, tel.replace(" ", "").replace("-", "")):
            logger.warning(f"Invalid phone format attempted")
            raise HTTPException(status_code=400, detail="Invalid phone format")
        
        # Security: Check for existing email (prevent duplicates)
        existing = supabase.table("usuarios").select("id").eq("email", email).execute()
        if existing.data:
            logger.warning(f"Duplicate email registration attempt: {email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        resp = supabase.table("usuarios").insert({
            "id": u_id,
            "organizacion_id": org_id,
            "email": email,
            "nombre": nombre,
            "telefono": tel,
            "rol": "cliente"
        }).execute()
        
        supabase.table("user_roles").insert({
            "user_id": u_id,
            "role": "cliente"
        }).execute()
        
        logger.info(f"New user registered: {u_id}")
        return {"status": "ok", "perfil": resp.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/registro/chofer")
def crear_perfil_chofer(req: dict, background_tasks: BackgroundTasks):
    """
    Crea el perfil de chofer en estado 'pendiente'.
    """
    try:
        u_id = req.get("id")
        org_id = req.get("organizacion_id")
        email = req.get("email")
        nombre = req.get("nombre")
        tel = req.get("telefono")

        # 1. Crear en usuarios
        supabase.table("usuarios").insert({
            "id": u_id,
            "organizacion_id": org_id,
            "email": email,
            "nombre": nombre,
            "telefono": tel,
            "rol": "chofer",
            "estado": "pendiente"
        }).execute()
        
        # 2. Asignar rol
        supabase.table("user_roles").insert({
            "user_id": u_id,
            "role": "chofer"
        }).execute()

        # 3. Crear en choferes
        c_resp = supabase.table("choferes").insert({
            "organizacion_id": org_id,
            "usuario_id": u_id,
            "vehiculo": req.get("vehiculo"),
            "patente": req.get("patente"),
            "tiene_vehiculo": req.get("tiene_vehiculo", False),
            "licencia_numero": req.get("licencia_numero"),
            "licencia_categoria": req.get("licencia_categoria"),
            "licencia_vencimiento": req.get("licencia_vencimiento"),
            "documentos": req.get("documentos", []),
            "estado_validacion": "pendiente"
        }).execute()

        return {"status": "ok", "chofer": c_resp.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/viajes/{viaje_id}/tracking")
def get_viaje_tracking(viaje_id: str):
    v_resp = supabase.table("viajes").select("id, estado, origen, destino, chofer_id, precio, organizacion_id").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    return v_resp.data[0]
