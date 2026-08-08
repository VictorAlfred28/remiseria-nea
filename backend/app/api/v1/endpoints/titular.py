from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List

from app.core.security import get_current_titular
from app.db.supabase import supabase

router = APIRouter()


# ===========================================================================
# GET /titular/vehiculos
# Lista todos los vehículos donde el usuario autenticado es titular.
# Incluye datos del chofer asignado (si existe).
# ===========================================================================

@router.get("/vehiculos")
def get_mis_vehiculos(claims: Dict[str, Any] = Depends(get_current_titular)):
    """
    Retorna la flota completa del titular autenticado.
    Cada vehículo incluye: datos básicos + chofer asignado (nombre, estado GPS).
    """
    titular_id = claims.get("sub")

    # 1. Vehículos con JOIN al usuario del chofer (puede ser NULL si no hay chofer asignado)
    resp = supabase.table("vehicles") \
        .select("*, driver:driver_id(id, nombre, telefono)") \
        .eq("titular_id", titular_id) \
        .order("created_at", desc=True) \
        .execute()

    return resp.data


# ===========================================================================
# GET /titular/vehiculos/{vehicle_id}
# Detalle de un vehículo con chofer + posición GPS actual del chofer.
# Reutiliza el campo lat/lng de la tabla choferes (sin duplicar tracking).
# ===========================================================================

@router.get("/vehiculos/{vehicle_id}")
def get_vehiculo_detalle(vehicle_id: str, claims: Dict[str, Any] = Depends(get_current_titular)):
    """
    Detalle completo de un vehículo:
      - Datos del vehículo
      - Datos del chofer asignado
      - Posición GPS actual (lat/lng desde tabla choferes, sin duplicar tracking)
    """
    titular_id = claims.get("sub")

    # 1. Verificar propiedad
    v_resp = supabase.table("vehicles") \
        .select("*, driver:driver_id(id, nombre, telefono)") \
        .eq("id", vehicle_id) \
        .eq("titular_id", titular_id) \
        .execute()

    if not v_resp.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado o no pertenece a este titular.")

    vehicle = v_resp.data[0]

    # 2. Si hay chofer asignado, enriquecer con su posición GPS actual
    #    Reutiliza el campo lat/lng ya guardado por PUT /chofer/ubicacion/actualizar
    ubicacion = None
    driver_info = vehicle.get("driver")
    if driver_info and driver_info.get("id"):
        ch_resp = supabase.table("choferes") \
            .select("lat, lng, estado") \
            .eq("usuario_id", driver_info["id"]) \
            .execute()

        if ch_resp.data:
            ubicacion = {
                "lat": ch_resp.data[0].get("lat"),
                "lng": ch_resp.data[0].get("lng"),
                "estado_chofer": ch_resp.data[0].get("estado"),
            }

    return {**vehicle, "ubicacion_actual": ubicacion}


# ===========================================================================
# GET /titular/vehiculos/{vehicle_id}/viajes
# Historial de viajes del chofer asignado a ese vehículo.
# NO modifica el sistema de viajes, solo los consulta.
# ===========================================================================

@router.get("/vehiculos/{vehicle_id}/viajes")
def get_vehiculo_viajes(vehicle_id: str, claims: Dict[str, Any] = Depends(get_current_titular)):
    """
    Historial de viajes del chofer que tiene asignado este vehículo.
    La cadena de relación es: vehicle.driver_id → choferes.usuario_id → choferes.id → viajes.chofer_id
    """
    titular_id = claims.get("sub")

    # 1. Verificar propiedad y obtener driver_id
    v_resp = supabase.table("vehicles") \
        .select("driver_id, patente") \
        .eq("id", vehicle_id) \
        .eq("titular_id", titular_id) \
        .execute()

    if not v_resp.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado o no pertenece a este titular.")

    driver_user_id = v_resp.data[0].get("driver_id")

    if not driver_user_id:
        return {"patente": v_resp.data[0].get("patente"), "viajes": [], "mensaje": "Sin chofer asignado."}

    # 2. Obtener el ID de la fila en `choferes` a partir del usuario del chofer
    ch_resp = supabase.table("choferes") \
        .select("id") \
        .eq("usuario_id", driver_user_id) \
        .execute()

    if not ch_resp.data:
        return {"patente": v_resp.data[0].get("patente"), "viajes": [], "mensaje": "Chofer sin perfil registrado."}

    chofer_pk = ch_resp.data[0]["id"]

    # 3. Consultar viajes — solo lectura, sin tocar el sistema de viajes
    viajes_resp = supabase.table("viajes") \
        .select("id, estado, origen, destino, precio, final_price, creado_en, tipo_viaje, metodo_pago") \
        .eq("chofer_id", chofer_pk) \
        .order("creado_en", desc=True) \
        .limit(50) \
        .execute()

    return {"patente": v_resp.data[0].get("patente"), "viajes": viajes_resp.data}


# ===========================================================================
# GET /titular/vehiculos/{vehicle_id}/ubicacion
# Posición GPS actual del chofer asignado al vehículo.
# Reutiliza los datos de choferes.lat/lng — NO duplica tracking.
# ===========================================================================

@router.get("/vehiculos/{vehicle_id}/ubicacion")
def get_vehiculo_ubicacion(vehicle_id: str, claims: Dict[str, Any] = Depends(get_current_titular)):
    """
    Retorna la última posición GPS conocida del chofer de este vehículo.
    Los datos son actualizados en tiempo real por el chofer via PUT /chofer/ubicacion/actualizar.
    Para tracking en vivo de un viaje específico, usar GET /public/viajes/{id}/tracking.
    """
    titular_id = claims.get("sub")

    # 1. Verificar propiedad y obtener driver_id
    v_resp = supabase.table("vehicles") \
        .select("driver_id, patente, marca, modelo") \
        .eq("id", vehicle_id) \
        .eq("titular_id", titular_id) \
        .execute()

    if not v_resp.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado o no pertenece a este titular.")

    vehicle = v_resp.data[0]
    driver_user_id = vehicle.get("driver_id")

    if not driver_user_id:
        raise HTTPException(status_code=409, detail="Este vehículo no tiene un chofer asignado.")

    # 2. Obtener posición GPS y estado del chofer
    ch_resp = supabase.table("choferes") \
        .select("lat, lng, estado, usuarios(nombre, telefono)") \
        .eq("usuario_id", driver_user_id) \
        .execute()

    if not ch_resp.data:
        raise HTTPException(status_code=404, detail="Perfil de chofer no encontrado.")

    chofer_data = ch_resp.data[0]
    chofer_usuario = chofer_data.get("usuarios") or {}

    return {
        "vehiculo": {
            "patente": vehicle.get("patente"),
            "marca": vehicle.get("marca"),
            "modelo": vehicle.get("modelo"),
        },
        "chofer": {
            "nombre": chofer_usuario.get("nombre"),
            "telefono": chofer_usuario.get("telefono"),
            "estado": chofer_data.get("estado"),
        },
        "gps": {
            "lat": chofer_data.get("lat"),
            "lng": chofer_data.get("lng"),
            "disponible": chofer_data.get("lat") is not None and chofer_data.get("lng") is not None,
        },
    }
