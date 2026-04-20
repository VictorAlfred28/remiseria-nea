from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any, List, Optional
import secrets
import string

from app.core.security import get_current_admin
from app.db.supabase import supabase
from app.schemas.domain import Chofer, Promocion
from pydantic import BaseModel, EmailStr

router = APIRouter()

class ChoferCreate(BaseModel):
    nombre: str
    email: EmailStr
    telefono: str
    vehiculo: str
    patente: str
    dni: str
    tipo_pago: str = "comision" # 'base' o 'comision'
    valor_pago: float = 0.0

class ChoferResponse(BaseModel):
    id: str
    nombre: str
    email: str
    password_temporal: str

@router.post("/chofer", response_model=ChoferResponse)
def create_chofer(data: ChoferCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Carga de un nuevo Chofer por parte del Administrador.
    Genera clave automática y asocia los perfiles correspondientes.
    """
    org_id = claims.get("organizacion_id")
    
    # 1. Generar Contraseña Aleatoria Compleja
    alphabet = string.ascii_letters + string.digits
    password = "Nea" + ''.join(secrets.choice(alphabet) for i in range(6)) + "!"

    # 2. Crear Auth User en Supabase (Requiere Service Role configurado en .env)
    try:
        auth_res = supabase.auth.admin.create_user({
            "email": data.email,
            "password": password,
            "email_confirm": True
        })
        user_id = auth_res.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo crear en Auth: {str(e)}")

    # 3. Insertar Perfil Usuario (como Chofer)
    try:
        supabase.table("usuarios").insert({
            "id": user_id,
            "organizacion_id": org_id,
            "email": data.email,
            "nombre": data.nombre,
            "telefono": data.telefono,
            "rol": "chofer"
        }).execute()
    except Exception as e:
        # Rollback: borrar Auth user si falla usuarios
        try:
            supabase.auth.admin.delete_user(user_id)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Falla creando perfil de usuario: {str(e)}")

    # 4. Insertar Perfil Chofer (Vehículo y Pago)
    try:
        chofer_insert = supabase.table("choferes").insert({
            "organizacion_id": org_id,
            "usuario_id": user_id,
            "vehiculo": data.vehiculo,
            "patente": data.patente,
            "dni": data.dni,
            "estado": "inactivo",
            "estado_validacion": "aprobado",  # Por admin se aprueba directo
            "tipo_pago": data.tipo_pago,
            "valor_pago": data.valor_pago
        }).execute()
        
        return ChoferResponse(
            id=chofer_insert.data[0]["id"],
            nombre=data.nombre,
            email=data.email,
            password_temporal=password
        )

    except Exception as e:
        # Rollback completo: borrar choferes (si se insertó parcial) → usuarios → Auth
        try:
            supabase.table("choferes").delete().eq("usuario_id", user_id).execute()
        except:
            pass
        try:
            supabase.table("usuarios").delete().eq("id", user_id).execute()
        except:
            pass
        try:
            supabase.auth.admin.delete_user(user_id)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Falla insertando perfil chofer: {str(e)}")


@router.get("/choferes")
def get_choferes(claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Obtener todos los choferes con detalles de usuario (nombre, email, etc.)
    """
    org_id = claims.get("organizacion_id")
    response = supabase.table("choferes") \
        .select("*, usuarios(nombre, email, telefono)") \
        .eq("organizacion_id", org_id) \
        .execute()
    return response.data

@router.get("/choferes/pendientes")
def get_choferes_pendientes(claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Obtener todos los choferes en estado pendiente.
    """
    org_id = claims.get("organizacion_id")
    response = supabase.table("choferes") \
        .select("*, usuarios(nombre, email, telefono, direccion)") \
        .eq("organizacion_id", org_id) \
        .eq("estado_validacion", "pendiente") \
        .execute()
    return response.data

from app.core.evolution import send_whatsapp_message
from app.core.config import settings

@router.post("/choferes/{chofer_id}/aprobar")
def aprobar_chofer(chofer_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Aprueba un chofer pendiente.
    """
    org_id = claims.get("organizacion_id")
    c_check = supabase.table("choferes").select("id, usuario_id, usuarios(telefono, nombre)").eq("id", chofer_id).eq("organizacion_id", org_id).single().execute()
    if not c_check.data:
        raise HTTPException(status_code=404, detail="Chofer no encontrado")
        
    u_id = c_check.data["usuario_id"]
    telefono = c_check.data["usuarios"]["telefono"] if c_check.data.get("usuarios") else None
    nombre = c_check.data["usuarios"]["nombre"] if c_check.data.get("usuarios") else "Chofer"

    # Actualizar estado_validacion en choferes
    # Nota: El estado debe ser 'disponible' para cumplir con el check constraint (disponible, ocupado, inactivo)
    supabase.table("choferes").update({"estado_validacion": "aprobado", "estado": "disponible"}).eq("id", chofer_id).execute()
    # Actualizar estado y activo en usuarios
    supabase.table("usuarios").update({"estado": "aprobado", "activo": True}).eq("id", u_id).execute()

    if telefono:
        msg = f"🎉 ¡Felicidades {nombre}! Tu solicitud para ser chofer en Viajes NEA ha sido APROBADA. 🚖\n\nYa puedes iniciar sesión en la aplicación con tu correo y contraseña."
        def _send_sync_admin():
            import asyncio
            asyncio.run(send_whatsapp_message("Viejes-Nea", telefono, msg))
        background_tasks.add_task(_send_sync_admin)

    return {"message": "Chofer aprobado exitosamente"}

@router.post("/choferes/{chofer_id}/rechazar")
def rechazar_chofer(chofer_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Rechaza un chofer pendiente.
    """
    org_id = claims.get("organizacion_id")
    c_check = supabase.table("choferes").select("id, usuario_id, usuarios(telefono, nombre)").eq("id", chofer_id).eq("organizacion_id", org_id).single().execute()
    if not c_check.data:
        raise HTTPException(status_code=404, detail="Chofer no encontrado")
        
    u_id = c_check.data["usuario_id"]
    telefono = c_check.data["usuarios"]["telefono"] if c_check.data.get("usuarios") else None
    nombre = c_check.data["usuarios"]["nombre"] if c_check.data.get("usuarios") else "Chofer"

    supabase.table("choferes").update({"estado_validacion": "rechazado"}).eq("id", chofer_id).execute()
    supabase.table("usuarios").update({"estado": "rechazado", "activo": False}).eq("id", u_id).execute()

    if telefono:
        msg = f"Hola {nombre}. Lamentamos informarte que tu solicitud para ser chofer en Viajes NEA ha sido RECHAZADA. ❌\n\nPor favor, contacta a la administración para más detalles."
        def _send_sync_admin():
            import asyncio
            asyncio.run(send_whatsapp_message("Viejes-Nea", telefono, msg))
        background_tasks.add_task(_send_sync_admin)

    return {"message": "Chofer rechazado"}


class ChoferUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    vehiculo: Optional[str] = None
    patente: Optional[str] = None
    dni: Optional[str] = None
    tipo_pago: Optional[str] = None
    valor_pago: Optional[float] = None
    activo: Optional[bool] = None

@router.put("/chofer/{chofer_id}")
def update_chofer(chofer_id: str, data: ChoferUpdate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Actualizar datos de un chofer y su perfil de usuario asociado.
    """
    org_id = claims.get("organizacion_id")
    
    # 1. Verificar existencia y pertenencia
    c_check = supabase.table("choferes").select("id, usuario_id").eq("id", chofer_id).eq("organizacion_id", org_id).single().execute()
    if not c_check.data:
        raise HTTPException(status_code=404, detail="Chofer no encontrado o no pertenece a su organización")
    
    u_id = c_check.data["usuario_id"]

    # 2. Actualizar Tabla Usuarios
    u_update = {}
    if data.nombre: u_update["nombre"] = data.nombre
    if data.email: u_update["email"] = data.email
    if data.telefono: u_update["telefono"] = data.telefono
    if data.activo is not None: u_update["activo"] = data.activo
    
    if u_update:
        supabase.table("usuarios").update(u_update).eq("id", u_id).execute()
        # Si cambia el email, actualizar en Auth también
        if data.email:
            try:
                supabase.auth.admin.update_user_by_id(u_id, {"email": data.email})
            except:
                pass

    # 3. Actualizar Tabla Choferes
    c_update = {}
    if data.vehiculo: c_update["vehiculo"] = data.vehiculo
    if data.patente: c_update["patente"] = data.patente
    if data.dni: c_update["dni"] = data.dni
    if data.tipo_pago: c_update["tipo_pago"] = data.tipo_pago
    if data.valor_pago is not None: c_update["valor_pago"] = data.valor_pago
    
    if c_update:
        supabase.table("choferes").update(c_update).eq("id", chofer_id).execute()

    return {"message": "Chofer actualizado correctamente"}

@router.delete("/chofer/{chofer_id}")
def delete_chofer(chofer_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Eliminar un chofer de forma definitiva (DDBB + Auth).
    """
    org_id = claims.get("organizacion_id")
    
    # 1. Obtener usuario_id antes de borrar
    c_data = supabase.table("choferes").select("id, usuario_id").eq("id", chofer_id).eq("organizacion_id", org_id).single().execute()
    if not c_data.data:
        raise HTTPException(status_code=404, detail="Chofer no encontrado")
        
    u_id = c_data.data["usuario_id"]

    # 2. Borrar Chofer (La tabla tiene FK a usuarios cascade? si no, borrar manual)
    supabase.table("choferes").delete().eq("id", chofer_id).execute()
    
    # 3. Borrar Perfil Usuario
    supabase.table("usuarios").delete().eq("id", u_id).execute()
    
    # 4. Borrar de Auth (Para evitar que siga logueado o use recursos)
    try:
        supabase.auth.admin.delete_user(u_id)
    except:
        pass

    return {"message": "Chofer y usuario eliminados correctamente"}

@router.post("/promociones", response_model=Promocion)
def create_promocion(promo_data: dict, claims: Dict[str, Any] = Depends(get_current_admin)):
    org_id = claims.get("organizacion_id")
    promo_data["organizacion_id"] = org_id
    response = supabase.table("promociones").insert(promo_data).execute()
    return response.data[0]

class PagoRequest(BaseModel):
    monto: float
    tipo: str
    descripcion: Optional[str] = ""

@router.post("/chofer/{chofer_id}/pago")
def registrar_pago(chofer_id: str, data: PagoRequest, claims: Dict[str, Any] = Depends(get_current_admin)):
    org_id = claims.get("organizacion_id")
    
    # 1. Obtener Chofer
    c_resp = supabase.table("choferes").select("*").eq("id", chofer_id).execute()
    if not c_resp.data:
        raise HTTPException(status_code=404, detail="Chofer no encontrado")
    
    chofer = c_resp.data[0]
    nuevo_saldo = float(chofer.get("saldo", 0)) + data.monto
    
    # 2. Registrar el historial de pago
    supabase.table("movimientos_saldo").insert({
        "organizacion_id": org_id,
        "chofer_id": chofer_id,
        "monto": data.monto,
        "tipo": data.tipo,
        "descripcion": data.descripcion
    }).execute()
    
    # 3. Actualizar saldo del chofer
    u_resp = supabase.table("choferes").update({"saldo": nuevo_saldo}).eq("id", chofer_id).execute()
    
    return {"message": "Pago registrado con éxito", "nuevo_saldo": nuevo_saldo}

@router.get("/clientes")
def get_clientes(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Lista todos los clientes de la organización con sus puntos."""
    org_id = claims.get("organizacion_id")
    resp = supabase.table("usuarios").select("*").eq("organizacion_id", org_id).eq("rol", "cliente").execute()
    return resp.data

@router.get("/clientes/puntos")
def get_clientes_puntos(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Alias para proveer los puntos de los clientes a la UI y evitar 404."""
    return get_clientes(claims)

class PointsUpdate(BaseModel):
    puntos: Optional[int] = None
    viajes_gratis: Optional[int] = None

@router.put("/cliente/{usuario_id}/puntos")
def update_cliente_puntos(usuario_id: str, data: PointsUpdate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Actualiza manualmente los puntos o viajes gratis de un cliente."""
    org_id = claims.get("organizacion_id")
    
    # Validar que el usuario pertenece a la org
    check = supabase.table("usuarios").select("id").eq("id", usuario_id).eq("organizacion_id", org_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_dict = {}
    if data.puntos is not None: update_dict["puntos_actuales"] = data.puntos
    if data.viajes_gratis is not None: update_dict["viajes_gratis"] = data.viajes_gratis
    
    if update_dict:
        supabase.table("usuarios").update(update_dict).eq("id", usuario_id).execute()
        
        # Registrar en historial
        supabase.table("historial_puntos").insert({
            "user_id": usuario_id,
            "puntos": data.puntos if data.puntos is not None else 0,
            "tipo": "ACUMULACION" if (data.puntos or 0) >= 0 else "CANJE",
            "descripcion": "Ajuste manual por administrador"
        }).execute()

    return {"message": "Puntos actualizados"}

# ---- MODULO EMPRESARIAL ----

class EmpresaCreate(BaseModel):
    nombre_empresa: str
    cuit: Optional[str] = None
    activo: Optional[bool] = True

@router.get("/empresas")
def get_empresas(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Listado de todas las empresas (con sus beneficios si los tienen)."""
    org_id = claims.get("organizacion_id")
    resp = supabase.table("empresas").select("*, empresa_beneficios(*)").eq("organizacion_id", org_id).execute()
    return resp.data

@router.post("/empresas")
def create_empresa(data: EmpresaCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Crea una nueva empresa."""
    org_id = claims.get("organizacion_id")
    resp = supabase.table("empresas").insert({
        "organizacion_id": org_id,
        "nombre_empresa": data.nombre_empresa,
        "cuit": data.cuit,
        "activo": data.activo
    }).execute()
    return resp.data[0]

@router.put("/empresas/{empresa_id}")
def update_empresa(empresa_id: str, data: EmpresaCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    org_id = claims.get("organizacion_id")
    resp = supabase.table("empresas").update({
        "nombre_empresa": data.nombre_empresa,
        "cuit": data.cuit,
        "activo": data.activo
    }).eq("id", empresa_id).eq("organizacion_id", org_id).execute()
    return resp.data[0] if resp.data else {}

class BeneficioCreate(BaseModel):
    tipo_descuento: str # PORCENTAJE o FIJO
    valor: float
    limite_mensual: Optional[int] = 0
    horario_inicio: Optional[str] = None
    horario_fin: Optional[str] = None
    activo: Optional[bool] = True

@router.post("/empresas/{empresa_id}/beneficios")
def set_empresa_beneficio(empresa_id: str, data: BeneficioCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Crea o actualiza el beneficio de una empresa (por defecto asumimos 1 beneficio por empresa en esta versión)."""
    # Check if exists
    ben_resp = supabase.table("empresa_beneficios").select("id").eq("empresa_id", empresa_id).execute()
    
    payload = {
        "empresa_id": empresa_id,
        "tipo_descuento": data.tipo_descuento,
        "valor": data.valor,
        "limite_mensual": data.limite_mensual,
        "horario_inicio": data.horario_inicio,
        "horario_fin": data.horario_fin,
        "activo": data.activo
    }
    
    if ben_resp.data:
        resp = supabase.table("empresa_beneficios").update(payload).eq("id", ben_resp.data[0]["id"]).execute()
    else:
        resp = supabase.table("empresa_beneficios").insert(payload).execute()
        
    return resp.data[0] if resp.data else {}

class EmpresaUserCreate(BaseModel):
    user_id: str
    limite_mensual: Optional[float] = 0

@router.post("/empresas/{empresa_id}/usuarios")
def add_empresa_usuario(empresa_id: str, data: EmpresaUserCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    # Check si el usuario ya esta en otra empresa
    eu_check = supabase.table("empresa_usuarios").select("*").eq("user_id", data.user_id).execute()
    if eu_check.data:
        raise HTTPException(status_code=400, detail="El usuario ya pertenece a una empresa.")
        
    resp = supabase.table("empresa_usuarios").insert({
        "empresa_id": empresa_id,
        "user_id": data.user_id,
        "limite_mensual": data.limite_mensual,
        "activo": True
    }).execute()
    return resp.data[0] if resp.data else {}

@router.delete("/empresas/{empresa_id}/usuarios/{user_id}")
def remove_empresa_usuario(empresa_id: str, user_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    supabase.table("empresa_usuarios").delete().eq("empresa_id", empresa_id).eq("user_id", user_id).execute()
    return {"status": "ok"}

@router.get("/empresas/{empresa_id}/usuarios")
def get_empresa_usuarios(empresa_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    resp = supabase.table("empresa_usuarios").select("*, usuarios(id, nombre, email)").eq("empresa_id", empresa_id).execute()
    return resp.data

class PagoEmpresaRequest(BaseModel):
    monto: float
    metodo_pago: str
    observaciones: Optional[str] = ""

@router.get("/empresas/{empresa_id}/movimientos")
def get_empresa_movimientos(empresa_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    resp = supabase.table("cuenta_corriente_empresas").select("*").eq("empresa_id", empresa_id).order("creado_en", desc=True).execute()
    return resp.data

@router.post("/empresas/{empresa_id}/pagos")
def registrar_pago_empresa(empresa_id: str, payload: PagoEmpresaRequest, claims: Dict[str, Any] = Depends(get_current_admin)):
    # 1. Obtenemos saldo actual
    em_resp = supabase.table("empresas").select("saldo").eq("id", empresa_id).execute()
    if not em_resp.data:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    saldo_actual = float(em_resp.data[0].get("saldo") or 0)
    nuevo_saldo = saldo_actual - payload.monto # Saldo es deuda, el pago resta
    
    # 2. Actualizamos saldo
    supabase.table("empresas").update({"saldo": nuevo_saldo}).eq("id", empresa_id).execute()
    
    # 3. Registramos CREDITO
    insert_resp = supabase.table("cuenta_corriente_empresas").insert({
        "empresa_id": empresa_id,
        "tipo": "CREDITO",
        "monto": payload.monto,
        "descripcion": payload.observaciones or f"Pago via {payload.metodo_pago}",
        "metodo_pago": payload.metodo_pago
    }).execute()
    
    return {"message": "Pago registrado con éxito", "nuevo_saldo": nuevo_saldo, "movimiento": insert_resp.data[0]}

# === NUEVO MÓDULO: REVISIÓN DE PAGOS DE CHOFERES ===

@router.get("/pagos_manuales")
def get_pagos_manuales(estado: Optional[str] = None, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Lista todos los pagos subidos por los choferes (comprobantes)."""
    org_id = claims.get("organizacion_id")
    query = supabase.table("pagos_chofer").select("*, choferes(usuarios(nombre, email, telefono))").eq("organizacion_id", org_id)
    if estado:
        query = query.eq("estado", estado.upper())
        
    resp = query.order("fecha_pago", desc=True).execute()
    return resp.data

class PagoRechazoRequest(BaseModel):
    observaciones: str

@router.put("/pagos_manuales/{pago_id}/aprobar")
def aprobar_pago_manual(pago_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Aprueba el pago y asocia admin."""
    admin_id = claims.get("sub")
    import datetime
    
    # 1. Update de la tabla pagos_chofer
    update_resp = supabase.table("pagos_chofer").update({
        "estado": "APROBADO",
        "fecha_validacion": datetime.datetime.now().isoformat(),
        "admin_id": admin_id
    }).eq("id", pago_id).execute()
    
    if not update_resp.data:
        raise HTTPException(status_code=404, detail="Pago no encontrado.")
        
    # (OPCIONAL) 2. Actualizar saldo de chofer en la tabla `choferes` o `pagos_choferes`
    # Esto se podría hacer si queremos que se automatiquen las cuentas corrientes.
    return {"message": "Pago aprobado con éxito", "data": update_resp.data[0]}

@router.put("/pagos_manuales/{pago_id}/rechazar")
def rechazar_pago_manual(pago_id: str, payload: PagoRechazoRequest, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Rechaza el pago y asocia admin con un motivo."""
    admin_id = claims.get("sub")
    import datetime
    
    update_resp = supabase.table("pagos_chofer").update({
        "estado": "RECHAZADO",
        "fecha_validacion": datetime.datetime.now().isoformat(),
        "admin_id": admin_id,
        "observaciones": payload.observaciones
    }).eq("id", pago_id).execute()
    
    if not update_resp.data:
        raise HTTPException(status_code=404, detail="Pago no encontrado.")
        
    return {"message": "Pago rechazado", "data": update_resp.data[0]}

# === NUEVO MÓDULO: SOLICITUDES DE COMERCIOS ===

@router.get("/comercios/solicitudes")
def get_comercio_solicitudes(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Trae todas las solicitudes de comercios (pendientes, aprobados, rechazados)."""
    resp = supabase.table("comercio_solicitudes").select("*, auth_users:user_id(email)").order("created_at", desc=True).execute()
    return resp.data

@router.post("/comercios/solicitudes/{sol_id}/aprobar")
def aprobar_comercio(sol_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Aprueba la solicitud y transfiere los datos a la tabla de comercios activa."""
    # 1. Obtener solicitud
    sol_resp = supabase.table("comercio_solicitudes").select("*").eq("id", sol_id).execute()
    if not sol_resp.data:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        
    solicitud = sol_resp.data[0]
    if solicitud["estado"] == "APROBADO":
        raise HTTPException(status_code=400, detail="Esta solicitud ya fue aprobada.")
        
    # 2. Insertar en comercios
    nuevo_comercio = {
        "user_id": solicitud["user_id"],
        "nombre_comercio": solicitud["nombre"],
        "rubro": solicitud["rubro"],
        "direccion": solicitud["direccion"],
        "telefono": solicitud["telefono"],
        "email": solicitud["email"],
        "descripcion": solicitud["descripcion"],
        "logo_url": solicitud["logo_url"],
        "instagram_url": solicitud["instagram_url"],
        "facebook_url": solicitud["facebook_url"],
        "estado": "ACTIVO",
        "organizacion_id": claims.get("organizacion_id")
    }
    
    com_resp = supabase.table("comercios").insert(nuevo_comercio).execute()
    if not com_resp.data:
        raise HTTPException(status_code=500, detail="Error al transferir a la tabla de comercios.")
        
    # 3. Actualizar estado
    supabase.table("comercio_solicitudes").update({"estado": "APROBADO"}).eq("id", sol_id).execute()
    
    return {"mensaje": "Comercio aprobado exitosamente.", "comercio": com_resp.data[0]}

@router.post("/comercios/solicitudes/{sol_id}/rechazar")
def rechazar_comercio(sol_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Rechaza una solicitud de comercio."""
    sol_resp = supabase.table("comercio_solicitudes").select("*").eq("id", sol_id).execute()
    if not sol_resp.data:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
        
    supabase.table("comercio_solicitudes").update({"estado": "RECHAZADO"}).eq("id", sol_id).execute()
    return {"mensaje": "Solicitud rechazada."}


# ============================================================
# MÓDULO: GESTIÓN DE VEHÍCULOS (Admin)
# ============================================================

class VehicleCreate(BaseModel):
    titular_id: str
    marca: str
    modelo: str
    año: Optional[int] = None
    patente: str
    estado: Optional[str] = "activo"

class VehicleUpdate(BaseModel):
    marca: Optional[str] = None
    modelo: Optional[str] = None
    año: Optional[int] = None
    patente: Optional[str] = None
    estado: Optional[str] = None

class AssignDriverRequest(BaseModel):
    driver_id: Optional[str] = None  # None = desasignar chofer


@router.get("/vehiculos")
def get_vehiculos(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Lista todos los vehículos de la organización con titular y chofer."""
    org_id = claims.get("organizacion_id")
    resp = supabase.table("vehicles") \
        .select("*, titular:titular_id(id, nombre, email), driver:driver_id(id, nombre, email, telefono)") \
        .eq("organizacion_id", org_id) \
        .order("created_at", desc=True) \
        .execute()
    return resp.data


@router.post("/vehiculos")
def create_vehiculo(data: VehicleCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Crea un nuevo vehículo y lo asocia a un titular."""
    org_id = claims.get("organizacion_id")

    # Validar que el titular exista en la organización
    tit_check = supabase.table("usuarios") \
        .select("id, rol") \
        .eq("id", data.titular_id) \
        .eq("organizacion_id", org_id) \
        .execute()
    if not tit_check.data:
        raise HTTPException(status_code=404, detail="Titular no encontrado en esta organización.")

    resp = supabase.table("vehicles").insert({
        "organizacion_id": org_id,
        "titular_id": data.titular_id,
        "marca": data.marca,
        "modelo": data.modelo,
        "año": data.año,
        "patente": data.patente.upper().strip(),
        "estado": data.estado,
    }).execute()

    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al crear el vehículo.")

    return resp.data[0]


@router.put("/vehiculos/{vehicle_id}")
def update_vehiculo(vehicle_id: str, data: VehicleUpdate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Actualiza los datos básicos de un vehículo."""
    org_id = claims.get("organizacion_id")

    # Verificar propiedad de la organización
    check = supabase.table("vehicles").select("id").eq("id", vehicle_id).eq("organizacion_id", org_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if "patente" in payload:
        payload["patente"] = payload["patente"].upper().strip()

    if not payload:
        return {"message": "Nada que actualizar."}

    resp = supabase.table("vehicles").update(payload).eq("id", vehicle_id).execute()
    return resp.data[0] if resp.data else {}


@router.put("/vehiculos/{vehicle_id}/chofer")
def assign_chofer_a_vehiculo(
    vehicle_id: str,
    data: AssignDriverRequest,
    claims: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Asigna (o desasigna) un chofer a un vehículo.
    - driver_id = UUID del usuario chofer → asigna
    - driver_id = null → desasigna (libera el vehículo)
    Solo admin puede ejecutar esta operación.
    """
    org_id = claims.get("organizacion_id")

    # 1. Verificar que el vehículo existe en la organización
    v_check = supabase.table("vehicles").select("id").eq("id", vehicle_id).eq("organizacion_id", org_id).execute()
    if not v_check.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    driver_id = data.driver_id

    # 2. Si se asigna un chofer, validar que sea un usuario con rol chofer de la org
    if driver_id:
        u_check = supabase.table("usuarios") \
            .select("id, rol") \
            .eq("id", driver_id) \
            .eq("organizacion_id", org_id) \
            .execute()

        if not u_check.data:
            raise HTTPException(status_code=404, detail="Usuario chofer no encontrado en esta organización.")

        if u_check.data[0].get("rol") not in ["chofer", "admin", "superadmin"]:
            raise HTTPException(
                status_code=400,
                detail="El usuario seleccionado no tiene el rol 'chofer'. Verifica el perfil del usuario."
            )

    # 3. Actualizar asignación
    resp = supabase.table("vehicles").update({"driver_id": driver_id}).eq("id", vehicle_id).execute()

    accion = "asignado" if driver_id else "desasignado"
    return {"message": f"Chofer {accion} correctamente.", "vehiculo": resp.data[0] if resp.data else {}}


@router.delete("/vehiculos/{vehicle_id}")
def delete_vehiculo(vehicle_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Elimina un vehículo. Solo si no tiene un chofer asignado activo."""
    org_id = claims.get("organizacion_id")

    v_resp = supabase.table("vehicles") \
        .select("id, driver_id, patente") \
        .eq("id", vehicle_id) \
        .eq("organizacion_id", org_id) \
        .execute()

    if not v_resp.data:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    if v_resp.data[0].get("driver_id"):
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar un vehículo con un chofer asignado. Desasigna primero el chofer."
        )

    supabase.table("vehicles").delete().eq("id", vehicle_id).execute()
    return {"message": f"Vehículo {v_resp.data[0].get('patente')} eliminado correctamente."}


# ============================================================
# POST /admin/create-titular
# ============================================================

from fastapi import BackgroundTasks
from app.core.evolution import send_whatsapp_message
from app.core.config import settings

class TitularCreate(BaseModel):
    nombre: str
    email: EmailStr
    telefono: str

class TitularResponse(BaseModel):
    id: str
    nombre: str
    email: str
    password_temporal: str

@router.post("/create-titular", response_model=TitularResponse)
def create_titular(
    data: TitularCreate,
    background_tasks: BackgroundTasks,
    claims: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Crea un usuario con rol 'titular' (propietario de vehículos).
    Genera contraseña temporal, registra en Auth + usuarios + user_roles,
    y envía invitación por WhatsApp al número del titular.
    """
    org_id = claims.get("organizacion_id")

    # 1. Generar contraseña temporal (mismo patrón que create_chofer)
    alphabet = string.ascii_letters + string.digits
    password = "Nea" + ''.join(secrets.choice(alphabet) for _ in range(6)) + "!"

    # 2. Crear usuario en Supabase Auth
    try:
        auth_res = supabase.auth.admin.create_user({
            "email": data.email,
            "password": password,
            "email_confirm": True
        })
        user_id = auth_res.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo crear el usuario en Auth: {str(e)}")

    # 3. Insertar perfil en `usuarios` con rol 'titular' + rollback en caso de error
    try:
        supabase.table("usuarios").insert({
            "id": user_id,
            "organizacion_id": org_id,
            "email": data.email,
            "nombre": data.nombre,
            "telefono": data.telefono,
            "rol": "titular",
        }).execute()

        # 4. Registrar en user_roles para soporte multi-rol
        supabase.table("user_roles").insert({
            "user_id": user_id,
            "role": "titular",
            "organizacion_id": org_id,
        }).execute()

    except Exception as e:
        # Rollback del Auth user para no dejar registros huérfanos
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Error registrando titular: {str(e)}")

    # 5. Notificación WhatsApp de invitación (en background, no bloquea la respuesta)
    phone = data.telefono.strip().replace(" ", "").replace("-", "")
    if not phone.endswith("@s.whatsapp.net"):
        phone = phone + "@s.whatsapp.net"

    mensaje_invitacion = (
        f"👋 ¡Hola *{data.nombre}*! Fuiste registrado como *Titular* en Viajes NEA.\n\n"
        f"🔑 Tus credenciales de acceso:\n"
        f"📧 Email: *{data.email}*\n"
        f"🔐 Contraseña temporal: *{password}*\n\n"
        f"🌐 Ingresar en: {settings.FRONTEND_URL}\n\n"
        f"Por seguridad, te recomendamos cambiar tu contraseña al ingresar por primera vez."
    )
    background_tasks.add_task(
        send_whatsapp_message,
        settings.EVOLUTION_INSTANCE,
        phone,
        mensaje_invitacion
    )

    return TitularResponse(
        id=user_id,
        nombre=data.nombre,
        email=data.email,
        password_temporal=password
    )
