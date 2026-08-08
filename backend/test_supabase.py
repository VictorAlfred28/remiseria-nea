import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.supabase import supabase

def test():
    try:
        res = supabase.table("qr_nonces").select("*").limit(1).execute()
        print("Success, table exists! Data:", res.data)
    except Exception as e:
        print("Error accessing qr_nonces:", type(e), e)
        
    try:
        # Intenta insertar un nonce falso a ver qué pasa
        import uuid
        from datetime import datetime, timedelta, timezone
        nonce = str(uuid.uuid4())
        exp = datetime.now(timezone.utc) + timedelta(seconds=60)
        
        # Necesitamos un cliente_id válido para que no falle el foreign key
        user_res = supabase.table("usuarios").select("id").limit(1).execute()
        if user_res.data:
            cliente_id = user_res.data[0]["id"]
            res = supabase.table("qr_nonces").insert({
                "cliente_id": cliente_id,
                "nonce": nonce,
                "expira_en": exp.isoformat()
            }).execute()
            print("Insert success:", res.data)
        else:
            print("No users found to test insert")
    except Exception as e:
        print("Error inserting into qr_nonces:", type(e), e)

if __name__ == "__main__":
    test()
