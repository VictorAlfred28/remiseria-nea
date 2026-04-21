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
import logging

from app.db.supabase import supabase
from app.schemas.domain import ChoferRegistroCompleto

logger = logging.getLogger(__name__)


class ValidacionError(Exception):
    """Exception interna para validaciones."""
    def __init__(self, status_code: int, detail: str, field: Optional[str] = None):
        self.status_code = status_code
        self.detail = detail
        self.field = field


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
        logger.info(f"Validating email uniqueness: {email} in org {org_id}")
        existing = supabase.table("usuarios") \
            .select("id") \
            .eq("organizacion_id", str(org_id)) \
            .eq("email", email) \
            .execute()
        
        if existing.data:
            logger.warning(f"❌ Email already registered: {email} in org {org_id}")
            raise ValidacionError(
                status_code=400,
                detail="Email ya registrado en esta organización",
                field="email"
            )
        logger.info(f"✓ Email is unique: {email}")
    except ValidacionError:
        raise
    except Exception as e:
        logger.error(f"❌ Error validating email: {type(e).__name__}: {str(e)}")
        raise ValidacionError(
            status_code=500,
            detail=f"Error validando email: {str(e)}",
            field="email"
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
        logger.info(f"Validating DNI uniqueness: {dni} in org {org_id}")
        existing = supabase.table("choferes") \
            .select("id") \
            .eq("organizacion_id", str(org_id)) \
            .eq("dni", dni) \
            .execute()
        
        if existing.data:
            logger.warning(f"❌ DNI already registered: {dni} in org {org_id}")
            raise ValidacionError(
                status_code=400,
                detail="DNI ya registrado en esta organización",
                field="dni"
            )
        logger.info(f"✓ DNI is unique: {dni}")
    except ValidacionError:
        raise
    except Exception as e:
        logger.error(f"❌ Error validating DNI: {type(e).__name__}: {str(e)}")
        raise ValidacionError(
            status_code=500,
            detail=f"Error validando DNI: {str(e)}",
            field="dni"
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
        logger.info(f"Validating organization exists: {org_id}")
        org_check = supabase.table("organizaciones") \
            .select("id, acepta_registros_publicos") \
            .eq("id", str(org_id)) \
            .execute()
        
        if not org_check.data:
            logger.warning(f"❌ Organization not found: {org_id}")
            raise ValidacionError(
                status_code=400,
                detail=f"Organización no válida: {org_id}",
                field="organizacion_id"
            )
        
        org = org_check.data[0]
        logger.info(f"✓ Organization found: {org_id}, acepta_registros_publicos={org.get('acepta_registros_publicos')}")
        return org
    
    except ValidacionError:
        raise
    except Exception as e:
        logger.error(f"❌ Error validating organization: {type(e).__name__}: {str(e)}")
        raise ValidacionError(
            status_code=500,
            detail=f"Error validando organización: {str(e)}",
            field="organizacion_id"
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
        logger.info(f"Skipping license expiration validation (not provided)")
        return  # Optional, skip if not provided
    
    try:
        logger.info(f"Validating license expiration: {fecha_vencimiento}")
        vencimiento = datetime.strptime(fecha_vencimiento, "%Y-%m-%d").date()
        hoy = datetime.now().date()
        
        if vencimiento <= hoy:
            logger.warning(f"❌ License expired: {fecha_vencimiento} <= {hoy}")
            raise ValidacionError(
                status_code=400,
                detail=f"Licencia vencida (vencimiento: {fecha_vencimiento}). Debe ser >= {hoy}",
                field="licencia_vencimiento"
            )
        logger.info(f"✓ License is valid: {fecha_vencimiento} > {hoy}")
    except ValidacionError:
        raise
    except ValueError as ve:
        logger.warning(f"❌ Invalid license date format: {fecha_vencimiento} - {str(ve)}")
        raise ValidacionError(
            status_code=400,
            detail=f"Formato de fecha licencia inválido. Use YYYY-MM-DD (recibido: {fecha_vencimiento})",
            field="licencia_vencimiento"
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
        logger.info(f"Skipping license plate validation (no vehicle)")
        return  # No validar si no tiene vehículo
    
    logger.info(f"Validating license plate: {patente} (has_vehicle={tiene_vehiculo})")
    
    if not patente or patente.strip() == "":
        logger.warning(f"❌ License plate missing but vehicle=True")
        raise ValidacionError(
            status_code=400,
            detail="Patente es requerida si tiene_vehiculo=True",
            field="patente"
        )
    
    # Validación simple: patente debe tener 6-8 caracteres
    if len(patente) < 6 or len(patente) > 8:
        logger.warning(f"❌ Invalid license plate format: {patente} (length={len(patente)})")
        raise ValidacionError(
            status_code=400,
            detail=f"Patente inválida (debe tener 6-8 caracteres, recibido: {patente})",
            field="patente"
        )
    logger.info(f"✓ License plate is valid: {patente}")


def validar_telefono_formato(telefono: str) -> None:
    """
    VALIDACIÓN: Teléfono debe ser válido (10+ dígitos).
    
    Args:
        telefono: Teléfono a validar
        
    Raises:
        ValidacionError: Si formato inválido
    """
    logger.info(f"Validating phone format: {telefono}")
    # Extraer solo dígitos
    digitos = re.sub(r'\D', '', telefono)
    
    if len(digitos) < 10:
        logger.warning(f"❌ Invalid phone format: {telefono} (digits={digitos}, count={len(digitos)})")
        raise ValidacionError(
            status_code=400,
            detail=f"Teléfono inválido (debe tener mínimo 10 dígitos, recibido: {telefono})",
            field="telefono"
        )
    logger.info(f"✓ Phone format is valid: {telefono} ({len(digitos)} digits)")


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
        logger.info(f"=== STARTING COMMON VALIDATIONS ===")
        
        # 1. Validar org existe
        logger.info(f"[1/6] Validating organization...")
        validar_organizacion_existe(data.organizacion_id)
        
        # 2. Validar email único
        logger.info(f"[2/6] Validating email uniqueness...")
        validar_email_unico(data.email, data.organizacion_id)
        
        # 3. Validar DNI único
        logger.info(f"[3/6] Validating DNI uniqueness...")
        validar_dni_unico(data.dni, data.organizacion_id)
        
        # 4. Validar teléfono
        logger.info(f"[4/6] Validating phone format...")
        validar_telefono_formato(data.telefono)
        
        # 5. Validar licencia vencimiento (si presente)
        logger.info(f"[5/6] Validating license expiration...")
        validar_licencia_vencimiento(data.licencia_vencimiento)
        
        # 6. Validar patente (si tiene_vehiculo=True)
        logger.info(f"[6/6] Validating license plate...")
        validar_patente_formato(data.patente, data.tiene_vehiculo)
        
        logger.info(f"✅ ALL COMMON VALIDATIONS PASSED")
        
    except ValidacionError as e:
        logger.error(f"❌ Validation failed on field '{e.field}': {e.detail}")
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
        logger.info(f"=== PUBLIC REGISTRATION VALIDATION ===")
        
        # 1. Validaciones comunes
        logger.info(f"Running common validations...")
        validar_campos_comunes(data)
        
        # 2. Validar acepta_registros_publicos
        logger.info(f"Checking if organization accepts public registrations...")
        org = validar_organizacion_existe(data.organizacion_id)
        if not org.get("acepta_registros_publicos", True):
            logger.warning(f"❌ Organization does not accept public registrations: {data.organizacion_id}")
            raise ValidacionError(
                status_code=400,
                detail="Esta organización no acepta registros de choferes en este momento",
                field="organizacion_id"
            )
        logger.info(f"✓ Organization accepts public registrations")
        logger.info(f"✅ PUBLIC REGISTRATION VALIDATION PASSED")
        
    except HTTPException:
        raise
    except ValidacionError as e:
        logger.error(f"❌ Public registration validation failed on field '{e.field}': {e.detail}")
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
        logger.info(f"=== ADMIN REGISTRATION VALIDATION ===")
        
        # 1. Validar que org_id en claims coincida con data
        logger.info(f"Validating organization authorization: {data.organizacion_id} == {org_id_claims}")
        if str(data.organizacion_id) != str(org_id_claims):
            logger.warning(f"❌ Organization mismatch: data={data.organizacion_id}, claims={org_id_claims}")
            raise ValidacionError(
                status_code=403,
                detail="No autorizado: organización no coincide",
                field="organizacion_id"
            )
        logger.info(f"✓ Organization authorization valid")
        
        # 2. Validaciones comunes
        logger.info(f"Running common validations...")
        validar_campos_comunes(data)
        logger.info(f"✅ ADMIN REGISTRATION VALIDATION PASSED")
        
    except HTTPException:
        raise
    except ValidacionError as e:
        logger.error(f"❌ Admin registration validation failed on field '{e.field}': {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
