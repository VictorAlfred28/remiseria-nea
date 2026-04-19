"""
Módulo /vehicles — Gestión de vehículos con URL semántica.

Permisos:
  - titular → solo sus propios vehículos (GET, ver viajes/ubicación)
  - admin/superadmin → acceso total (crear, asignar chofer)

Notificaciones WhatsApp (BackgroundTasks):
  - POST /vehicles/create         → notifica al titular que se creó el vehículo
  - POST /vehicles/assign-driver  → notifica al chofer asignado
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.core.security import get_current_titular, get_current_admin
from app.core.evolution import send_whatsapp_message
from app.core.config import settings
from app.db.supabase import supabase

router = APIRouter()


# ============================================================
# Schemas
# ============================================================

class VehicleCreateRequest(BaseModel):
    titular_id: str
    marca: str
    modelo: str
    año: Optional[int] = None
    patente: str
    estado: Optional[str] = "activo"

class AssignDriverRequest(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None   # None = desasignar


# ============================================================
# GET /vehicles/my
# Solo vehículos donde el usuario autenticado es titular.
# ============================================================

@router.get("/my")
def get_my_vehicles(claims: Dict[str, Any] = Depends(get_current_titular)):
    """
    Retorna la flota completa del titular autenticado con datos del chofer asignado.
    """
    titular_id = claims.get("sub")

    resp = supabase.table("vehicles") \
        .select("*, driver:driver_id(id, nombre, telefono)") \
        .eq("titular_id", titular_id) \
        .order("created_at", desc=True) \
        .execute()

    return resp.data


# ============================================================
# POST /vehicles/create
# Solo admin crea vehículos; notifica al titular por WA.
# ============================================================

@router.post("/create")
def create_vehicle(
    data: VehicleCreateRequest,
    background_tasks: BackgroundTasks,
    claims: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Crea un vehículo y lo asocia a un titular existente.
    Valida:  - patente única (constraint DB)
             - titular pertenece a la organización del admin

    Notificación: WhatsApp al titular informando la alta del vehículo.
    """
    org_id = claims.get("organizacion_id")

    # 1. Validar que el titular exista en esta organización
    tit_resp = supabase.table("usuarios") \
        .select("id, nombre, telefono, rol") \
        .eq("id", data.titular_id) \
        .eq("organizacion_id", org_id) \
        .execute()

    if not tit_resp.data:
        raise HTTPException(status_code=404, detail="Titular no encontrado en esta organización.")

    titular = tit_resp.data[0]

    # 2. Normalizar patente (mayúsculas, sin espacios)
    patente = data.patente.upper().strip()

    # 3. Insertar vehículo — la constraint UNIQUE(patente) en DB rechaza duplicados
    try:
        v_resp = supabase.table("vehicles").insert({
            "organizacion_id": org_id,
            "titular_id": data.titular_id,
            "marca": data.marca,
            "modelo": data.modelo,
            "año": data.año,
            "patente": patente,
            "estado": data.estado,
        }).execute()
    except Exception as e:
        error_msg = str(e)
        # Detectar violación de patente única
        if "uq_vehicle_patente" in error_msg or "duplicate" in error_msg.lower():
            raise HTTPException(
                status_code=409,
                detail=f"La patente '{patente}' ya está registrada en el sistema."
            )
        raise HTTPException(status_code=500, detail=f"Error al crear el vehículo: {error_msg}")

    if not v_resp.data:
        raise HTTPException(status_code=500, detail="No se pudo crear el vehículo.")

    vehiculo = v_resp.data[0]

    # 4. Notificación WhatsApp al titular (background — no bloquea la respuesta)
    tel = titular.get("telefono", "")
    if tel:
        phone = tel.strip().replace(" ", "").replace("-", "")
        if not phone.endswith("@s.whatsapp.net"):
            phone = phone + "@s.whatsapp.net"

        msg = (
            f"🚗 *Nuevo vehículo registrado, {titular.get('nombre')}!*\n\n"
            f"Se asignó el siguiente vehículo a tu cuenta:\n"
            f"📋 *{data.marca} {data.modelo}* — Patente: *{patente}*\n\n"
            f"Podés verlo en tu panel: {settings.FRONTEND_URL}/cliente\n\n"
            f"Si tenés alguna consulta, contactá al administrador."
        )
        background_tasks.add_task(
            send_whatsapp_message,
            settings.EVOLUTION_INSTANCE,
            phone,
            msg
        )

    return vehiculo


# ============================================================
# POST /vehicles/assign-driver
# Solo admin asigna/desasigna; un chofer por vehículo.
# Notifica al chofer asignado por WA.
# ============================================================

@router.post("/assign-driver")
def assign_driver(
    data: AssignDriverRequest,
    background_tasks: BackgroundTasks,
    claims: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Asigna (o desasigna) un chofer a un vehículo.
    Reglas:
      - driver_id = UUID del usuario chofer → asigna
      - driver_id = null/omitido           → desasigna el chofer actual

    Validaciones:
      - El vehículo debe pertenecer a la organización del admin
      - El usuario a asignar debe tener rol 'chofer' en la organización
      - Un vehículo tiene un solo chofer activo (garantizado por columna single driver_id)

    Notificación: WhatsApp al chofer cuando es asignado.
    """
    org_id = claims.get("organizacion_id")

    # 1. Verificar vehículo en la organización
    v_resp = supabase.table("vehicles") \
        .select("id, patente, marca, modelo, titular_id") \
        .eq("id", data.vehicle_id) \
        .eq("organizacion_id", org_id) \
        .execute()

    if not v_resp.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado en esta organización.")

    vehicle = v_resp.data[0]
    driver_id = data.driver_id

    # 2. Si se asigna un chofer, validar rol
    driver_user = None
    if driver_id:
        u_resp = supabase.table("usuarios") \
            .select("id, nombre, telefono, rol") \
            .eq("id", driver_id) \
            .eq("organizacion_id", org_id) \
            .execute()

        if not u_resp.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado en esta organización.")

        driver_user = u_resp.data[0]
        if driver_user.get("rol") not in ["chofer", "admin", "superadmin"]:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El usuario '{driver_user.get('nombre')}' tiene rol '{driver_user.get('rol')}'. "
                    "Solo usuarios con rol 'chofer' pueden ser asignados a un vehículo."
                )
            )

    # 3. Actualizar asignación
    upd_resp = supabase.table("vehicles") \
        .update({"driver_id": driver_id}) \
        .eq("id", data.vehicle_id) \
        .execute()

    accion = "asignado" if driver_id else "desasignado"

    # 4. Notificación WhatsApp al chofer (solo cuando se asigna, no cuando se desasigna)
    if driver_user:
        tel = driver_user.get("telefono", "")
        if tel:
            phone = tel.strip().replace(" ", "").replace("-", "")
            if not phone.endswith("@s.whatsapp.net"):
                phone = phone + "@s.whatsapp.net"

            # Obtener datos del titular para el mensaje
            titular_resp = supabase.table("usuarios") \
                .select("nombre") \
                .eq("id", vehicle.get("titular_id")) \
                .execute()
            titular_nombre = titular_resp.data[0]["nombre"] if titular_resp.data else "El titular"

            msg = (
                f"🚗 *¡Nuevo vehículo asignado, {driver_user.get('nombre')}!*\n\n"
                f"Fuiste asignado al siguiente vehículo:\n"
                f"📋 *{vehicle.get('marca')} {vehicle.get('modelo')}* — Patente: *{vehicle.get('patente')}*\n"
                f"👤 Titular: *{titular_nombre}*\n\n"
                f"Podés verlo en tu panel: {settings.FRONTEND_URL}/chofer\n\n"
                f"Si tenés alguna consulta, contactá al administrador."
            )
            background_tasks.add_task(
                send_whatsapp_message,
                settings.EVOLUTION_INSTANCE,
                phone,
                msg
            )

    return {
        "message": f"Chofer {accion} correctamente.",
        "vehiculo": upd_resp.data[0] if upd_resp.data else {},
    }


# ============================================================
# GET /vehicles/{vehicle_id}/trips
# Accesible por el titular del vehículo o admin.
# NO modifica el sistema de viajes, solo lee.
# ============================================================

@router.get("/{vehicle_id}/trips")
def get_vehicle_trips(vehicle_id: str, claims: Dict[str, Any] = Depends(get_current_titular)):
    """
    Historial de viajes del chofer asignado al vehículo indicado.
    Cadena: vehicle.driver_id → choferes.usuario_id → choferes.id → viajes.chofer_id

    Accesible por el titular propietario o por admin/superadmin.
    """
    user_id = claims.get("sub")
    user_rol = claims.get("rol")

    # 1. Buscar el vehículo — admin ve cualquiera de su org; titular solo los suyos
    query = supabase.table("vehicles").select("driver_id, patente, marca, modelo")

    if user_rol in ["admin", "superadmin"]:
        org_id = claims.get("organizacion_id")
        query = query.eq("id", vehicle_id).eq("organizacion_id", org_id)
    else:
        # Titular: debe ser dueño
        query = query.eq("id", vehicle_id).eq("titular_id", user_id)

    v_resp = query.execute()

    if not v_resp.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado o acceso no autorizado.")

    vehicle = v_resp.data[0]
    driver_user_id = vehicle.get("driver_id")

    if not driver_user_id:
        return {
            "vehiculo": f"{vehicle.get('marca')} {vehicle.get('modelo')} ({vehicle.get('patente')})",
            "viajes": [],
            "mensaje": "Este vehículo no tiene un chofer asignado actualmente."
        }

    # 2. Resolver chofer_pk desde usuario_id del chofer
    ch_resp = supabase.table("choferes") \
        .select("id") \
        .eq("usuario_id", driver_user_id) \
        .execute()

    if not ch_resp.data:
        return {
            "vehiculo": f"{vehicle.get('marca')} {vehicle.get('modelo')} ({vehicle.get('patente')})",
            "viajes": [],
            "mensaje": "El chofer asignado no tiene perfil registrado en el sistema."
        }

    chofer_pk = ch_resp.data[0]["id"]

    # 3. Obtener viajes — SOLO LECTURA, sin tocar el sistema de viajes
    viajes_resp = supabase.table("viajes") \
        .select("id, estado, origen, destino, precio, final_price, creado_en, tipo_viaje, metodo_pago") \
        .eq("chofer_id", chofer_pk) \
        .order("creado_en", desc=True) \
        .limit(50) \
        .execute()

    return {
        "vehiculo": f"{vehicle.get('marca')} {vehicle.get('modelo')} ({vehicle.get('patente')})",
        "viajes": viajes_resp.data,
    }
