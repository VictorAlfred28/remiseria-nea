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
from app.core.validators import validar_registro_publico
from app.core.evolution import send_whatsapp_message
from app.core.config import settings
from app.core.security import get_current_admin, get_current_user, has_role
from app.services import email_service


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
        
        resp = supabase.table("usuarios").upsert({
            "id": u_id,
            "organizacion_id": org_id,
            "email": email,
            "nombre": nombre,
            "telefono": tel,
            "rol": "cliente"
        }, on_conflict="id").execute()
        
        supabase.table("user_roles").insert({
            "user_id": u_id,
            "role": "cliente"
        }).execute()
        
        # Enviar correos
        background_tasks.add_task(email_service.send_account_registered, email, nombre)
        background_tasks.add_task(email_service.send_admin_alert, email, nombre, tel, "cliente")
        
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
    VALIDACIÓN: Centralizada en validar_registro_publico() (fuente única de verdad)
    ESTADO: estado_validacion='pendiente' (requiere aprobación admin)
    
    DIFERENCIAS CON /admin/chofer:
    - estado_validacion = 'pendiente' (requiere approval)
    - usuario.estado = 'pendiente' (no aprobado aún)
    """
    try:
        # 📋 LOG DE REQUEST: Capturar todos los datos recibidos
        logger.info(f"=== DRIVER REGISTRATION REQUEST ===")
        logger.info(f"Nombre: {data.nombre}")
        logger.info(f"Email: {data.email}")
        logger.info(f"DNI: {data.dni}")
        logger.info(f"Teléfono: {data.telefono}")
        logger.info(f"Organización ID: {data.organizacion_id}")
        logger.info(f"Tiene vehículo: {data.tiene_vehiculo}")
        logger.info(f"Patente: {data.patente}")
        logger.info(f"Licencia vencimiento: {data.licencia_vencimiento}")
        
        u_id = getattr(data, 'id', None) or str(uuid.uuid4())
        org_id = str(data.organizacion_id)

        # ✅ VALIDACIÓN CENTRALIZADA: Una sola llamada reemplaza todas las validaciones
        # Valida: org existe, acepta_registros_publicos, email único, DNI único, licencia vencimiento, patente, etc.
        logger.info(f"Starting validation for driver registration...")
        validar_registro_publico(data)
        logger.info(f"✓ All validations passed")

        # 1. Crear en usuarios (estado='pendiente' para registro público)
        logger.info(f"Creating user record in database...")
        supabase.table("usuarios").upsert({
            "id": u_id,
            "organizacion_id": org_id,
            "email": data.email,
            "nombre": data.nombre,
            "telefono": data.telefono,
            "direccion": data.direccion,
            "rol": "chofer",
            "estado": "pendiente"  # Requiere aprobación
        }, on_conflict="id").execute()
        logger.info(f"✓ User created: {u_id}")
        
        # 2. Asignar rol
        logger.info(f"Assigning chofer role...")
        supabase.table("user_roles").insert({
            "user_id": u_id,
            "role": "chofer"
        }).execute()
        logger.info(f"✓ Role assigned")

        # 3. Crear en choferes (estado_validacion='pendiente', todos los campos unificados)
        logger.info(f"Creating driver record in database...")
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
            "vehiculo": data.vehiculo if data.vehiculo is not None else "",
            "patente": data.patente if data.patente is not None else "",
            # Documentos
            "documentos": data.documentos,
            # Pago (valores por defecto para registro público)
            "tipo_pago": data.tipo_pago,
            "valor_pago": data.valor_pago,
            # Estado
            "estado_validacion": "pendiente"  # Requiere aprobación admin
        }).execute()
        logger.info(f"✓ Driver record created: {u_id}")

        # Enviar correos
        background_tasks.add_task(email_service.send_account_registered, data.email, data.nombre)
        background_tasks.add_task(email_service.send_admin_alert, data.email, data.nombre, data.telefono, "chofer")

        logger.info(f"✅ New driver registered: {u_id} in org: {org_id}, estado=pendiente")
        return {"status": "ok", "chofer": c_resp.data}
    except HTTPException as he:
        logger.error(f"❌ HTTP Exception during driver registration: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error during driver registration: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=f"Error en registro: {str(e)}")

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
