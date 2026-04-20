from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any
from app.db.supabase import supabase
from app.core.security import get_current_user
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/")
@router.get("")
def get_viajes_radar(
    lat: float = Query(..., description="Latitud actual del chofer"),
    lng: float = Query(..., description="Longitud actual del chofer"),
    radius: int = Query(10, description="Radio de búsqueda en KM"),
    claims: Dict[str, Any] = Depends(get_current_user)
):
    """
    Obtiene los viajes cercanos en estado 'solicitado' utilizando 
    la función geográfica de Supabase (PostGIS), aislando los datos 
    del alcance global de canales en tiempo real.
    """
    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="No autorizado")

    try:
        orga_id = claims.get("organizacion_id")
        logger.debug("RADAR request: lat=%s lng=%s radius=%s org=%s", lat, lng, radius, orga_id)

        res = supabase.rpc("get_viajes_cercanos", {
            "chofer_lat": lat,
            "chofer_lng": lng,
            "radius_km": radius,
            "target_orga_id": str(orga_id) if orga_id else None
        }).execute()

        results = res.data or []
        logger.debug("RADAR: %d viajes cercanos encontrados", len(results))

        return results
    except Exception as e:
        logger.error("RADAR error: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error consultando radar: {str(e)}")

