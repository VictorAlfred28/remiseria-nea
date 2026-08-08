from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from pydantic import BaseModel
import jwt
import logging
from datetime import datetime, timedelta, timezone

from app.core.security import get_current_user
from app.db.supabase import supabase
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Utilizaremos el JWT Secret de Supabase si existe, sino un fallback temporal
if not settings.SUPABASE_JWT_SECRET:
    raise RuntimeError("SUPABASE_JWT_SECRET no está configurado. El módulo de socios no puede operar sin este secreto.")
JWT_SECRET = settings.SUPABASE_JWT_SECRET
QR_EXPIRATION_MINUTES = 5

class ValidarQRRequest(BaseModel):
    qr_token: str

@router.get("/qr_token")
def get_qr_token(claims: Dict[str, Any] = Depends(get_current_user)):
    """
    Genera un token QR temporal (5 minutos de vida) para identificar al pasajero de forma segura 
    como SOCIO en un comercio adherido.
    """
    cliente_id = claims.get("sub")
    orga_id = claims.get("organizacion_id")
    
    # 1. Chequeamos que en verdad sea un pasajero normal y verifiquemos "es_socio"
    user_res = supabase.table("usuarios").select("nombre, es_socio").eq("id", cliente_id).execute()
    
    if not user_res.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    usr = user_res.data[0]
    
    if not usr.get("es_socio", False):
        raise HTTPException(status_code=403, detail="El usuario no tiene el estado de Socio activo.")

    # 1.5 Verificar mínimo de viajes
    MINIMO_VIAJES = 5
    v_resp = supabase.table("viajes").select("id", count="exact").eq("cliente_id", cliente_id).in_("estado", ["FINALIZADO"]).execute()
    viajes_completados = v_resp.count if v_resp.count else 0
    
    import os
    qa_enabled = os.environ.get("ENABLE_QA_BENEFICIOS", "false").lower() == "true"
    
    if not qa_enabled and viajes_completados < MINIMO_VIAJES:
        raise HTTPException(status_code=403, detail=f"Requiere al menos {MINIMO_VIAJES} viajes completados para acceder al Carnet VIP.")

    # Generar Nonce Seguro
    import uuid
    nonce = str(uuid.uuid4())

    # 2. Generamos JWT (60 segundos)
    exp = datetime.now(timezone.utc) + timedelta(seconds=60)
    payload = {
        "sub": cliente_id,
        "nonce": nonce,
        "exp": exp,
        "type": "qr_socio_v2"
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    
    # Registrar Nonce en BD
    try:
        supabase.table("qr_nonces").insert({
            "cliente_id": cliente_id,
            "nonce": nonce,
            "expira_en": exp.isoformat()
        }).execute()
    except Exception as e:
        logger.error(f"Error insertando nonce: {e}")
        # Se permite continuar aunque falle la inserción del nonce, la validación posterior lo rechazará si no existe, o se puede preferir bloquear la generación si falla BD. Lo ideal es dejarlo fallar o loggear, la inserción debe ser atómica.

    return {
        "qr_token": token,
        "expira_en": exp.isoformat(),
        "nombre_socio": usr.get("nombre", "") # Retornamos el nombre por si el frontend lo requiere para pre-caché
    }

@router.post("/validar_qr")
def validar_qr(data: ValidarQRRequest, claims: Dict[str, Any] = Depends(get_current_user)):
    """
    Validación principal del comercio.
    Recibe el token, verifica la caducidad y firma, y comprueba con la base de datos
    reportando la validación del Carnet y registrándolo en la tabla de escaneos.
    """
    comercio_id = claims.get("sub")
    orga_id = claims.get("organizacion_id")
    
    # Verificamos si realmente quien llama es "comercio" o un "admin" de validación
    rol = claims.get("rol", "")
    if rol not in ["comercio", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Rol no autorizado para validar Carnets.")
        
    try:
        # Decodificamos Token
        payload = jwt.decode(data.qr_token, JWT_SECRET, algorithms=["HS256"])
        
        token_type = payload.get("type")
        if token_type not in ["qr_socio", "qr_socio_v2"]:
            raise HTTPException(status_code=400, detail="El QR escaneado no es un Carnet válido.")
            
        cliente_id = payload.get("sub")
        nonce = payload.get("nonce")
        
        # Validación Anti-Replay para QR V2
        if token_type == "qr_socio_v2" and nonce:
            # Hacer update atómico para evitar race conditions
            nonce_res = supabase.table("qr_nonces").update({"usado": True, "usado_en": datetime.now(timezone.utc).isoformat()}).eq("nonce", nonce).eq("usado", False).execute()
            if not nonce_res.data:
                # Si no devuelve data, o bien el nonce no existe, o ya estaba usado
                return {"valido": False, "mensaje": "QR Reutilizado o Inválido."}
        
        # Validar en base de datos estado actual
        res_cli = supabase.table("usuarios").select("nombre, numero_socio, es_socio, activo, foto_perfil").eq("id", cliente_id).execute()
        if not res_cli.data:
            return {"valido": False, "mensaje": "Usuario eliminado o inexistente."}
            
        cliente = res_cli.data[0]
        
        if not cliente.get("activo", False):
            return {"valido": False, "mensaje": "Socio suspendido."}
            
        if not cliente.get("es_socio", False):
            return {"valido": False, "mensaje": "Socio vencido."}
            
        # Todo verde: Registrar escaneo
        try:
            supabase.table("historial_escaneos_socios").insert({
                "comercio_id": comercio_id,
                "cliente_id": cliente_id,
                "organizacion_id": orga_id,
                "beneficio_aplicado": "Validación Exitosa",
                "numero_socio": cliente.get("numero_socio"),
                "nonce": nonce,
                "resultado": "EXITO"
            }).execute()
        except Exception as e:
            logger.warning(f"Error registrando escaneo de socio: {e}")
            
        return {
            "valido": True, 
            "mensaje": "Socio Validado Correctamente",
            "socio": {
                "nombre": cliente.get("nombre", ""),
                "apellido": "",
                "numero_socio": cliente.get("numero_socio"),
                "foto_perfil": cliente.get("foto_perfil"),
                "activo": cliente.get("activo", False),
                "es_socio": cliente.get("es_socio", False)
            }
        }
        
    except jwt.ExpiredSignatureError:
        return {"valido": False, "mensaje": "QR Expirado"}
    except jwt.InvalidTokenError:
        return {"valido": False, "mensaje": "Código QR corrompido o inválido."}
    except HTTPException as ht:
        raise ht
    except Exception as e:
        logger.error(f"Error en validar_qr: {e}")
        return {"valido": False, "mensaje": f"Error de plataforma al validar: {str(e)}"}


@router.post("/validar_qr_publico")
def validar_qr_publico(data: ValidarQRRequest):
    """
    Validación PÚBLICA del QR.
    Cualquier persona escaneando con la cámara del celular.
    """
    try:
        # Decodificamos Token
        payload = jwt.decode(data.qr_token, JWT_SECRET, algorithms=["HS256"])
        
        token_type = payload.get("type")
        if token_type not in ["qr_socio", "qr_socio_v2"]:
            raise HTTPException(status_code=400, detail="El QR escaneado no es un Carnet válido.")
            
        cliente_id = payload.get("sub")
        nonce = payload.get("nonce")
        
        # Validación Anti-Replay para QR V2
        if token_type == "qr_socio_v2" and nonce:
            nonce_res = supabase.table("qr_nonces").update({"usado": True, "usado_en": datetime.now(timezone.utc).isoformat()}).eq("nonce", nonce).eq("usado", False).execute()
            if not nonce_res.data:
                return {"valido": False, "mensaje": "QR Reutilizado o Inválido."}
        
        res_cli = supabase.table("usuarios").select("nombre, numero_socio, es_socio, activo, foto_perfil").eq("id", cliente_id).execute()
        if not res_cli.data:
            return {"valido": False, "mensaje": "Usuario eliminado o inexistente."}
            
        cliente = res_cli.data[0]
        
        if not cliente.get("activo", False):
            return {"valido": False, "mensaje": "Socio suspendido."}
            
        if not cliente.get("es_socio", False):
            return {"valido": False, "mensaje": "Socio vencido."}
            
        # Registrar como validación pública (comercio_id = null o texto)
        try:
            supabase.table("historial_escaneos_socios").insert({
                "cliente_id": cliente_id,
                "beneficio_aplicado": "Validación Pública (Cámara Libre)",
                "numero_socio": cliente.get("numero_socio"),
                "nonce": nonce,
                "resultado": "EXITO"
            }).execute()
        except Exception as e:
            logger.warning(f"Error registrando escaneo público: {e}")
            
        return {
            "valido": True, 
            "mensaje": "Socio Validado Correctamente",
            "socio": {
                "nombre": cliente.get("nombre", ""),
                "apellido": "",
                "numero_socio": cliente.get("numero_socio"),
                "foto_perfil": cliente.get("foto_perfil"),
                "activo": cliente.get("activo", False),
                "es_socio": cliente.get("es_socio", False)
            }
        }
        
    except jwt.ExpiredSignatureError:
        return {"valido": False, "mensaje": "QR Expirado"}
    except jwt.InvalidTokenError:
        return {"valido": False, "mensaje": "Código QR corrompido o inválido."}
    except HTTPException as ht:
        raise ht
    except Exception as e:
        logger.error(f"Error en validar_qr_publico: {e}")
        return {"valido": False, "mensaje": f"Error de plataforma al validar público: {str(e)}"}
