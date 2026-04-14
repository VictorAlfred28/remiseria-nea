from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Dict, Any

from app.core.config import settings
from app.db.supabase import supabase

security = HTTPBearer()

import time

token_cache = {}
CACHE_TTL = 300 # 5 minutes (300 segundos)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verifica el token JWT de Supabase usando el SDK, e implementa caché en memoria 
    para mitigar cuellos de botella por repetitivas validaciones HTTP de red.
    """
    token = credentials.credentials
    now = time.time()
    
    # 1. Chequear Caché Rápido
    if token in token_cache:
        val, expiry = token_cache[token]
        if now < expiry:
            # Si expira en menos de 5 min, usamos esto para NO ir a la DB.
            return val
        else:
            del token_cache[token]
            
    # 2. Validación Física si no hay caché
    try:
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing sub")
        
        user_id = user_resp.user.id
        
        # Obtenemos organizacion y rol de paso en la misma ventana de latencia.
        res = supabase.table("usuarios").select("rol, organizacion_id").eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no registrado")
        
        # Armamos el payload consolidado
        claims = {
            "sub": user_id,
            "rol": res.data[0].get("rol"),
            "organizacion_id": res.data[0].get("organizacion_id")
        }
        
        # Guardamos en caché
        token_cache[token] = (claims, now + CACHE_TTL)
        
        return claims

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(claims: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # Debido a la optimización de TTL cache previa, los claims ya contienen rol y org_id.
    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="Token sin subcapa")
    return claims

def get_current_admin(claims: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    rol = claims.get("rol", "")
    if rol not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No authorized as admin")
    return claims

def get_current_chofer(claims: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    rol = claims.get("rol", "")
    if rol not in ["chofer", "admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No authorized as chofer")
    return claims
