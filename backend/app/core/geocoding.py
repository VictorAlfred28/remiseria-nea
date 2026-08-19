import httpx
import logging
import random
from app.core.config import settings

logger = logging.getLogger(__name__)

async def geocode_address(address: str, city_context: str = "Corrientes, Argentina") -> tuple[float, float]:
    """
    Intenta geocodificar la dirección usando Google Maps o Nominatim (OpenStreetMap).
    Siempre devuelve una (lat, lng). Si todo falla, levanta un ValueError.
    """
    # Limpiar y concatenar la dirección con la ciudad para mayor precisión
    full_address = f"{address}, {city_context}"
    
    # 1. Intentar con Google Maps API si la llave está configurada
    if settings.GOOGLE_MAPS_API_KEY:
        try:
            url = f"https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                "address": full_address,
                "key": settings.GOOGLE_MAPS_API_KEY
            }
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=5.0)
                data = response.json()
                if data.get("status") == "OK" and data.get("results"):
                    location = data["results"][0]["geometry"]["location"]
                    logger.info(f"Geocodificado con Google Maps: {address} -> {location['lat']}, {location['lng']}")
                    return float(location["lat"]), float(location["lng"])
        except Exception as e:
            logger.warning(f"Falla en Google Maps Geocoding ({e}). Saltando al Fallback (Nominatim).")
            
    # 2. Fallback: Nominatim (OpenStreetMap)
    # Importante: Nominatim requiere un User-Agent identificatorio real por sus normativas de uso gratuito.
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": full_address,
            "format": "json",
            "limit": 1
        }
        headers = {
            "User-Agent": "ViajesNeaAI/1.0 (contacto@agentech.ar)"
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=headers, timeout=5.0)
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                lat = float(data[0]["lat"])
                lng = float(data[0]["lon"])
                logger.info(f"Geocodificado con Nominatim: {address} -> {lat}, {lng}")
                return lat, lng
    except Exception as e:
        logger.warning(f"Falla en Nominatim Geocoding ({e}).")

    # 3. Fallback crítico: Error en lugar de devolver default
    logger.error(f"Geocoding falló por completo para '{full_address}'.")
    raise ValueError(f"No se pudo obtener la ubicación para la dirección: {address}")
