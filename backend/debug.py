import asyncio
import os
import json
from dotenv import load_dotenv
load_dotenv()

from app.db.supabase import supabase

def test_rpc():
    print("Obteniendo todos los viajes...")
    # Verificar viaje crudo
    v_resp = supabase.table("viajes").select("id, estado, organizacion_id, origen").limit(1).execute()
    print("Viaje CRUDO:", v_resp.data)
    
    if v_resp.data:
        v = v_resp.data[0]
        orga_id = v['organizacion_id']
        lat = v['origen']['lat']
        lng = v['origen']['lng']
        
        print(f"Llamando RPC con lat={lat}, lng={lng}, orga_id={orga_id}")
        res = supabase.rpc("get_viajes_cercanos", {
            "chofer_lat": float(lat),
            "chofer_lng": float(lng),
            "radius_km": 50,
            "target_orga_id": orga_id
        }).execute()
        
        print("RESULTADOS RPC:", len(res.data or []), "viajes devueltos.")
        for r in (res.data or []):
            print("  ->", r['id'], r['estado'])
            
if __name__ == "__main__":
    test_rpc()
