def normalize_estado(estado: str) -> str:
    """
    Normalizador lógico para los estados de los viajes.
    Absorbe inconsistencias históricas sin romper la API interna.
    """
    if not estado:
        return estado
        
    mapping = {
        "solicitado": "SOLICITADO",
        "requested": "SOLICITADO",
        "ACCEPTED": "ACEPTADO",
        "ARRIVED": "EN_PUERTA",
        "STARTED": "INICIADO",
        "FINISHED": "FINALIZADO",
        "cancelado": "CANCELADO"
    }
    return mapping.get(estado, estado)
