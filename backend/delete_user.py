import os
import sys
import asyncio
import httpx

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.core.config import settings

SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY

async def delete_user(email):
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    async with httpx.AsyncClient() as client:
        page = 1
        per_page = 50
        while True:
            print(f"Fetching page {page}...")
            res = await client.get(f"{url}?page={page}&per_page={per_page}", headers=headers)
            if res.status_code != 200:
                print(f"Error: {res.status_code} {res.text}")
                break
            
            data = res.json()
            users = data.get("users", [])
            if not users:
                print("No more users found.")
                break
                
            for u in users:
                if u.get("email") == email:
                    print(f"Found user {email} with ID {u['id']}")
                    del_url = f"{url}/{u['id']}"
                    del_res = await client.delete(del_url, headers=headers)
                    print(f"Delete response: {del_res.status_code}")
                    return True
            page += 1

if __name__ == "__main__":
    email = "victoralfredo890@gmail.com"
    asyncio.run(delete_user(email))
