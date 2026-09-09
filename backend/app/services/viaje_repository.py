from typing import Dict, Any, List
from app.db.supabase import supabase

def insert_viaje(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Inserta un viaje en la base de datos."""
    resp = supabase.table("viajes").insert(payload).execute()
    return resp.data[0] if resp.data else {}

def get_viaje_activo_por_telefono(phone: str) -> List[Dict[str, Any]]:
    """
    Busca viajes activos (SOLICITADO o ACEPTADO) asociados a un número de teléfono en origen.
    No se puede cancelar si ya está EN_PUERTA o INICIADO por WhatsApp.
    """
    resp = supabase.table("viajes") \
        .select("*") \
        .filter("origen->>cliente_telefono", "eq", phone) \
        .in_("estado", ["SOLICITADO", "ACEPTADO"]) \
        .order("requested_at", desc=True) \
        .limit(1) \
        .execute()
    return resp.data

def cancel_viaje_atomico(viaje_id: str, phone: str) -> bool:
    """
    Intenta cancelar un viaje atómicamente, validando ID, teléfono y estado permitido.
    Retorna True si tuvo éxito, False si no se pudo cancelar.
    """
    resp = supabase.table("viajes").update({
        "estado": "CANCELADO"
    }).eq("id", viaje_id) \
      .filter("origen->>cliente_telefono", "eq", phone) \
      .in_("estado", ["SOLICITADO", "ACEPTADO"]) \
      .execute()
    
    return len(resp.data) > 0
