"""
VALIDATORS: Centralización de validaciones para registro de choferes.

Fuente única de verdad para:
- Validaciones comunes (email único, DNI único por org)
- Validaciones específicas de endpoint (público vs admin)
- Formato consistente de errores

RESPONSABILIDAD ÚNICA: Validar datos, NOT tocar BD/Auth (eso va en endpoints)
"""

from fastapi import HTTPException
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime
import re

from app.db.supabase import supabase
from app.schemas.domain import ChoferRegistroCompleto


class ValidacionError(Exception):
    """Exception interna para validaciones."""
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


def validar_email_unico(email: str, org_id: UUID) -> None:
    """
    VALIDACIÓN: Email único por organización.
    
    Args:
        email: Email a validar
        org_id: Organización
        
    Raises:
        ValidacionError: Si email ya existe en la org
    """
    try:
        existing = supabase.table("usuarios") \
            .select("id") \
            .eq("organizacion_id", str(org_id)) \
            .eq("email", email) \
            .execute()
        
        if existing.data:
            raise ValidacionError(
                status_code=400,
                detail="Email ya registrado en esta organización"
            )
    except ValidacionError:
        raise
    except Exception as e:
        raise ValidacionError(
            status_code=500,
            detail=f"Error validando email: {str(e)}"
        )


def validar_dni_unico(dni: str, org_id: UUID) -> None:
    """
    VALIDACIÓN: DNI único por organización.
    
    Args:
        dni: DNI a validar
        org_id: Organización
        
    Raises:
        ValidacionError: Si DNI ya existe en la org
    """
    try:
        existing = supabase.table("choferes") \
            .select("id") \
            .eq("organizacion_id", str(org_id)) \
            .eq("dni", dni) \
            .execute()
        
        if existing.data:
            raise ValidacionError(
                status_code=400,
                detail="DNI ya registrado en esta organización"
            )
    except ValidacionError:
        raise
    except Exception as e:
        raise ValidacionError(
            status_code=500,
            detail=f"Error validando DNI: {str(e)}"
        )


def validar_organizacion_existe(org_id: UUID) -> Dict[str, Any]:
    """
    VALIDACIÓN: Organización existe y obtener sus datos.
    
    Args:
        org_id: Organización a validar
        
    Returns:
        Dict con datos de organización (id, acepta_registros_publicos)
        
    Raises:
        ValidacionError: Si organización no existe
    """
    try:
        org_check = supabase.table("organizaciones") \
            .select("id, acepta_registros_publicos") \
            .eq("id", str(org_id)) \
            .execute()
        
        if not org_check.data:
            raise ValidacionError(
                status_code=400,
                detail="Organización no válida"
            )
        
        return org_check.data[0]
    
    except ValidacionError:
        raise
    except Exception as e:
        raise ValidacionError(
            status_code=500,
            detail=f"Error validando organización: {str(e)}"
        )


def validar_licencia_vencimiento(fecha_vencimiento: Optional[str]) -> None:
    """
    VALIDACIÓN: Si licencia tiene vencimiento, debe ser > hoy.
    
    Args:
        fecha_vencimiento: Fecha en formato YYYY-MM-DD (opcional)
        
    Raises:
        ValidacionError: Si fecha inválida o vencida
    """
    if not fecha_vencimiento:
        return  # Optional, skip if not provided
    
    try:
        vencimiento = datetime.strptime(fecha_vencimiento, "%Y-%m-%d").date()
        hoy = datetime.now().date()
        
        if vencimiento <= hoy:
            raise ValidacionError(
                status_code=400,
                detail=f"Licencia vencida (vencimiento: {fecha_vencimiento}). Debe ser >= {hoy}"
            )
    except ValidacionError:
        raise
    except ValueError:
        raise ValidacionError(
            status_code=400,
            detail=f"Formato de fecha licencia inválido. Use YYYY-MM-DD (recibido: {fecha_vencimiento})"
        )


def validar_patente_formato(patente: Optional[str], tiene_vehiculo: bool) -> None:
    """
    VALIDACIÓN: Si tiene_vehiculo=True, patente debe estar presente y ser válida.
    
    Args:
        patente: Patente a validar (opcional)
        tiene_vehiculo: Si tiene vehículo propio
        
    Raises:
        ValidacionError: Si patente inválida/ausente
    """
    if not tiene_vehiculo:
        return  # No validar si no tiene vehículo
    
    if not patente or patente.strip() == "":
        raise ValidacionError(
            status_code=400,
            detail="Patente es requerida si tiene_vehiculo=True"
        )
    
    # Validación simple: patente debe tener 6-8 caracteres
    if len(patente) < 6 or len(patente) > 8:
        raise ValidacionError(
            status_code=400,
            detail=f"Patente inválida (debe tener 6-8 caracteres, recibido: {patente})"
        )


def validar_telefono_formato(telefono: str) -> None:
    """
    VALIDACIÓN: Teléfono debe ser válido (10+ dígitos).
    
    Args:
        telefono: Teléfono a validar
        
    Raises:
        ValidacionError: Si formato inválido
    """
    # Extraer solo dígitos
    digitos = re.sub(r'\D', '', telefono)
    
    if len(digitos) < 10:
        raise ValidacionError(
            status_code=400,
            detail=f"Teléfono inválido (debe tener mínimo 10 dígitos, recibido: {telefono})"
        )


# ============================================================================
# FUNCIONES PÚBLICAS: VALIDAR REGISTRO PÚBLICO vs ADMIN
# ============================================================================

def validar_campos_comunes(data: ChoferRegistroCompleto) -> None:
    """
    VALIDACIÓN COMÚN para ambos endpoints (público y admin).
    
    Valida:
    - Email único por org
    - DNI único por org
    - Organización existe
    - Licencia vencimiento (si presente)
    - Patente formato (si tiene_vehiculo=True)
    - Teléfono formato
    
    Args:
        data: ChoferRegistroCompleto a validar
        
    Raises:
        HTTPException: Si alguna validación falla
    """
    try:
        # 1. Validar org existe
        validar_organizacion_existe(data.organizacion_id)
        
        # 2. Validar email único
        validar_email_unico(data.email, data.organizacion_id)
        
        # 3. Validar DNI único
        validar_dni_unico(data.dni, data.organizacion_id)
        
        # 4. Validar teléfono
        validar_telefono_formato(data.telefono)
        
        # 5. Validar licencia vencimiento (si presente)
        validar_licencia_vencimiento(data.licencia_vencimiento)
        
        # 6. Validar patente (si tiene_vehiculo=True)
        validar_patente_formato(data.patente, data.tiene_vehiculo)
        
    except ValidacionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


def validar_registro_publico(data: ChoferRegistroCompleto) -> None:
    """
    VALIDACIÓN específica para REGISTRO PÚBLICO (/public/registro/chofer).
    
    Incluye:
    - Todas las validaciones comunes
    - Validar que organización ACEPTA registros públicos
    
    Args:
        data: ChoferRegistroCompleto a validar
        
    Raises:
        HTTPException: Si alguna validación falla
    """
    try:
        # 1. Validaciones comunes
        validar_campos_comunes(data)
        
        # 2. Validar acepta_registros_publicos
        org = validar_organizacion_existe(data.organizacion_id)
        if not org.get("acepta_registros_publicos", True):
            raise ValidacionError(
                status_code=400,
                detail="Esta organización no acepta registros de choferes en este momento"
            )
        
    except HTTPException:
        raise
    except ValidacionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


def validar_registro_admin(data: ChoferRegistroCompleto, org_id_claims: UUID) -> None:
    """
    VALIDACIÓN específica para REGISTRO ADMIN (/admin/chofer).
    
    Incluye:
    - Todas las validaciones comunes
    - Validar que org_id en data coincida con org_id en claims (seguridad)
    
    Args:
        data: ChoferRegistroCompleto a validar
        org_id_claims: Organización del admin (desde JWT claims)
        
    Raises:
        HTTPException: Si alguna validación falla
    """
    try:
        # 1. Validar que org_id en claims coincida con data
        if data.organizacion_id != org_id_claims:
            raise ValidacionError(
                status_code=403,
                detail="No autorizado: organización no coincide"
            )
        
        # 2. Validaciones comunes
        validar_campos_comunes(data)
        
    except HTTPException:
        raise
    except ValidacionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
