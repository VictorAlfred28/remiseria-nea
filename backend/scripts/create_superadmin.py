import sys
import os
from pathlib import Path

# Agregar el directorio backend al PYTHONPATH para importar app.db.supabase
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.db.supabase import supabase

def create_superadmin():
    email = "victoralfredo2498@gmail.com"
    password = "AdminPassword123!"

    print("Obteniendo organizacion base...")
    org_res = supabase.table("organizaciones").select("id").limit(1).execute()
    if not org_res.data:
        print("Error: No existe la organizacion principal en la tabla 'organizaciones'.")
        return
        
    org_id = org_res.data[0]["id"]
    print(f"Organizacion Base detectada: {org_id}")

    print(f"Creando cuenta en el sistema de autenticacion ({email})...")
    user_id = None
    try:
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True
        })
        user_id = auth_response.user.id
        print(f"Auth User Creado correctamente. ID: {user_id}")
    except Exception as e:
        print(f"Error o usuario ya existe en Auth: {e}")
        return

    print("Insertando registro en public.usuarios con ROL: superadmin...")
    try:
        user_res = supabase.table("usuarios").insert({
            "id": user_id,
            "organizacion_id": org_id,
            "email": email,
            "nombre": "Administrador Supremo",
            "rol": "superadmin"
        }).execute()
        print("¡ÉXITO! SuperAdmin creado e insertado en la base de datos pública de forma correcta.")
        print(f"Email: {email}")
        print(f"Contraseña: {password}")
    except Exception as e:
        print(f"Error al insertar en la tabla usuarios: {e}")

if __name__ == "__main__":
    create_superadmin()
