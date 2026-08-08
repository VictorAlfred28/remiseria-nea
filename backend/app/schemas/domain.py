from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

class Organizacion(BaseModel):
    id: UUID
    nombre: str
    dominio: Optional[str] = None
    whatsapp_numero: Optional[str] = None
    plan: str
    activo: bool


    model_config = ConfigDict(from_attributes=True)

class Usuario(BaseModel):
    id: UUID
    organizacion_id: UUID
    email: str
    nombre: str
    telefono: Optional[str] = None
    rol: str
    activo: bool
    estado: str = "aprobado"
    direccion: Optional[str] = None
    puntos_actuales: int = 0
    viajes_gratis: int = 0

    model_config = ConfigDict(from_attributes=True)

class Chofer(BaseModel):
    id: UUID
    organizacion_id: UUID
    usuario_id: UUID
    vehiculo: Optional[str] = None
    patente: Optional[str] = None
    dni: Optional[str] = None
    estado: Optional[str] = None
    estado_validacion: str = "pendiente"
    licencia_numero: Optional[str] = None
    licencia_categoria: Optional[str] = None
    licencia_vencimiento: Optional[str] = None
    documentos: List[Dict[str, Any]] = []
    tiene_vehiculo: bool = True
    lat: Optional[float] = None
    lng: Optional[float] = None
    tipo_pago: Optional[str] = "comision"
    valor_pago: Optional[float] = 0.0
    saldo: float = 0.0
    limite_deuda: float = -2000.0

    model_config = ConfigDict(from_attributes=True)

class ChoferRegistroCompleto(BaseModel):
    """
    DTO UNIFICADO para registro de choferes (público y admin).
    Estructura única que ambos endpoints utilizan, con diferencias en validación/estado.
    SEGURIDAD: organizacion_id requerido, validación de unicidad (email, dni) por org.
    
    NOTA: Validaciones complejas (teléfono formato, email único, DNI único) 
    se hacen en validators.py, NO en Pydantic. Pydantic solo hace validaciones básicas.
    """
    # ID AUTENTICACIÓN (opcional, provisto por frontend supabase auth)
    id: Optional[str] = Field(None, description="Auth User ID provisto por frontend")
    
    # PERSONALES (requeridos)
    nombre: str = Field(..., min_length=2, description="Nombre completo del chofer")
    email: EmailStr = Field(..., description="Email único por organización")
    telefono: str = Field(..., description="Teléfono de contacto (validación en validators.py)")
    
    # DOCUMENTO (requerido)
    dni: str = Field(..., description="DNI único por organización")
    
    # DIRECCIÓN (opcional, principalmente para admin)
    direccion: Optional[str] = Field(None, description="Dirección de residencia")
    
    # LICENCIA (validación diferenciada: requerida en público, opcional en admin)
    licencia_numero: Optional[str] = Field(None, description="Número de licencia de conducir")
    licencia_categoria: Optional[str] = Field(None, description="Categoría de licencia (A, B, C, D, E)")
    licencia_vencimiento: Optional[str] = Field(None, description="Fecha vencimiento licencia (YYYY-MM-DD)")
    
    # VEHÍCULO
    tiene_vehiculo: bool = Field(False, description="¿Tiene vehículo propio?")
    vehiculo: Optional[str] = Field(None, description="Marca y modelo del vehículo")
    patente: Optional[str] = Field(None, description="Patente/dominio del vehículo")
    
    # DOCUMENTOS (lista de URLs o referencias a storage)
    documentos: List[Dict[str, Any]] = Field(default_factory=list, description="Documentación (DNI frente/dorso, antecedentes, etc)")
    
    # PAGO (principalmente admin)
    tipo_pago: str = Field("comision", description="Tipo: 'base' o 'comision'")
    valor_pago: float = Field(0.0, description="Valor en base o comisión porcentaje")
    
    # ORGANIZACIÓN (requerido)
    organizacion_id: UUID = Field(..., description="ID de la organización")
    
    model_config = ConfigDict(from_attributes=True)

class Viaje(BaseModel):
    id: UUID
    organizacion_id: UUID
    cliente_id: Optional[UUID] = None
    chofer_id: Optional[UUID] = None
    origen: Dict[str, Any]
    destino: Dict[str, Any]
    estado: str
    precio: Optional[float] = None
    final_price: Optional[float] = None
    puntos_generados: int = 0
    usado_viaje_gratis: bool = False
    
    # Timestamps v2.0
    requested_at: Optional[datetime] = None
    quoted_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    
    # Cálculos v2.0
    wait_minutes: int = 0
    wait_cost: float = 0.0
    extras: Dict[str, Any] = {}
    calificacion: Optional[int] = None

    creado_en: datetime


    model_config = ConfigDict(from_attributes=True)

class Promocion(BaseModel):
    id: UUID
    organizacion_id: UUID
    titulo: str
    descripcion: Optional[str] = None
    puntos_requeridos: int = 0

    model_config = ConfigDict(from_attributes=True)
