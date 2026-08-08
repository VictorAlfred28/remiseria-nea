import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def format_whatsapp_number(phone: str) -> str:
    """Formatea automáticamente el número a formato internacional, enfocado en Argentina (549)."""
    clean_phone = str(phone).strip().replace("+", "").replace(" ", "").replace("-", "")
    
    if len(clean_phone) == 10 and clean_phone.isdigit():
        # Si tiene 10 digitos asume código de área + número local de Argentina sin prefijo
        clean_phone = f"549{clean_phone}"
    elif len(clean_phone) == 12 and clean_phone.startswith("54") and not clean_phone.startswith("549"):
        # Si tiene 54 pero le falta el 9 de celular
        clean_phone = f"549{clean_phone[2:]}"
        
    return clean_phone

async def send_whatsapp_message(instance_name: str, phone_number: str, message: str):
    """
    Envia un texto plano via Evolution API a un usuario final.
    """
    # Limpiar y auto-completar formato
    phone_number = format_whatsapp_number(phone_number)
    
    # Injection del sufijo estandar de WhatsApp en Evolution API si no lo tiene
    if "@s.whatsapp.net" not in phone_number and "@g.us" not in phone_number:
        phone_number = f"{phone_number}@s.whatsapp.net"
    url = f"{settings.EVOLUTION_URL}/message/sendText/{instance_name}"
    headers = {
        "apikey": settings.EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "number": phone_number,
        "text": message
    }
    
    async with httpx.AsyncClient() as client:
        try:
             res = await client.post(url, headers=headers, json=payload, timeout=5.0)
             if res.status_code >= 400:
                 try:
                     error_data = res.json()
                     # Revisar si es un error de "número no existe en WhatsApp"
                     if isinstance(error_data.get("response", {}).get("message"), list):
                         for msg in error_data["response"]["message"]:
                             if msg.get("exists") is False:
                                 logger.warning(f"Evolution API: El número {phone_number} no tiene WhatsApp registrado. Omitiendo alerta de error.")
                                 return
                 except Exception:
                     pass
                 logger.error(f"Error Evolution API: {res.text}")
        except Exception as e:
             logger.error(f"Error enviando WPP: {e}")

async def send_whatsapp_list_message(instance_name: str, phone_number: str, title: str, description: str, button_text: str, sections: list):
    """
    Envia un mensaje interactivo de tipo Lista (List Message) a través de Evolution API.
    Apto para pedir calificación con 1 a 5 estrellas.
    """
    # Limpiar y auto-completar formato
    phone_number = format_whatsapp_number(phone_number)
    
    # Injection del sufijo estandar de WhatsApp en Evolution API si no lo tiene
    if "@s.whatsapp.net" not in phone_number and "@g.us" not in phone_number:
        phone_number = f"{phone_number}@s.whatsapp.net"
        
    url = f"{settings.EVOLUTION_URL}/message/sendList/{instance_name}"
    headers = {
        "apikey": settings.EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "number": phone_number,
        "title": title,
        "description": description,
        "buttonText": button_text,
        "sections": sections
    }
    
    async with httpx.AsyncClient() as client:
        try:
             res = await client.post(url, headers=headers, json=payload, timeout=5.0)
             if res.status_code >= 400:
                 try:
                     error_data = res.json()
                     if isinstance(error_data.get("response", {}).get("message"), list):
                         for msg in error_data["response"]["message"]:
                             if msg.get("exists") is False:
                                 logger.warning(f"Evolution API SendList: El número {phone_number} no tiene WhatsApp registrado. Omitiendo alerta.")
                                 return
                 except Exception:
                     pass
                 logger.error(f"Error Evolution API SendList: {res.text}")
        except Exception as e:
             logger.error(f"Error enviando WPP List: {e}")
