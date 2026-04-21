from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel
from uuid import UUID

from app.core.security import get_current_user, get_current_titular, get_current_chofer
from app.db.supabase import supabase

router = APIRouter()


class TramiteCreate(BaseModel):
    tipo_tramite: str                  # seguro | vtv | licencia | cedula | otro
    fecha_emision: Optional[str] = None
    fecha_vencimiento: str             # ISO "2025-01-01"
    archivo_url: Optional[str] = None
    estado: Optional[str] = "vigente"
    vehiculo_id: Optional[str] = None  # UUID como string
    chofer_id: Optional[str] = None    # UUID como string


class TramiteUpdate(BaseModel):
    tipo_tramite: Optional[str] = None
    fecha_emision: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    archivo_url: Optional[str] = None
    estado: Optional[str] = None


@router.post("")
async def crear_tramite(
    body: TramiteCreate,
    claims: Dict[str, Any] = Depends(get_current_user)
):
    """
    Crea un trámite/documento de habilitación.
    Puede ser para un vehículo (titular) o para un chofer (él mismo).
    """
    user_id = claims.get("sub")
    org_id = claims.get("organizacion_id")
    rol = claims.get("rol", "")

    # Validar que el vehiculo perteneca al titular (si se indica vehiculo)
    if body.vehiculo_id and rol not in ("admin", "superadmin"):
        v_check = supabase.table("vehicles").select("id").eq("id", body.vehiculo_id).eq("titular_id", user_id).execute()
        if not v_check.data:
            raise HTTPException(status_code=403, detail="El vehículo no te pertenece.")

    # Chofer solo puede crear trámites de sí mismo
    resolved_chofer_id = body.chofer_id
    if rol == "chofer":
        resolved_chofer_id = user_id

    res = supabase.table("tramites").insert({
        "organizacion_id": org_id,
        "vehiculo_id": body.vehiculo_id,
        "chofer_id": resolved_chofer_id,
        "tipo_tramite": body.tipo_tramite,
        "fecha_emision": body.fecha_emision,
        "fecha_vencimiento": body.fecha_vencimiento,
        "archivo_url": body.archivo_url,
        "estado": body.estado,
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Error al registrar el trámite.")
    return res.data[0]


@router.get("")
async def listar_tramites(
    vehiculo_id: Optional[str] = None,
    chofer_id: Optional[str] = None,
    claims: Dict[str, Any] = Depends(get_current_user)
):
    """Lista los trámites del usuario autenticado (titular ve los de sus autos, chofer los suyos)."""
    user_id = claims.get("sub")
    org_id = claims.get("organizacion_id")
    rol = claims.get("rol", "")

    query = supabase.table("tramites")\
        .select("*, vehiculo:vehicles(marca, modelo, patente)")\
        .eq("organizacion_id", org_id)

    if vehiculo_id:
        query = query.eq("vehiculo_id", vehiculo_id)
    if chofer_id:
        query = query.eq("chofer_id", chofer_id)

    # Scope de rol
    if rol == "chofer":
        query = query.eq("chofer_id", user_id)
    elif rol == "titular":
        # ver solo los de SUS vehículos
        mis_vehicles = supabase.table("vehicles").select("id").eq("titular_id", user_id).execute()
        mis_ids = [v["id"] for v in (mis_vehicles.data or [])]
        if not mis_ids:
            return []
        # Filtramos: tramite del chofer propio O de alguno de mis vehículos
        res = query.order("fecha_vencimiento").execute()
        return [t for t in (res.data or []) if t.get("vehiculo_id") in mis_ids or t.get("chofer_id") == user_id]

    res = query.order("fecha_vencimiento").execute()
    return res.data or []


@router.put("/{tramite_id}")
async def actualizar_tramite(
    tramite_id: UUID,
    body: TramiteUpdate,
    claims: Dict[str, Any] = Depends(get_current_user)
):
    """Actualiza datos de un trámite (útil para renovar un documento o cambiar estado)."""
    from fastapi.encoders import jsonable_encoder
    update_data = {k: v for k, v in jsonable_encoder(body).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nada que actualizar.")
    res = supabase.table("tramites").update(update_data).eq("id", str(tramite_id)).execute()
    return res.data[0] if res.data else {"status": "ok"}


@router.delete("/{tramite_id}")
async def eliminar_tramite(
    tramite_id: UUID,
    claims: Dict[str, Any] = Depends(get_current_user)
):
    """Elimina un trámite."""
    supabase.table("tramites").delete().eq("id", str(tramite_id)).execute()
    return {"status": "deleted"}
