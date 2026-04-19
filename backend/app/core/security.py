from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Dict, Any, List

from app.core.config import settings
from app.db.supabase import supabase

security = HTTPBearer()

import time
from collections import OrderedDict

# Utilizar OrderedDict como un LRU Cache para prevenir fugas de memoria
token_cache = OrderedDict()
CACHE_TTL = 300       # 5 minutos
MAX_CACHE_SIZE = 2000  # Máximo 2000 tokens en memoria para evitar memory leaks


# ---------------------------------------------------------------------------
# HELPER: has_role
# ---------------------------------------------------------------------------

def has_role(claims: Dict[str, Any], role: str) -> bool:
    """
    Comprueba si el usuario posee un rol dado verificando AMBAS fuentes:
      1. Campo legado  usuarios.rol  (retrocompatibilidad total)
      2. Lista nueva   user_roles    (sistema multi-rol)
    Usar esta función en todos los guards y validaciones nuevas.
    """
    # 1. Campo legado (siempre presente en claims)
    if claims.get("rol") == role:
        return True
    # 2. Lista de roles extendida (puede estar vacía si aún no hay registros)
    if role in claims.get("roles", []):
        return True
    return False


# ---------------------------------------------------------------------------
# TOKEN VERIFICATION + LRU CACHE
# ---------------------------------------------------------------------------

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verifica el token JWT de Supabase usando el SDK.
    Carga el rol legado (usuarios.rol) Y la lista de roles extendida (user_roles),
    cacheando ambos juntos en el LRU para evitar round-trips repetitivos a la BD.
    """
    token = credentials.credentials
    now = time.time()

    # 1. Chequear Caché Rápido
    if token in token_cache:
        val, expiry = token_cache[token]
        if now < expiry:
            token_cache.move_to_end(token)  # Refrescar posición LRU
            return val
        else:
            del token_cache[token]

    # 2. Validación si no hay caché
    try:
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing sub")

        user_id = user_resp.user.id

        # 2a. Perfil base con campo legado de rol
        res = supabase.table("usuarios").select("rol, organizacion_id").eq("id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no registrado")

        # 2b. Lista extendida de roles desde la nueva tabla user_roles
        roles_res = supabase.table("user_roles").select("role").eq("user_id", user_id).execute()
        roles_list: List[str] = [r["role"] for r in roles_res.data] if roles_res.data else []

        claims = {
            "sub": user_id,
            "rol": res.data[0].get("rol"),              # Campo legado — retrocompatibilidad
            "organizacion_id": res.data[0].get("organizacion_id"),
            "roles": roles_list,                         # Multi-rol — puede estar vacío
        }

        # 3. Guardar en caché LRU
        token_cache[token] = (claims, now + CACHE_TTL)
        if len(token_cache) > MAX_CACHE_SIZE:
            token_cache.popitem(last=False)  # Descartar el más antiguo

        return claims

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# GUARDS — todos usan has_role para soportar campo legado + multi-rol
# ---------------------------------------------------------------------------

def get_current_user(claims: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    """Guard base: solo verifica que el token sea válido y el usuario exista."""
    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="Token sin subcapa")
    return claims


def get_current_admin(claims: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Guard de administrador. Acepta 'admin' o 'superadmin' por cualquier fuente (legado o multi-rol)."""
    if not (has_role(claims, "admin") or has_role(claims, "superadmin")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No authorized as admin")
    return claims


def get_current_chofer(claims: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Guard de chofer. Acepta 'chofer', 'admin' o 'superadmin' por cualquier fuente."""
    if not (has_role(claims, "chofer") or has_role(claims, "admin") or has_role(claims, "superadmin")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No authorized as chofer")
    return claims


def get_current_cliente(claims: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Guard exclusivo para pasajeros. Acepta 'cliente' por cualquier fuente (legado o multi-rol)."""
    if not has_role(claims, "cliente"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No authorized as cliente")
    return claims


def get_current_titular(claims: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Guard exclusivo para titulares de vehículos. Acepta 'titular' o 'admin'/'superadmin'."""
    if not (has_role(claims, "titular") or has_role(claims, "admin") or has_role(claims, "superadmin")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No authorized as titular")
    return claims
