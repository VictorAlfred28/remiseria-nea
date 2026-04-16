from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Dict, Any

from app.core.config import settings
from app.db.supabase import supabase

security = HTTPBearer()

import time
from collections import OrderedDict

# Utilizar OrderedDict como un LRU Cache para prevenir fugas de memoria
token_cache = OrderedDict()
CACHE_TTL = 300 # 5 minutes (300 segundos)
MAX_CACHE_SIZE = 2000 # Mantener como máximo 2000 tokens en memoria para evitar memory leaks

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verifica el token JWT de Supabase usando el SDK, e implementa caché en memoria 
    limitado (LRU) para abatir memory leaks mitigando accesos BD repetitivos.
    """
    token = credentials.credentials
    now = time.time()
    
    # 1. Chequear Caché Rápido
    if token in token_cache:
        val, expiry = token_cache[token]
        if now < expiry:
            # Refrescar acceso moviéndolo al final (reciente)
            token_cache.move_to_end(token)
            return val
        else:
            del token_cache[token]
            
    # 2. Validación Física si no hay caché
    try:
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing sub")
        
        user_id = user_resp.user.id
        
        res = supabase.table("usuarios").select("rol, organizacion_id").eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no registrado")
        
        claims = {
            "sub": user_id,
            "rol": res.data[0].get("rol"),
            "organizacion_id": res.data[0].get("organizacion_id")
        }
        
        # 3. Guardamos en caché LRU limitando el tamaño máximo
        token_cache[token] = (claims, now + CACHE_TTL)
        if len(token_cache) > MAX_CACHE_SIZE:
             # Desechar el más antiguo (LIFO por push, LRU descartado del inicio)
             token_cache.popitem(last=False)
        
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
