"""
FASE 3.2 - TESTING: Validaciones Centralizadas (CON MOCKS)

Script para validar que:
1. Las validaciones se ejecutan correctamente
2. Los errores son consistentes
3. No hay regresiones

EJECUCIÓN:
    python backend/scripts/test_validaciones_fase_3_2_mocked.py
"""

import sys
import os

# Agregar rutas de búsqueda de módulos
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, Any, Optional
from unittest.mock import Mock, patch, MagicMock

# ============================================================================
# MOCK: Supabase Client
# ============================================================================

class MockResponse:
    """Mock de respuesta de Supabase."""
    def __init__(self, data: list):
        self.data = data
    
    def execute(self):
        return self


class MockTable:
    """Mock de tabla de Supabase."""
    def __init__(self, table_name: str):
        self.table_name = table_name
        self._select_fields = []
        self._filters = {}
    
    def select(self, fields):
        self._select_fields = fields
        return self
    
    def eq(self, field, value):
        self._filters[field] = value
        return self
    
    def execute(self):
        # Simulaciones básicas de datos
        if self.table_name == "usuarios":
            # Simular emails duplicados conocidos
            if self._filters.get("email") == "admin@org.com":
                return MockResponse([{"id": "existing_user"}])
            return MockResponse([])
        
        elif self.table_name == "choferes":
            # Simular DNIs duplicados conocidos
            if self._filters.get("dni") == "DNI00000001":
                return MockResponse([{"id": "existing_chofer"}])
            return MockResponse([])
        
        elif self.table_name == "organizaciones":
            # Simular org válida
            if self._filters.get("id"):
                return MockResponse([{
                    "id": str(self._filters.get("id")),
                    "acepta_registros_publicos": True
                }])
            return MockResponse([])
        
        return MockResponse([])


class MockSupabaseClient:
    """Mock del cliente Supabase."""
    def __init__(self):
        self.auth = MagicMock()
        self.auth.admin = MagicMock()
    
    def table(self, table_name: str):
        return MockTable(table_name)


# ============================================================================
# SETUP: Inyectar mocks antes de importar módulos
# ============================================================================

sys.modules['app.db.supabase'] = Mock()

# Crear mock de Supabase
mock_supabase = MockSupabaseClient()
sys.modules['app.db.supabase'].supabase = mock_supabase

# Importar con mock inyectado
try:
    from app.schemas.domain import ChoferRegistroCompleto
    from app.core.validators import (
        validar_campos_comunes,
        validar_registro_publico,
        validar_registro_admin,
        ValidacionError
    )
    from fastapi import HTTPException
except ImportError as e:
    print(f"❌ Error importando módulos: {e}")
    print(f"   Path actual: {sys.path}")
    sys.exit(1)


# ============================================================================
# DATOS DE PRUEBA
# ============================================================================

ORG_ID = uuid4()
ORG_ID_OTRO = uuid4()

# Datos válidos (HAPPY PATH)
DATOS_VALIDOS = {
    "nombre": "Juan García López",
    "email": f"juan.garcia.{uuid4().hex[:8]}@example.com",
    "telefono": "02934123456",
    "dni": f"DNI{uuid4().hex[:8]}".upper(),
    "direccion": "Av. San Martín 123, Corrientes",
    "licencia_numero": "A123456",
    "licencia_categoria": "B",
    "licencia_vencimiento": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
    "tiene_vehiculo": True,
    "vehiculo": "Toyota Corolla 2018",
    "patente": "ABC1234",
    "documentos": [
        {"tipo": "dni_frente", "url": "https://storage.example.com/dni_frente.jpg"},
        {"tipo": "dni_dorso", "url": "https://storage.example.com/dni_dorso.jpg"},
    ],
    "tipo_pago": "comision",
    "valor_pago": 15.5,
    "organizacion_id": ORG_ID
}

# Casos de prueba
TEST_CASES = {
    "VALID_DATA": {
        "description": "Datos válidos completos",
        "data": DATOS_VALIDOS.copy(),
        "expect_error": False,
        "endpoint": "ambos"
    },
    
    "INVALID_EMAIL_DUPLICADO": {
        "description": "Email duplicado en misma org",
        "data": {**DATOS_VALIDOS.copy(), "email": "admin@org.com"},
        "expect_error": True,
        "error_substring": "Email ya registrado",
        "endpoint": "ambos"
    },
    
    "INVALID_DNI_DUPLICADO": {
        "description": "DNI duplicado en misma org",
        "data": {**DATOS_VALIDOS.copy(), "dni": "DNI00000001"},
        "expect_error": True,
        "error_substring": "DNI ya registrado",
        "endpoint": "ambos"
    },
    
    "INVALID_TELEFONO_CORTO": {
        "description": "Teléfono con menos de 10 dígitos",
        "data": {**DATOS_VALIDOS.copy(), "telefono": "123456"},
        "expect_error": True,
        "error_substring": "Teléfono inválido",
        "endpoint": "ambos"
    },
    
    "INVALID_LICENCIA_VENCIDA": {
        "description": "Licencia con fecha de vencimiento <= hoy",
        "data": {**DATOS_VALIDOS.copy(), "licencia_vencimiento": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")},
        "expect_error": True,
        "error_substring": "Licencia vencida",
        "endpoint": "ambos"
    },
    
    "INVALID_LICENCIA_FORMATO": {
        "description": "Licencia con formato incorrecto",
        "data": {**DATOS_VALIDOS.copy(), "licencia_vencimiento": "2024/12/31"},
        "expect_error": True,
        "error_substring": "Formato de fecha licencia inválido",
        "endpoint": "ambos"
    },
    
    "INVALID_PATENTE_FALTANTE": {
        "description": "Patente faltante pero tiene_vehiculo=True",
        "data": {**DATOS_VALIDOS.copy(), "tiene_vehiculo": True, "patente": None},
        "expect_error": True,
        "error_substring": "Patente es requerida",
        "endpoint": "ambos"
    },
    
    "INVALID_PATENTE_LONGITUD": {
        "description": "Patente con longitud inválida",
        "data": {**DATOS_VALIDOS.copy(), "patente": "AB123"},
        "expect_error": True,
        "error_substring": "Patente inválida",
        "endpoint": "ambos"
    },
    
    "VALID_SIN_VEHICULO": {
        "description": "Sin vehículo (tiene_vehiculo=False) - patente no requerida",
        "data": {**DATOS_VALIDOS.copy(), "tiene_vehiculo": False, "patente": None, "vehiculo": None},
        "expect_error": False,
        "endpoint": "ambos"
    },
    
    "VALID_SIN_LICENCIA": {
        "description": "Sin datos de licencia (opcional)",
        "data": {**DATOS_VALIDOS.copy(), "licencia_numero": None, "licencia_categoria": None, "licencia_vencimiento": None},
        "expect_error": False,
        "endpoint": "ambos"
    },
    
    "ADMIN_ORG_MISMATCH": {
        "description": "[ADMIN ONLY] org_id en claims no coincide",
        "data": {**DATOS_VALIDOS.copy(), "organizacion_id": ORG_ID_OTRO},
        "expect_error": True,
        "error_substring": "No autorizado",
        "endpoint": "admin"
    },
}


# ============================================================================
# UTILIDADES DE TESTING
# ============================================================================

def crear_dto(data_dict: Dict[str, Any]) -> ChoferRegistroCompleto:
    """Crear instancia de ChoferRegistroCompleto desde dict."""
    return ChoferRegistroCompleto(**data_dict)


def test_validacion(test_name: str, test_case: Dict[str, Any], endpoint: str) -> tuple:
    """
    Ejecutar una validación.
    
    Returns:
        (success: bool, error_message: Optional[str])
    """
    try:
        data = crear_dto(test_case["data"])
        
        with patch('app.db.supabase.supabase', mock_supabase):
            if endpoint == "admin":
                validar_registro_admin(data, ORG_ID)
            elif endpoint == "public":
                validar_registro_publico(data)
            else:
                return False, f"Endpoint inválido: {endpoint}"
        
        # Si no hay error y se espera error, es FALLO
        if test_case["expect_error"]:
            return False, f"Se esperaba error pero pasó validación"
        
        # Si no hay error y NO se espera error, es ÉXITO
        return True, None
        
    except HTTPException as e:
        # Si hay error esperado, verificar que el mensaje es correcto
        if test_case["expect_error"]:
            error_substring = test_case.get("error_substring")
            if error_substring and error_substring not in str(e.detail):
                return False, f"Error pero mensaje incorrecto. Esperaba: '{error_substring}', Recibido: '{e.detail}'"
            return True, None
        else:
            return False, f"Error no esperado: {e.detail}"
    
    except Exception as e:
        return False, f"Excepción inesperada: {type(e).__name__}: {str(e)}"


# ============================================================================
# EJECUCIÓN DE TESTS
# ============================================================================

def main():
    """Ejecutar suite de tests."""
    print("\n" + "="*80)
    print("FASE 3.2: TESTING - VALIDACIONES CENTRALIZADAS (CON MOCKS)")
    print("="*80 + "\n")
    
    total_tests = 0
    passed_tests = 0
    failed_tests = []
    
    for test_name, test_case in TEST_CASES.items():
        endpoint = test_case.get("endpoint", "ambos")
        endpoints_a_probar = ["admin", "public"] if endpoint == "ambos" else [endpoint]
        
        for ep in endpoints_a_probar:
            total_tests += 1
            test_full_name = f"{test_name} [{ep}]"
            
            success, error_msg = test_validacion(test_name, test_case, ep)
            
            if success:
                print(f"✅ PASS: {test_full_name}")
                passed_tests += 1
            else:
                print(f"❌ FAIL: {test_full_name}")
                if error_msg:
                    print(f"   └─ {error_msg}")
                failed_tests.append((test_full_name, error_msg))
    
    # Resumen
    print("\n" + "="*80)
    print(f"RESUMEN: {passed_tests}/{total_tests} tests pasados")
    print("="*80)
    
    if failed_tests:
        print("\n❌ TESTS FALLIDOS:")
        for test_name, error_msg in failed_tests:
            print(f"  - {test_name}")
            if error_msg:
                print(f"    └─ {error_msg}")
        print(f"\n❌ Total: {len(failed_tests)} test(s) fallido(s)")
        return False
    else:
        print("\n✅ TODOS LOS TESTS PASARON!")
        print(f"✅ Total: {total_tests} test(s) exitoso(s)")
        return True


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ ERROR CRÍTICO: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
