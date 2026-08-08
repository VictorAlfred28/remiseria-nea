from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any
import os
from supabase import create_client, Client
from app.core.config import settings

router = APIRouter()

def get_service_supabase() -> Client:
    url = settings.SUPABASE_URL
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", settings.SUPABASE_KEY)
    return create_client(url, key)

class LoginRequest(BaseModel):
    identificador: str
    password: str

@router.post("/login")
async def login(request: LoginRequest):
    try:
        email_to_auth = request.identificador
        
        # Si no es un email (se asume DNI), buscamos el email asociado
        if "@" not in request.identificador:
            service_supabase = get_service_supabase()
            response = service_supabase.table("usuarios").select("email").eq("dni", request.identificador).execute()
            
            if response.data and len(response.data) > 0:
                email_to_auth = response.data[0]["email"]
            else:
                choferes_resp = service_supabase.table("choferes").select("usuarios!inner(email)").eq("dni", request.identificador).execute()
                if choferes_resp.data and len(choferes_resp.data) > 0 and "usuarios" in choferes_resp.data[0]:
                    email_to_auth = choferes_resp.data[0]["usuarios"]["email"]
                else:
                    # Mitigación de timing attack (enumeración):
                    # Si no se encuentra el DNI, asignamos un email falso para que la llamada a 
                    # sign_in_with_password consuma el mismo tiempo de CPU procesando el hash.
                    email_to_auth = "no-reply-dummy@viajesnea.agentech.ar"

        # Intentamos iniciar sesión con Supabase Auth
        service_supabase = get_service_supabase()
        auth_response = service_supabase.auth.sign_in_with_password({
            "email": email_to_auth,
            "password": request.password
        })

        session = auth_response.session
        user = auth_response.user

        if not session or not user:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")

        return {
            "success": True,
            "session": {
                "access_token": session.access_token,
                "refresh_token": session.refresh_token,
                "expires_in": session.expires_in,
                "expires_at": session.expires_at,
                "token_type": session.token_type
            },
            "user": {
                "id": user.id
            }
        }

    except Exception as e:
        # En caso de cualquier error (incluyendo credenciales inválidas de Supabase Auth)
        # Devolvemos un error genérico por seguridad.
        print(f"Error en login: {e}")
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

from app.core.security import verify_token

@router.post("/password-inicial-completada")
async def password_inicial_completada(claims: Dict[str, Any] = Depends(verify_token)):
    """
    Marca al usuario como que ya completó su cambio de contraseña obligatoria.
    No verifica get_current_user porque eso bloquearía esta misma petición.
    Solo necesita verify_token.
    """
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")
        
    try:
        service_supabase = get_service_supabase()
        response = service_supabase.table("usuarios").update({
            "requiere_cambio_password": False
        }).eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        return {"success": True, "message": "Estado de contraseña actualizado correctamente"}
    except Exception as e:
        print(f"Error actualizando requiere_cambio_password: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")
