import math
import logging
from app.db.supabase import supabase
from typing import Dict, Any

logger = logging.getLogger(__name__)

def calculate_fare(distance_km: float, org_id: str, minutes_wait: int = 0, extras: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Calcula la tarifa dinámica v2.0 usando la configuración de la base de datos.
    TOTAL = costo_base + costo_distancia + costo_espera + extras - descuentos
    """
    try:
        # Obtenemos la tarifa activa para la organización
        resp = supabase.table("tariff_configs").select("*").eq("organizacion_id", org_id).eq("is_active", True).execute()
        
        if not resp.data:
            logger.warning(f"No hay tarifa activa para organización {org_id}. Fallback a valores por defecto.")
            t = {
                "base_fare": 2500,
                "per_fraction_price": 175,
                "fraction_km": 0.1,
                "wait_free_minutes": 5,
                "wait_price_per_minute": 250,
                "trunk_price": 2500,
                "dynamic_multiplier": 1.0
            }
        else:
            t = resp.data[0]

        base_fare = float(t.get("base_fare") or 2500)
        fraction_km = float(t.get("fraction_km") or 0.1)
        fraction_price = float(t.get("per_fraction_price") or 175)
        wait_free_mins = int(t.get("wait_free_minutes") or 5)
        wait_price_min = float(t.get("wait_price_per_minute") or 250)
        trunk_price = float(t.get("trunk_price") or 2500)
        multiplier = float(t.get("dynamic_multiplier") or 1.0)

        # 1. Costo por Distancia
        if distance_km <= 1.0:
            costo_viaje = base_fare
        else:
            extra_dist = distance_km - 1.0
            fractions_count = round(extra_dist / fraction_km)
            costo_viaje = base_fare + (fractions_count * fraction_price)

        # 2. Costo por Espera
        minutos_cobrables = max(0, minutes_wait - wait_free_mins)
        costo_espera = minutos_cobrables * wait_price_min

        # 3. Extras
        costo_extras = 0
        if extras.get("trunk"):
            costo_extras += trunk_price

        # 4. Total con Multiplicador Dinámico
        subtotal = costo_viaje + costo_espera + costo_extras
        total = subtotal * multiplier

        return {
            "total": round(total, 2),
            "breakdown": {
                "distance_cost": round(costo_viaje, 2),
                "wait_cost": round(costo_espera, 2),
                "extras_cost": round(costo_extras, 2),
                "multiplier": multiplier
            }
        }
        
    except Exception as e:
        logger.error(f"Error calculando tarifa: {e}")
        return {"total": 0.0, "breakdown": {}}

def generate_price_list(org_id: str, max_km: int = 5) -> str:
    """
    Genera un listado de precios formateado en texto para devolver por WhatsApp.
    """
    try:
        resp = supabase.table("tariff_configs").select("*").eq("organizacion_id", org_id).eq("is_active", True).execute()
        
        if not resp.data:
            return "No hay un tarifario activo configurado."

        t = resp.data[0]
        
        lines = [
            "📋 *TARIFARIO v2.0*",
            "-----------------------",
            f"🚗 Base (1 KM): *${float(t.get('base_fare') or 2500):.0f}*",
            f"📏 Cada {float(t.get('fraction_km') or 0.1)*1000:.0f}m extra: *${float(t.get('per_fraction_price') or 175):.0f}*",
            f"🕒 Espera: {int(t.get('wait_free_minutes') or 5)} min gratis, luego ${float(t.get('wait_price_per_minute') or 250):.0f}/min",
            f"🧳 Baúl: ${float(t.get('trunk_price') or 2500):.0f}",
            "-----------------------"
        ]
        
        # Obtener Destinos Fijos de la DB
        fd_resp = supabase.table("fixed_destinations").select("name, price").execute()
        if fd_resp.data:
            lines.append("📍 *Tarifas Fijas por Zonas:*")
            for fd in fd_resp.data:
                lines.append(f"• {fd['name']}: *${fd['price']:.0f}*")
            lines.append("-----------------------")

        lines.append("Ejemplos de viaje (solo distancia):")
        
        for km in range(1, max_km + 1):
            res = calculate_fare(float(km), org_id)
            lines.append(f"📍 {km} KM ➝ *${res['total']:.0f}*")
            
        return "\n".join(lines)
        
    except Exception as e:
        logger.error(f"Error generando listado de tarifas: {e}")
        return "Error al generar el tarifario."

