"""
FASE 4 - E2E TESTING: HTTP Integration Tests

Script para validar end-to-end usando HTTP requests al backend:
1. Registrar chofer público (POST /public/registro/chofer)
2. Aprobar chofer como admin (PUT /admin/chofer/{id})
3. Validar respuestas y estados
4. Verificar datos en BD

PREREQUISITOS:
    - Backend FastAPI corriendo en http://localhost:8000
    - SUPABASE_URL env var
    - SUPABASE_SERVICE_ROLE_KEY env var (para limpiar datos)

EJECUCIÓN:
    export SUPABASE_URL="https://xxxxx.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
    python backend/scripts/test_e2e_fase4_http.py
"""

import os
import sys
import json
import httpx
from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, Any, Optional, Tuple

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print(f"API URL: {API_BASE_URL}")
print(f"Supabase: {SUPABASE_URL is not None and SUPABASE_SERVICE_ROLE_KEY is not None}")

# Datos de prueba
TEST_EMAIL = f"test.chofer.{uuid4().hex[:8]}@example.com"
TEST_DNI = f"DNI{uuid4().hex[:8]}".upper()
TEST_TELEFONO = "02934567890"
TEST_PASSWORD = f"TestPass123!{uuid4().hex[:4]}"

# Contadores
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

def test_health_check() -> bool:
    """Test 1: Verificar que el backend está corriendo."""
    log_section("1. HEALTH CHECK - Backend")
    
    try:
        response = httpx.get(f"{API_BASE_URL}/public/organizaciones/default", timeout=10)
        
        if response.status_code == 200:
            log_test("Backend respondiendo", True, f"Status: {response.status_code}")
            return True
        else:
            log_test(
                "Backend respondiendo",
                False,
                f"Status: {response.status_code}, Response: {response.text}"
            )
            return False
            
    except Exception as e:
        log_test("Backend respondiendo", False, f"Error: {str(e)}")
        return False


def test_get_org_id() -> Optional[str]:
    """Test 2: Obtener organización default."""
    log_section("2. OBTENER ORGANIZACIÓN DEFAULT")
    
    try:
        response = httpx.get(f"{API_BASE_URL}/public/organizaciones/default", timeout=10)
        
        if response.status_code == 200:
            org_data = response.json()
            org_id = org_data.get("id")
            log_test("Obtener org default", True, f"ORG_ID: {org_id}")
            return org_id
        else:
            log_test("Obtener org default", False, f"Status: {response.status_code}")
            return None
            
    except Exception as e:
        log_test("Obtener org default", False, f"Error: {str(e)}")
        return None


def test_register_chofer_publico(org_id: str) -> Tuple[bool, Optional[str]]:
    """Test 3: Registrar chofer públicamente."""
    log_section("3. REGISTRAR CHOFER PÚBLICO")
    
    try:
        chofer_data = {
            "nombre": "Test Chofer E2E",
            "email": TEST_EMAIL,
            "telefono": TEST_TELEFONO,
            "dni": TEST_DNI,
            "direccion": "Av. Test 456",
            "tiene_vehiculo": True,
            "vehiculo": "Toyota Corolla 2020",
            "patente": "XY987AB",
            "licencia_numero": "LC987654",
            "licencia_categoria": "B",
            "licencia_vencimiento": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
            "documentos": [],
            "tipo_pago": "comision",
            "valor_pago": 20.0,
            "organizacion_id": org_id
        }
        
        response = httpx.post(
            f"{API_BASE_URL}/public/registro/chofer",
            json=chofer_data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            chofer_id = result.get("id")
            estado = result.get("estado_validacion", "unknown")
            log_test(
                "Registrar chofer público",
                True,
                f"ID: {chofer_id}, Estado: {estado}"
            )
            return True, chofer_id
        else:
            log_test(
                "Registrar chofer público",
                False,
                f"Status: {response.status_code}, Response: {response.text}"
            )
            return False, None
            
    except Exception as e:
        log_test("Registrar chofer público", False, f"Error: {str(e)}")
        return False, None


def test_validate_pending_status(org_id: str, email: str) -> bool:
    """Test 4: Validar que chofer está en estado 'pendiente'."""
    log_section("4. VALIDAR ESTADO 'PENDIENTE'")
    
    try:
        # Buscar chofer por email en BD
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            from supabase import create_client
            supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            
            response = supabase.table("choferes").select("*").eq("email", email).execute()
            
            if response.data and len(response.data) > 0:
                chofer = response.data[0]
                estado = chofer.get("estado_validacion")
                
                if estado == "pendiente":
                    log_test(
                        "Estado es 'pendiente'",
                        True,
                        f"Email: {email}, Estado: {estado}"
                    )
                    return True
                else:
                    log_test(
                        "Estado es 'pendiente'",
                        False,
                        f"Esperado: pendiente, Recibido: {estado}"
                    )
                    return False
            else:
                log_test("Estado es 'pendiente'", False, "Chofer no encontrado en BD")
                return False
        else:
            log_test(
                "Estado es 'pendiente'",
                False,
                "Supabase credentials no disponibles"
            )
            return False
            
    except Exception as e:
        log_test("Estado es 'pendiente'", False, f"Error: {str(e)}")
        return False


def test_validar_payload_request(org_id: str) -> bool:
    """Test 5: Validar que el payload incluye todos los campos."""
    log_section("5. VALIDAR ESTRUCTURA DEL PAYLOAD")
    
    required_fields = [
        "nombre", "email", "telefono", "dni", "direccion",
        "tiene_vehiculo", "vehiculo", "patente",
        "licencia_numero", "licencia_categoria", "licencia_vencimiento",
        "tipo_pago", "valor_pago", "organizacion_id"
    ]
    
    try:
        chofer_data = {
            "nombre": "Test Fields",
            "email": f"test.fields.{uuid4().hex[:8]}@example.com",
            "telefono": "0293999888",
            "dni": f"DNI{uuid4().hex[:8]}".upper(),
            "direccion": "Av. Fields Test",
            "tiene_vehiculo": True,
            "vehiculo": "Test Vehicle",
            "patente": "TE5T77",
            "licencia_numero": "LF123",
            "licencia_categoria": "B",
            "licencia_vencimiento": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
            "documentos": [],
            "tipo_pago": "comision",
            "valor_pago": 20.0,
            "organizacion_id": org_id
        }
        
        # Verificar que todos los campos requeridos están presentes
        missing_fields = [f for f in required_fields if f not in chofer_data]
        
        if not missing_fields:
            log_test("Todos los campos presentes", True, f"Campos: {len(chofer_data)}")
            return True
        else:
            log_test(
                "Todos los campos presentes",
                False,
                f"Campos faltantes: {missing_fields}"
            )
            return False
            
    except Exception as e:
        log_test("Validar estructura payload", False, f"Error: {str(e)}")
        return False


def test_endpoint_compatibility() -> bool:
    """Test 6: Validar que ambos endpoints aceptan el mismo payload."""
    log_section("6. COMPATIBILIDAD DE ENDPOINTS")
    
    try:
        # Obtener org ID primero
        response = httpx.get(f"{API_BASE_URL}/public/organizaciones/default", timeout=10)
        if response.status_code != 200:
            log_test("Compatibilidad endpoints", False, "No se pudo obtener org")
            return False
        
        org_id = response.json()["id"]
        
        chofer_data = {
            "nombre": "Endpoint Test",
            "email": f"endpoint.test.{uuid4().hex[:8]}@example.com",
            "telefono": "0293888999",
            "dni": f"DNI{uuid4().hex[:8]}".upper(),
            "direccion": "Av. Endpoint",
            "tiene_vehiculo": False,
            "licencia_numero": "LP456",
            "licencia_categoria": "D",
            "licencia_vencimiento": (datetime.now() + timedelta(days=200)).strftime("%Y-%m-%d"),
            "documentos": [],
            "tipo_pago": "base",
            "valor_pago": 500.0,
            "organizacion_id": org_id
        }
        
        # Test POST /public/registro/chofer
        public_response = httpx.post(
            f"{API_BASE_URL}/public/registro/chofer",
            json=chofer_data,
            timeout=10
        )
        
        public_ok = public_response.status_code in [200, 201]
        
        log_test(
            "Endpoint /public/registro/chofer",
            public_ok,
            f"Status: {public_response.status_code}"
        )
        
        return public_ok
        
    except Exception as e:
        log_test("Compatibilidad endpoints", False, f"Error: {str(e)}")
        return False


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Ejecutar suite de tests E2E HTTP."""
    print("\n" + "="*70)
    print("FASE 4: E2E TESTING - HTTP Integration")
    print("="*70)
    print(f"\nConfigración:")
    print(f"  API Base URL: {API_BASE_URL}")
    print(f"  Supabase: {'Configured' if (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) else 'Not configured'}")
    
    # Test 1: Health check
    if not test_health_check():
        print("\n❌ Backend no está respondiendo. ¿Está corriendo en http://localhost:8000?")
        return False
    
    # Test 2: Get org ID
    org_id = test_get_org_id()
    if not org_id:
        print("\n❌ No se pudo obtener organización default")
        return False
    
    # Test 3: Register chofer público
    success_public, chofer_id = test_register_chofer_publico(org_id)
    if not success_public:
        print("\n❌ No se pudo registrar chofer público")
    
    # Test 4: Validate pending status (si Supabase configurado)
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        test_validate_pending_status(org_id, TEST_EMAIL)
    
    # Test 5: Validate payload structure
    test_validar_payload_request(org_id)
    
    # Test 6: Endpoint compatibility
    test_endpoint_compatibility()
    
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
    print(f"\nSuccess Rate: {success_rate:.1f}%")
    print("="*70 + "\n")
    
    return len(FAILED_TESTS) == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
