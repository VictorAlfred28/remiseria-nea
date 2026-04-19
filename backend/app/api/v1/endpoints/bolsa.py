from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from uuid import UUID

from app.core.security import get_current_titular, get_current_chofer, get_current_admin, get_current_user
from app.core.evolution import send_whatsapp_message
from app.core.config import settings
from app.db.supabase import supabase

router = APIRouter()

# ============================================================
# Schemas
# ============================================================

class OfertaCreate(BaseModel):
    vehicle_id: Optional[UUID] = None
    titulo: str
    descripcion: Optional[str] = None
    requisitos: Optional[str] = None

class PostulacionCreate(BaseModel):
    mensaje: Optional[str] = None

class PostulacionAction(BaseModel):
    mensaje_admin: Optional[str] = None


# ============================================================
# ENDPOINTS TITULARES
# ============================================================

@router.post("/ofertas")
async def crear_oferta(
    oferta: OfertaCreate, 
    claims: Dict[str, Any] = Depends(get_current_titular)
):
    """Crea una vacante para un vehículo."""
    titular_id = claims.get("sub")
    org_id = claims.get("organizacion_id")
    
    # 1. Si hay vehicle_id, validar que pertenezca al titular
    if oferta.vehicle_id:
        v_check = supabase.table("vehicles").select("id").eq("id", str(oferta.vehicle_id)).eq("titular_id", titular_id).execute()
        if not v_check.data:
            raise HTTPException(status_code=403, detail="El vehículo no te pertenece.")

    # 2. Insertar oferta
    res = supabase.table("bolsa_empleos").insert({
        "organizacion_id": org_id,
        "titular_id": titular_id,
        "vehicle_id": str(oferta.vehicle_id) if oferta.vehicle_id else None,
        "titulo": oferta.titulo,
        "descripcion": oferta.descripcion,
        "requisitos": oferta.requisitos,
        "estado": "abierta"
    }).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Error al crear la oferta.")
        
    return res.data[0]

@router.get("/mis-ofertas")
async def get_mis_ofertas(claims: Dict[str, Any] = Depends(get_current_titular)):
    """Lista las ofertas del titular con sus postulaciones."""
    titular_id = claims.get("sub")
    
    # Obtenemos ofertas con postulaciones (JOIN)
    res = supabase.table("bolsa_empleos")\
        .select("*, vehicles(marca, modelo, patente), postulaciones:bolsa_postulaciones(*, chofer:usuarios(nombre, telefono))")\
        .eq("titular_id", titular_id)\
        .execute()
        
    return res.data

@router.delete("/ofertas/{oferta_id}")
async def eliminar_oferta(oferta_id: UUID, claims: Dict[str, Any] = Depends(get_current_titular)):
    """Elimina o cierra una oferta."""
    titular_id = claims.get("sub")
    
    # Solo puede borrar si es suya
    res = supabase.table("bolsa_empleos").delete().eq("id", str(oferta_id)).eq("titular_id", titular_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Oferta no encontrada o no tienes permiso.")
        
    return {"status": "deleted"}


# ============================================================
# ENDPOINTS CHOFERES
# ============================================================

@router.get("/ofertas")
async def get_ofertas_abiertas(claims: Dict[str, Any] = Depends(get_current_chofer)):
    """Lista todas las vacantes abiertas en la organización."""
    org_id = claims.get("organizacion_id")
    
    res = supabase.table("bolsa_empleos")\
        .select("*, titular:usuarios(nombre, telefono), vehicle:vehicles(marca, modelo, patente)")\
        .eq("organizacion_id", org_id)\
        .eq("estado", "abierta")\
        .execute()
        
    return res.data

@router.post("/ofertas/{oferta_id}/aplicar")
async def postularse(
    oferta_id: UUID, 
    post: PostulacionCreate, 
    claims: Dict[str, Any] = Depends(get_current_chofer)
):
    """Chofer se postula a una vacante."""
    chofer_id = claims.get("sub")
    
    # 1. Validar que la oferta exista y esté abierta
    o_check = supabase.table("bolsa_empleos").select("estado").eq("id", str(oferta_id)).execute()
    if not o_check.data or o_check.data[0]["estado"] != "abierta":
        raise HTTPException(status_code=400, detail="Oferta cerrada o no disponible.")
        
    # 2. Upsert postulación
    try:
        res = supabase.table("bolsa_postulaciones").upsert({
            "oferta_id": str(oferta_id),
            "chofer_id": chofer_id,
            "mensaje": post.mensaje,
            "estado": "pendiente"
        }).execute()
        return res.data[0]
    except Exception:
        raise HTTPException(status_code=400, detail="Ya te has postulado a esta vacante.")

@router.get("/mis-postulaciones")
async def get_mis_postulaciones(claims: Dict[str, Any] = Depends(get_current_chofer)):
    """Historial de postulaciones del chofer."""
    chofer_id = claims.get("sub")
    
    res = supabase.table("bolsa_postulaciones")\
        .select("*, oferta:bolsa_empleos(*, titular:usuarios(nombre), vehicle:vehicles(marca, modelo, patente))")\
        .eq("chofer_id", chofer_id)\
        .execute()
        
    return res.data


# ============================================================
# ENDPOINTS ADMIN (MEDIACIÓN)
# ============================================================

@router.get("/admin/ofertas")
async def admin_get_todo(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Admin ve todo el movimiento de la bolsa."""
    org_id = claims.get("organizacion_id")
    
    res = supabase.table("bolsa_empleos")\
        .select("*, titular:usuarios(nombre), vehicle:vehicles(marca, modelo, patente), postulaciones:bolsa_postulaciones(*, chofer:usuarios(id, nombre, telefono, email))")\
        .eq("organizacion_id", org_id)\
        .order("created_at", desc=True)\
        .execute()
        
    return res.data

@router.post("/admin/postulaciones/{post_id}/aprobar")
async def aprobar_postulacion(
    post_id: UUID, 
    bg: BackgroundTasks,
    action: PostulacionAction,
    claims: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Aprueba postulación → Asigna chofer al vehículo → Cierra oferta.
    """
    admin_id = claims.get("sub")
    
    # 1. Obtener datos de la postulación y oferta
    p_res = supabase.table("bolsa_postulaciones")\
        .select("*, chofer:usuarios(id, nombre, telefono), oferta:bolsa_empleos(*, titular:usuarios(nombre, telefono))")\
        .eq("id", str(post_id))\
        .single()\
        .execute()
        
    if not p_res.data:
        raise HTTPException(status_code=404, detail="Postulación no encontrada.")
        
    post = p_res.data
    chofer = post["chofer"]
    oferta = post["oferta"]
    vehicle_id = oferta["vehicle_id"]
    
    if not vehicle_id:
        raise HTTPException(status_code=400, detail="La oferta no tiene un vehículo asociado para asignar.")

    # 2. Transacción de cierre (Simulada via updates secuenciales)
    # 2a. Asignar chofer al vehículo
    v_res = supabase.table("vehicles").update({"driver_id": chofer["id"]}).eq("id", vehicle_id).execute()
    
    # 2b. Aprobar postulación
    supabase.table("bolsa_postulaciones").update({
        "estado": "aprobado", 
        "aprobado_por": admin_id
    }).eq("id", str(post_id)).execute()
    
    # 2c. Rechazar el resto de postulaciones para esta oferta
    supabase.table("bolsa_postulaciones").update({"estado": "rechazado"})\
        .eq("oferta_id", oferta["id"])\
        .neq("id", str(post_id))\
        .execute()
        
    # 2d. Cerrar oferta
    supabase.table("bolsa_empleos").update({"estado": "cerrada"}).eq("id", oferta["id"]).execute()

    # 3. Notificaciones WhatsApp
    instance = "principal" # o settings.EVOLUTION_INSTANCE_NAME si existe
    
    # Al Chofer
    msg_chofer = f"✨ ¡Felicidades {chofer['nombre']}! Tu postulación ha sido APROBADA por administración. Se te ha asignado al vehículo con patente {v_res.data[0]['patente']}. Contactate con tu titular {oferta['titular']['nombre']}."
    bg.add_task(send_whatsapp_message, instance, chofer["telefono"], msg_chofer)
    
    # Al Titular
    msg_titular = f"✅ Administración ha asignado un chofer para tu vacante: {chofer['nombre']} ya figura como conductor oficial de tu vehículo {v_res.data[0]['patente']}."
    bg.add_task(send_whatsapp_message, instance, oferta["titular"]["telefono"], msg_titular)

    return {"status": "approved", "vehicle": v_res.data[0]}

@router.post("/admin/postulaciones/{post_id}/rechazar")
async def rechazar_postulacion(
    post_id: UUID, 
    action: PostulacionAction,
    claims: Dict[str, Any] = Depends(get_current_admin)
):
    """Rechaza una postulación individual."""
    supabase.table("bolsa_postulaciones").update({"estado": "rechazado"}).eq("id", str(post_id)).execute()
    return {"status": "rejected"}
