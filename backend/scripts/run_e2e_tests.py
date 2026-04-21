#!/usr/bin/env python
"""
Script interactivo para solicitar credenciales Supabase y ejecutar tests E2E

Ejecutar con:
    python backend/scripts/run_e2e_tests.py
"""

import os
import sys
import subprocess
from getpass import getpass

def main():
    print("\n" + "="*70)
    print("FASE 4: E2E Testing Setup - Supabase Configuration")
    print("="*70 + "\n")
    
    # Solicitar credenciales
    print("Por favor, proporciona tus credenciales Supabase.")
    print("(Encontrar en: Dashboard → Project Settings → API)\n")
    
    supabase_url = input("SUPABASE_URL (ej: https://xxxxx.supabase.co): ").strip()
    
    if not supabase_url.startswith("https://"):
        print("❌ ERROR: URL debe comenzar con https://")
        return False
    
    supabase_key = getpass("SUPABASE_SERVICE_ROLE_KEY (oculto): ").strip()
    
    if not supabase_key or len(supabase_key) < 50:
        print("❌ ERROR: Key inválida o demasiado corta")
        return False
    
    # Exportar variables de entorno
    os.environ["SUPABASE_URL"] = supabase_url
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = supabase_key
    
    print("\n✅ Credenciales configuradas")
    print("   Ejecutando tests E2E...\n")
    
    # Ejecutar test E2E
    try:
        result = subprocess.run(
            [sys.executable, "backend/scripts/test_e2e_fase4_supabase.py"],
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Error ejecutando tests: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
