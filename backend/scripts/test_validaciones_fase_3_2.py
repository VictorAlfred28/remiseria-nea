"""
FASE 3.2 - TESTING: Validaciones Centralizadas

Script para validar que:
1. Ambos endpoints (/admin/chofer y /public/registro/chofer) funcionan correctamente
2. Las validaciones son idénticas (fuente única de verdad)
3. Los errores son consistentes
4. No hay regresiones

EJECUCIÓN:
    pytest backend/scripts/test_validaciones_fase_3_2.py -v

O sin pytest (ejecución directa):
    python backend/scripts/test_validaciones_fase_3_2.py
"""

import sys
sys.path.insert(0, '/root')

from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, Any, Optional

# Importar módulos a testear
from app.schemas.domain import ChoferRegistroCompleto
from app.core.validators import (
    validar_campos_comunes,
    validar_registro_publico,
    validar_registro_admin,
    ValidacionError
)
from fastapi import HTTPException


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
        {"tipo": "antecedentes", "url": "https://storage.example.com/antecedentes.jpg"}
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
        "description": "Email duplicado en misma org (debería fallar en validación DB)",
        "data": {**DATOS_VALIDOS.copy(), "email": "admin@org.com"},
        "expect_error": True,
        "error_substring": "Email ya registrado",
        "endpoint": "ambos"
    },
    
    "INVALID_DNI_DUPLICADO": {
        "description": "DNI duplicado en misma org (debería fallar en validación DB)",
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
    
    "INVALID_PATENTE_FALTANTE_VEHICULO": {
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
        "description": "[ADMIN ONLY] org_id en claims no coincide con data.organizacion_id",
        "data": {**DATOS_VALIDOS.copy(), "organizacion_id": ORG_ID_OTRO},
        "expect_error": True,
        "error_substring": "No autorizado",
        "endpoint": "admin"
    },
    
    "PUBLIC_ORG_INVALIDA": {
        "description": "[PUBLIC ONLY] Organización no válida (no existe en BD)",
        "data": {**DATOS_VALIDOS.copy(), "organizacion_id": uuid4()},
        "expect_error": True,
        "error_substring": "Organización no válida",
        "endpoint": "public"
    }
}


# ============================================================================
# UTILIDADES DE TESTING
# ============================================================================

def crear_dto(data_dict: Dict[str, Any]) -> ChoferRegistroCompleto:
    """Crear instancia de ChoferRegistroCompleto desde dict."""
    return ChoferRegistroCompleto(**data_dict)


def test_validacion(test_name: str, test_case: Dict[str, Any], endpoint: str) -> tuple[bool, Optional[str]]:
    """
    Ejecutar una validación.
    
    Args:
        test_name: Nombre del test
        test_case: Caso de prueba
        endpoint: "admin" o "public"
        
    Returns:
        (success: bool, error_message: Optional[str])
    """
    try:
        data = crear_dto(test_case["data"])
        
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
            if error_substring and error_substring not in e.detail:
                return False, f"Error pero mensaje incorrecto. Esperaba: '{error_substring}', Recibido: '{e.detail}'"
            return True, None
        else:
            return False, f"Error no esperado: {e.detail}"
    
    except Exception as e:
        return False, f"Excepción inesperada: {str(e)}"


# ============================================================================
# EJECUCIÓN DE TESTS
# ============================================================================

def main():
    """Ejecutar suite de tests."""
    print("\n" + "="*80)
    print("FASE 3.2: TESTING - VALIDACIONES CENTRALIZADAS")
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
        return False
    else:
        print("\n✅ TODOS LOS TESTS PASARON!")
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
