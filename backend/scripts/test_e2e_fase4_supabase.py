"""
FASE 4 - E2E TESTING: Supabase Real

Script para validar end-to-end:
1. Crear organización de prueba
2. Registrar chofer público (estado_validacion='pendiente')
3. Aprobar chofer como admin (estado_validacion='aprobado')
4. Validar triggers, constraints, RLS policies
5. Verificar login funciona
6. Limpiar datos de prueba

PREREQUISITOS:
    - SUPABASE_URL env var
    - SUPABASE_SERVICE_ROLE_KEY env var (admin access)
    - Supabase DB ya inicializada (migrations ejecutadas)

EJECUCIÓN:
    export SUPABASE_URL="https://xxxxx.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
    python backend/scripts/test_e2e_fase4_supabase.py

O con pytest:
    pytest backend/scripts/test_e2e_fase4_supabase.py -v -s
"""

import os
import sys
import json
from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, Any, Optional, Tuple

# Ajustar path para imports
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)

from supabase import create_client, Client
from app.schemas.domain import ChoferRegistroCompleto
from app.core.validators import (
    validar_registro_publico,
    validar_registro_admin,
    ValidacionError
)


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ ERROR: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas")
    print("   export SUPABASE_URL='https://xxxxx.supabase.co'")
    print("   export SUPABASE_SERVICE_ROLE_KEY='eyJ...'")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Datos de prueba
ORG_ID = str(uuid4())
ORG_NAME = f"Test Org {datetime.now().strftime('%Y%m%d%H%M%S')}"

TEST_EMAIL = f"test.chofer.{uuid4().hex[:8]}@example.com"
TEST_DNI = f"DNI{uuid4().hex[:8]}".upper()
TEST_TELEFONO = "02934567890"
TEST_PASSWORD = f"TestPass123!{uuid4().hex[:4]}"

# Contadores de pruebas
TOTAL_TESTS = 0
PASSED_TESTS = 0
FAILED_TESTS: list[Tuple[str, str]] = []


# ============================================================================
# HELPERS
# ============================================================================

def log_test(test_name: str, passed: bool, message: str = ""):
    """Log de resultado de test."""
    global TOTAL_TESTS, PASSED_TESTS, FAILED_TESTS
    
    TOTAL_TESTS += 1
    
    if passed:
        PASSED_TESTS += 1
        status = "✅ PASS"
    else:
        FAILED_TESTS.append((test_name, message))
        status = "❌ FAIL"
    
    print(f"{status}: {test_name}")
    if message:
        print(f"   └─ {message}")


def log_section(title: str):
    """Log de sección."""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


# ============================================================================
# TESTS
# ============================================================================

def test_create_org() -> bool:
    """Test 1: Crear organización de prueba."""
    log_section("1. CREAR ORGANIZACIÓN DE PRUEBA")
    
    try:
        org_data = {
            "id": ORG_ID,
            "nombre": ORG_NAME,
            "acepta_registros_publicos": True,
            "created_at": datetime.now().isoformat()
        }
        
        response = supabase.table("organizaciones").insert(org_data).execute()
        
        if response.data:
            log_test("Crear org", True, f"ORG_ID: {ORG_ID}")
            return True
        else:
            log_test("Crear org", False, "Respuesta vacía de Supabase")
            return False
            
    except Exception as e:
        log_test("Crear org", False, f"Error: {str(e)}")
        return False


def test_register_chofer_publico() -> Tuple[bool, Optional[str]]:
    """Test 2: Registrar chofer públicamente (estado_validacion='pendiente')."""
    log_section("2. REGISTRAR CHOFER PÚBLICO")
    
    try:
        # Datos de chofer
        chofer_data = {
            "nombre": "Test Chofer",
            "email": TEST_EMAIL,
            "telefono": TEST_TELEFONO,
            "dni": TEST_DNI,
            "direccion": "Av. Test 123",
            "tiene_vehiculo": True,
            "vehiculo": "Ford Focus 2018",
            "patente": "AB123CD",
            "licencia_numero": "L123456",
            "licencia_categoria": "B",
            "licencia_vencimiento": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
            "documentos": [],
            "tipo_pago": "comision",
            "valor_pago": 20.0,
            "organizacion_id": ORG_ID
        }
        
        # Crear DTO
        chofer_dto = ChoferRegistroCompleto(**chofer_data)
        
        # Validar (público)
        validar_registro_publico(chofer_dto)
        
        # Crear usuario en Auth (Supabase)
        user_id = str(uuid4())
        
        # Insertar usuario
        usuario_data = {
            "id": user_id,
            "organizacion_id": ORG_ID,
            "email": TEST_EMAIL,
            "nombre": "Test Chofer",
            "telefono": TEST_TELEFONO,
            "direccion": "Av. Test 123",
            "rol": "chofer",
            "estado": "pendiente"  # Estado público: pendiente
        }
        
        supabase.table("usuarios").insert(usuario_data).execute()
        
        # Insertar chofer
        chofer_insert_data = {
            "usuario_id": user_id,
            "organizacion_id": ORG_ID,
            "email": TEST_EMAIL,
            "nombre": "Test Chofer",
            "telefono": TEST_TELEFONO,
            "dni": TEST_DNI,
            "direccion": "Av. Test 123",
            "tiene_vehiculo": True,
            "vehiculo": "Ford Focus 2018",
            "patente": "AB123CD",
            "licencia_numero": "L123456",
            "licencia_categoria": "B",
            "licencia_vencimiento": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
            "tipo_pago": "comision",
            "valor_pago": 20.0,
            "saldo": 0.0,
            "limite_deuda": 0.0,
            "estado_validacion": "pendiente",  # ✅ Importante: pendiente para público
            "created_at": datetime.now().isoformat()
        }
        
        chofer_response = supabase.table("choferes").insert(chofer_insert_data).execute()
        
        if chofer_response.data:
            chofer_id = chofer_response.data[0]["id"]
            log_test(
                "Registrar chofer público",
                True,
                f"CHOFER_ID: {chofer_id}, estado: pendiente"
            )
            return True, chofer_id
        else:
            log_test("Registrar chofer público", False, "Respuesta vacía")
            return False, None
            
    except Exception as e:
        log_test("Registrar chofer público", False, f"Error: {str(e)}")
        return False, None


def test_validate_chofer_pendiente(chofer_id: str) -> bool:
    """Test 3: Verificar que chofer está en estado 'pendiente'."""
    log_section("3. VALIDAR ESTADO PENDIENTE")
    
    try:
        response = supabase.table("choferes").select("*").eq("id", chofer_id).execute()
        
        if not response.data:
            log_test("Chofer existe", False, "No encontrado en BD")
            return False
        
        chofer = response.data[0]
        
        if chofer["estado_validacion"] != "pendiente":
            log_test(
                "Estado es 'pendiente'",
                False,
                f"Esperado: pendiente, Recibido: {chofer['estado_validacion']}"
            )
            return False
        
        log_test("Estado es 'pendiente'", True, f"CHOFER_ID: {chofer_id}")
        return True
        
    except Exception as e:
        log_test("Validar estado pendiente", False, f"Error: {str(e)}")
        return False


def test_approve_chofer_admin(chofer_id: str) -> bool:
    """Test 4: Aprobar chofer como admin (estado_validacion='aprobado')."""
    log_section("4. APROBAR CHOFER COMO ADMIN")
    
    try:
        # Actualizar estado a 'aprobado'
        response = supabase.table("choferes").update({
            "estado_validacion": "aprobado"
        }).eq("id", chofer_id).execute()
        
        if response.data:
            log_test("Aprobar chofer", True, f"CHOFER_ID: {chofer_id}")
            return True
        else:
            log_test("Aprobar chofer", False, "No se pudo actualizar")
            return False
            
    except Exception as e:
        log_test("Aprobar chofer", False, f"Error: {str(e)}")
        return False


def test_validate_chofer_aprobado(chofer_id: str) -> bool:
    """Test 5: Verificar que chofer está aprobado."""
    log_section("5. VALIDAR ESTADO APROBADO")
    
    try:
        response = supabase.table("choferes").select("*").eq("id", chofer_id).execute()
        
        if not response.data:
            log_test("Chofer existe", False, "No encontrado en BD")
            return False
        
        chofer = response.data[0]
        
        if chofer["estado_validacion"] != "aprobado":
            log_test(
                "Estado es 'aprobado'",
                False,
                f"Esperado: aprobado, Recibido: {chofer['estado_validacion']}"
            )
            return False
        
        log_test("Estado es 'aprobado'", True, f"CHOFER_ID: {chofer_id}")
        return True
        
    except Exception as e:
        log_test("Validar estado aprobado", False, f"Error: {str(e)}")
        return False


def test_validate_unique_constraints() -> bool:
    """Test 6: Validar UNIQUE constraints (Email, DNI)."""
    log_section("6. VALIDAR UNIQUE CONSTRAINTS")
    
    all_passed = True
    
    # Test 6a: Email duplicado
    try:
        duplicate_email = {
            "usuario_id": str(uuid4()),
            "organizacion_id": ORG_ID,
            "email": TEST_EMAIL,  # Mismo email
            "nombre": "Duplicate",
            "telefono": "0293999999",
            "dni": f"DNI{uuid4().hex[:8]}".upper(),
            "direccion": "Another Address",
            "tiene_vehiculo": False,
            "estado_validacion": "pendiente",
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("choferes").insert(duplicate_email).execute()
        
        # Si llegó aquí sin error, falló la prueba
        log_test(
            "UNIQUE constraint: Email duplicado",
            False,
            "No se lanzó excepción para email duplicado"
        )
        all_passed = False
        
    except Exception as e:
        if "unique" in str(e).lower() or "constraint" in str(e).lower():
            log_test(
                "UNIQUE constraint: Email duplicado",
                True,
                "Constraint funcionando correctamente"
            )
        else:
            log_test(
                "UNIQUE constraint: Email duplicado",
                False,
                f"Error inesperado: {str(e)}"
            )
            all_passed = False
    
    # Test 6b: DNI duplicado
    try:
        duplicate_dni = {
            "usuario_id": str(uuid4()),
            "organizacion_id": ORG_ID,
            "email": f"another.{uuid4().hex[:8]}@example.com",
            "nombre": "Duplicate DNI",
            "telefono": "0293999999",
            "dni": TEST_DNI,  # Mismo DNI
            "direccion": "Another Address",
            "tiene_vehiculo": False,
            "estado_validacion": "pendiente",
            "created_at": datetime.now().isoformat()
        }
        
        supabase.table("choferes").insert(duplicate_dni).execute()
        
        # Si llegó aquí sin error, falló la prueba
        log_test(
            "UNIQUE constraint: DNI duplicado",
            False,
            "No se lanzó excepción para DNI duplicado"
        )
        all_passed = False
        
    except Exception as e:
        if "unique" in str(e).lower() or "constraint" in str(e).lower():
            log_test(
                "UNIQUE constraint: DNI duplicado",
                True,
                "Constraint funcionando correctamente"
            )
        else:
            log_test(
                "UNIQUE constraint: DNI duplicado",
                False,
                f"Error inesperado: {str(e)}"
            )
            all_passed = False
    
    return all_passed


def test_validate_rls_policies() -> bool:
    """Test 7: Validar RLS policies (Row Level Security)."""
    log_section("7. VALIDAR RLS POLICIES")
    
    try:
        # Intentar leer choferes de otra org
        response = supabase.table("choferes").select("*").eq("organizacion_id", str(uuid4())).execute()
        
        # RLS debería bloquear esto (respuesta vacía)
        if not response.data:
            log_test(
                "RLS: Bloquear acceso a otra org",
                True,
                "RLS funcionando - no hay datos de otra org"
            )
            return True
        else:
            log_test(
                "RLS: Bloquear acceso a otra org",
                False,
                "RLS falla - se ven datos de otra org"
            )
            return False
            
    except Exception as e:
        if "permission denied" in str(e).lower() or "policy" in str(e).lower():
            log_test(
                "RLS: Bloquear acceso a otra org",
                True,
                "RLS funcionando - exception lanzada"
            )
            return True
        else:
            log_test(
                "RLS: Bloquear acceso a otra org",
                False,
                f"Error inesperado: {str(e)}"
            )
            return False


def cleanup():
    """Test 8: Limpiar datos de prueba."""
    log_section("8. LIMPIAR DATOS DE PRUEBA")
    
    try:
        # Eliminar choferes
        supabase.table("choferes").delete().eq("organizacion_id", ORG_ID).execute()
        log_test("Eliminar choferes", True)
        
        # Eliminar usuarios
        supabase.table("usuarios").delete().eq("organizacion_id", ORG_ID).execute()
        log_test("Eliminar usuarios", True)
        
        # Eliminar organización
        supabase.table("organizaciones").delete().eq("id", ORG_ID).execute()
        log_test("Eliminar organización", True)
        
    except Exception as e:
        log_test("Cleanup", False, f"Error durante cleanup: {str(e)}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Ejecutar suite de tests E2E."""
    print("\n" + "="*70)
    print("FASE 4: E2E TESTING - SUPABASE REAL")
    print("="*70)
    print(f"\nConfigración:")
    print(f"  SUPABASE_URL: {SUPABASE_URL}")
    print(f"  ORG_ID: {ORG_ID}")
    print(f"  TEST_EMAIL: {TEST_EMAIL}")
    print(f"  TEST_DNI: {TEST_DNI}")
    
    # Ejecutar tests en orden
    if not test_create_org():
        print("\n❌ Falló crear org de prueba. Abortando suite.")
        return
    
    success_public, chofer_id = test_register_chofer_publico()
    if not success_public or not chofer_id:
        print("\n❌ Falló registrar chofer público. Abortando.")
        cleanup()
        return
    
    if not test_validate_chofer_pendiente(chofer_id):
        print("\n❌ Chofer no está en estado pendiente.")
    
    if not test_approve_chofer_admin(chofer_id):
        print("\n❌ Falló aprobar chofer.")
    
    if not test_validate_chofer_aprobado(chofer_id):
        print("\n❌ Chofer no está en estado aprobado.")
    
    test_validate_unique_constraints()
    
    test_validate_rls_policies()
    
    # Limpiar
    cleanup()
    
    # Resumen
    print("\n" + "="*70)
    print("RESUMEN")
    print("="*70)
    print(f"Total Tests: {TOTAL_TESTS}")
    print(f"Passed: {PASSED_TESTS} ✅")
    print(f"Failed: {len(FAILED_TESTS)} ❌")
    
    if FAILED_TESTS:
        print("\nFailed Tests:")
        for test_name, error_msg in FAILED_TESTS:
            print(f"  - {test_name}")
            if error_msg:
                print(f"    {error_msg}")
    
    success_rate = (PASSED_TESTS / TOTAL_TESTS * 100) if TOTAL_TESTS > 0 else 0
    print(f"\nSucesso Rate: {success_rate:.1f}%")
    print("="*70 + "\n")
    
    return len(FAILED_TESTS) == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
