from typing import Dict, Any, Optional
from datetime import datetime

def build_base_viaje_payload(
    organizacion_id: str,
    origen_data: Dict[str, Any],
    destino_data: Dict[str, Any],
    precio: float,
    cliente_id: Optional[str] = None,
    canal_solicitud: str = "APP",
    creado_por_rol: str = "PASAJERO",
    orphan: bool = False,
    precio_original: float = 0.0,
    monto_descontado: float = 0.0,
    promocion_id: Optional[str] = None,
    usado_viaje_gratis: bool = False,
    tipo_viaje: str = "PERSONAL",
    empresa_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Construye el payload unificado para insertar en la tabla de viajes.
    """
    return {
        "organizacion_id": organizacion_id,
        "cliente_id": cliente_id,
        "orphan": orphan,
        "origen": origen_data,
        "destino": destino_data,
        "precio": precio,
        "final_price": precio,
        "precio_original": precio_original or precio,
        "monto_descontado": monto_descontado,
        "promocion_id": promocion_id,
        "estado": "SOLICITADO",
        "metodo_pago": "efectivo",
        "usado_viaje_gratis": usado_viaje_gratis,
        "tipo_viaje": tipo_viaje,
        "empresa_id": empresa_id,
        "fecha_solicitud": datetime.now().isoformat(),
        "requested_at": datetime.now().isoformat(),
        "canal_solicitud": canal_solicitud,
        "creado_por_rol": creado_por_rol
    }
