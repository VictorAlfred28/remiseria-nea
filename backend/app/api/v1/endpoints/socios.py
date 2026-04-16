from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta, timezone

from app.core.security import get_current_user
from app.db.supabase import supabase
from app.core.config import settings

router = APIRouter()

# Utilizaremos el JWT Secret de Supabase si existe, sino un fallback temporal
JWT_SECRET = settings.SUPABASE_JWT_SECRET or "super-secret-qr-key-viajes-nea"
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

    # 2. Generamos JWT
    exp = datetime.now(timezone.utc) + timedelta(minutes=QR_EXPIRATION_MINUTES)
    payload = {
        "sub": cliente_id,
        "nombre": usr.get("nombre", ""),
        "org_id": orga_id,
        "exp": exp,
        "type": "qr_socio"
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    
    return {
        "qr_token": token,
        "expira_en": exp.isoformat(),
        "nombre_socio": usr.get("nombre", "")
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
        
        if payload.get("type") != "qr_socio":
            raise HTTPException(status_code=400, detail="El QR escaneado no es un Carnet válido.")
            
        cliente_id = payload.get("sub")
        
        # Validar en base de datos estado actual
        res_cli = supabase.table("usuarios").select("nombre, es_socio, activo").eq("id", cliente_id).execute()
        if not res_cli.data:
            return {"valido": False, "mensaje": "Usuario eliminado o inexistente."}
            
        cliente = res_cli.data[0]
        
        if not cliente.get("activo", False):
            return {"valido": False, "mensaje": "Socio inhabilitado o suspendido de la plataforma."}
            
        if not cliente.get("es_socio", False):
            return {"valido": False, "mensaje": "Vencimiento de membresía. No es socio."}
            
        # Todo verde: Registrar escaneo
        try:
            supabase.table("historial_escaneos_socios").insert({
                "comercio_id": comercio_id,
                "cliente_id": cliente_id,
                "organizacion_id": orga_id,
                "beneficio_aplicado": "Validación Exitosa"
            }).execute()
        except Exception as e:
            # Si falla el logging no bloqueamos la validez
            print(f"Error loggeando escaneo: {e}")
            
        return {
            "valido": True, 
            "mensaje": "Socio Validado Correctamente",
            "socio": {
                "nombre": cliente.get("nombre", payload.get("nombre", "Socio NEA")),
                "id": cliente_id
            }
        }
        
    except jwt.ExpiredSignatureError:
        return {"valido": False, "mensaje": "El Código QR expiró. Pídele al socio que actualice la app."}
    except jwt.InvalidTokenError:
        return {"valido": False, "mensaje": "Código QR corrompido o inválido."}
    except HTTPException as ht:
        raise ht
    except Exception as e:
        return {"valido": False, "mensaje": "Error de plataforma al validar."}
