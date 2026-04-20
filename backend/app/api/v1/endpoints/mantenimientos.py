from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel
from uuid import UUID
import datetime

from app.core.security import get_current_titular, get_current_admin
from app.db.supabase import supabase

router = APIRouter()


class MantenimientoCreate(BaseModel):
    vehiculo_id: UUID
    tipo_mantenimiento: str
    kilometraje: Optional[int] = None
    fecha: str  # ISO date "2024-05-01"
    descripcion: Optional[str] = None
    costo: Optional[float] = 0.0
    estado: Optional[str] = "completado"


class MantenimientoUpdate(BaseModel):
    tipo_mantenimiento: Optional[str] = None
    kilometraje: Optional[int] = None
    fecha: Optional[str] = None
    descripcion: Optional[str] = None
    costo: Optional[float] = None
    estado: Optional[str] = None


@router.post("")
async def crear_mantenimiento(
    body: MantenimientoCreate,
    claims: Dict[str, Any] = Depends(get_current_titular)
):
    """Registra un nuevo servicio/mantenimiento para un vehículo del titular."""
    titular_id = claims.get("sub")
    org_id = claims.get("organizacion_id")

    # Validar propiedad del vehículo
    v_check = supabase.table("vehicles").select("id").eq("id", str(body.vehiculo_id)).eq("titular_id", titular_id).execute()
    if not v_check.data:
        raise HTTPException(status_code=403, detail="El vehículo no te pertenece o no existe.")

    res = supabase.table("mantenimientos").insert({
        "vehiculo_id": str(body.vehiculo_id),
        "organizacion_id": org_id,
        "tipo_mantenimiento": body.tipo_mantenimiento,
        "kilometraje": body.kilometraje,
        "fecha": body.fecha,
        "descripcion": body.descripcion,
        "costo": body.costo,
        "estado": body.estado,
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Error al registrar mantenimiento.")
    return res.data[0]


@router.get("")
async def listar_mantenimientos(
    vehiculo_id: Optional[str] = None,
    claims: Dict[str, Any] = Depends(get_current_titular)
):
    """Lista todos los mantenimientos del titular, opcionalmente filtrado por vehículo."""
    titular_id = claims.get("sub")

    query = supabase.table("mantenimientos")\
        .select("*, vehiculo:vehicles(marca, modelo, patente)")\
        .eq("organizacion_id", claims.get("organizacion_id"))

    # Filtrar solo vehículos del titular
    # usamos subquery vía vehicles
    if vehiculo_id:
        query = query.eq("vehiculo_id", vehiculo_id)

    res = query.order("fecha", desc=True).execute()

    # Filtrar del lado Python para asegurar que solo salen vehículos propios
    mis_vehicles = supabase.table("vehicles").select("id").eq("titular_id", titular_id).execute()
    mis_ids = {v["id"] for v in (mis_vehicles.data or [])}

    resultado = [m for m in (res.data or []) if m["vehiculo_id"] in mis_ids]
    return resultado


@router.put("/{mto_id}")
async def actualizar_mantenimiento(
    mto_id: UUID,
    body: MantenimientoUpdate,
    claims: Dict[str, Any] = Depends(get_current_titular)
):
    """Actualiza un registro de mantenimiento existente."""
    titular_id = claims.get("sub")

    # Verificar que le pertenece
    mto = supabase.table("mantenimientos").select("vehiculo_id").eq("id", str(mto_id)).execute()
    if not mto.data:
        raise HTTPException(status_code=404, detail="Mantenimiento no encontrado.")

    v_check = supabase.table("vehicles").select("id").eq("id", mto.data[0]["vehiculo_id"]).eq("titular_id", titular_id).execute()
    if not v_check.data:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este registro.")

    update_data = {k: v for k, v in body.dict().items() if v is not None}
    res = supabase.table("mantenimientos").update(update_data).eq("id", str(mto_id)).execute()
    return res.data[0] if res.data else {"status": "ok"}


@router.delete("/{mto_id}")
async def eliminar_mantenimiento(
    mto_id: UUID,
    claims: Dict[str, Any] = Depends(get_current_titular)
):
    """Elimina un registro de mantenimiento."""
    titular_id = claims.get("sub")

    mto = supabase.table("mantenimientos").select("vehiculo_id").eq("id", str(mto_id)).execute()
    if not mto.data:
        raise HTTPException(status_code=404, detail="Mantenimiento no encontrado.")

    v_check = supabase.table("vehicles").select("id").eq("id", mto.data[0]["vehiculo_id"]).eq("titular_id", titular_id).execute()
    if not v_check.data:
        raise HTTPException(status_code=403, detail="No tienes permiso.")

    supabase.table("mantenimientos").delete().eq("id", str(mto_id)).execute()
    return {"status": "deleted"}
