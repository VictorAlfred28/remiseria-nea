from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any
from app.db.supabase import supabase
from app.core.security import get_current_user

router = APIRouter()

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
    # Verificamos que sea un usuario o chofer
    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="No autorizado")

    try:
        orga_id = claims.get("organizacion_id")
        user_id = claims.get("sub")
        print(f"📡 [RADAR] Peticion Entrante: Lat={lat}, Lng={lng}, Radius={radius}, UserID={user_id}, OrgaID={orga_id}")
        
        # Llamamos al Remote Procedure Call (RPC) de Supabase
        res = supabase.rpc("get_viajes_cercanos", {
            "chofer_lat": lat,
            "chofer_lng": lng,
            "radius_km": radius,
            "target_orga_id": str(orga_id) if orga_id else None
        }).execute()
        
        results = res.data or []
        print(f"🛰️ [RADAR] RPC get_viajes_cercanos retorno {len(results)} resultados.")
        
        # --- NUEVA LOGICA DE DEPURACION ---
        if len(results) == 0:
            # 1. ¿Hay algún viaje en estado solicitado/REQUESTED en la base de datos?
            all_pending = supabase.table("viajes").select("id, estado, organizacion_id, origen").in_("estado", ["solicitado", "REQUESTED"]).limit(10).execute()
            print(f"🔍 [DEBUG-RADAR] Viajes pendientes totales en la DB: {len(all_pending.data or [])}")
            for v in (all_pending.data or []):
                print(f"   -> ID: {v['id']}, Estado: {v['estado']}, OrgaID: {v['organizacion_id']}, Origen Coords: {v['origen'].get('lat')}, {v['origen'].get('lng')}")
            
            # 2. Verificar la orga del chofer actual
            print(f"👤 [DEBUG-RADAR] Chofer OrgaID: {orga_id}")
        # ----------------------------------
            
        return results
    except Exception as e:
        print(f"❌ [RADAR-ERROR]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error consultando radar: {str(e)}")
