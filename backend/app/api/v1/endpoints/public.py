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
from app.core.security import get_current_admin, get_current_user, has_role


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
    SECURITY FIX: Validates that organizacion_id exists and accepts new registrations.
    """
    try:
        u_id = req.get("id")
        org_id = req.get("organizacion_id")
        email = req.get("email")
        nombre = req.get("nombre")
        tel = req.get("telefono")
        
        # SECURITY: Validate organizacion_id exists
        if not org_id:
            raise HTTPException(status_code=400, detail="organizacion_id es requerido")
        
        org_check = supabase.table("organizaciones").select("id, acepta_registros_publicos").eq("id", org_id).execute()
        if not org_check.data:
            logger.warning(f"Registration attempt with non-existent org_id: {org_id}")
            raise HTTPException(status_code=400, detail="Organización no válida")
        
        org = org_check.data[0]
        if not org.get("acepta_registros_publicos", True):  # Default to accepting if field missing
            logger.warning(f"Registration attempt on closed org_id: {org_id}")
            raise HTTPException(status_code=400, detail="Esta organización no acepta registros públicos en este momento")
        
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
        
        logger.info(f"New user registered: {u_id} in org: {org_id}")
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
    SECURITY FIX: Validates that organizacion_id exists and accepts public driver registrations.
    """
    try:
        u_id = req.get("id")
        org_id = req.get("organizacion_id")
        email = req.get("email")
        nombre = req.get("nombre")
        tel = req.get("telefono")

        # SECURITY: Validate organizacion_id exists
        if not org_id:
            raise HTTPException(status_code=400, detail="organizacion_id es requerido")
        
        org_check = supabase.table("organizaciones").select("id, acepta_registros_publicos").eq("id", org_id).execute()
        if not org_check.data:
            logger.warning(f"Driver registration attempt with non-existent org_id: {org_id}")
            raise HTTPException(status_code=400, detail="Organización no válida")
        
        org = org_check.data[0]
        if not org.get("acepta_registros_publicos", True):
            logger.warning(f"Driver registration attempt on closed org_id: {org_id}")
            raise HTTPException(status_code=400, detail="Esta organización no acepta registros de choferes en este momento")

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

        logger.info(f"New driver registered: {u_id} in org: {org_id}")
        return {"status": "ok", "chofer": c_resp.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Driver registration error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/viajes/{viaje_id}/tracking")
def get_viaje_tracking(viaje_id: str, claims: Dict[str, Any] = Depends(get_current_user)):
    """
    Obtiene el tracking de un viaje específico.
    Validaciones: 
      - El usuario debe ser autenticado
      - El usuario debe tener acceso a este viaje (titular, chofer, cliente, o admin de la org)
    SECURITY: Prevents enumeration of all trips by unauthorized users.
    """
    user_id = claims.get("sub")
    org_id = claims.get("organizacion_id")
    
    # 1. Obtener viaje con validación de organización
    v_resp = supabase.table("viajes") \
        .select("id, estado, origen, destino, chofer_id, cliente_id, precio, organizacion_id, titular_id") \
        .eq("id", viaje_id) \
        .eq("organizacion_id", org_id) \
        .execute()
    
    if not v_resp.data:
        raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    
    # 2. Validar permisos: cliente, chofer, titular del vehículo, o admin
    is_cliente = viaje.get("cliente_id") == user_id
    is_chofer = viaje.get("chofer_id") == user_id
    is_admin = has_role(claims, "admin") or has_role(claims, "superadmin")
    
    # Check if user is titular of the vehicle (if applicable)
    is_titular = False
    if viaje.get("titular_id"):
        is_titular = viaje.get("titular_id") == user_id
    
    if not (is_cliente or is_chofer or is_titular or is_admin):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este viaje.")
    
    # Return tracking info (safe to return origen/destino for authorized users)
    return {
        "id": viaje["id"],
        "estado": viaje["estado"],
        "origen": viaje["origen"],
        "destino": viaje["destino"],
        "chofer_id": viaje["chofer_id"],
        "precio": viaje["precio"]
    }
