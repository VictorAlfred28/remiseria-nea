from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from typing import Dict, Any, Optional
from pydantic import BaseModel
import asyncio
import httpx
import re
import logging
import uuid

from app.db.supabase import supabase
from app.schemas.domain import ChoferRegistroCompleto
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
def crear_perfil_chofer(data: ChoferRegistroCompleto, background_tasks: BackgroundTasks):
    """
    REGISTRO PÚBLICO de chofer (sin autenticación).
    ACEPTAR: ChoferRegistroCompleto (unificado con /admin/chofer)
    SEGURIDAD: Valida email único, DNI único por org, licencia vencimiento > hoy, acepta_registros_publicos
    ESTADO: estado_validacion='pendiente' (requiere aprobación admin)
    
    DIFERENCIAS CON /admin/chofer:
    - estado_validacion = 'pendiente' (requiere approval)
    - usuario.estado = 'pendiente' (no aprobado aún)
    - Licencia puede ser opcional si tiene_vehiculo=False (validación flexible)
    """
    try:
        u_id = data.id if hasattr(data, 'id') else str(uuid.uuid4())
        org_id = data.organizacion_id
        email = data.email
        nombre = data.nombre
        tel = data.telefono
        dni = data.dni

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

        # SECURITY: Email único por org
        existing_email = supabase.table("usuarios") \
            .select("id") \
            .eq("organizacion_id", org_id) \
            .eq("email", email) \
            .execute()
        if existing_email.data:
            raise HTTPException(status_code=400, detail="Email ya registrado en esta organización")
        
        # SECURITY: DNI único por org
        existing_dni = supabase.table("choferes") \
            .select("id") \
            .eq("organizacion_id", org_id) \
            .eq("dni", dni) \
            .execute()
        if existing_dni.data:
            raise HTTPException(status_code=400, detail="DNI ya registrado en esta organización")

        # 1. Crear en usuarios (estado='pendiente' para registro público)
        supabase.table("usuarios").insert({
            "id": u_id,
            "organizacion_id": org_id,
            "email": email,
            "nombre": nombre,
            "telefono": tel,
            "direccion": data.direccion,
            "rol": "chofer",
            "estado": "pendiente"  # Requiere aprobación
        }).execute()
        
        # 2. Asignar rol
        supabase.table("user_roles").insert({
            "user_id": u_id,
            "role": "chofer"
        }).execute()

        # 3. Crear en choferes (estado_validacion='pendiente', todos los campos unificados)
        c_resp = supabase.table("choferes").insert({
            "organizacion_id": org_id,
            "usuario_id": u_id,
            # Personales
            "dni": data.dni,
            # Licencia
            "licencia_numero": data.licencia_numero,
            "licencia_categoria": data.licencia_categoria,
            "licencia_vencimiento": data.licencia_vencimiento,
            # Vehículo
            "tiene_vehiculo": data.tiene_vehiculo,
            "vehiculo": data.vehiculo,
            "patente": data.patente,
            # Documentos
            "documentos": data.documentos,
            # Pago (valores por defecto para registro público)
            "tipo_pago": data.tipo_pago,
            "valor_pago": data.valor_pago,
            # Estado
            "estado_validacion": "pendiente"  # Requiere aprobación admin
        }).execute()

        logger.info(f"New driver registered: {u_id} in org: {org_id}, estado=pendiente")
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
