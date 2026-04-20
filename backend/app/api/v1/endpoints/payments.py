from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from typing import Dict, Any
from pydantic import BaseModel
import mercadopago
from app.core.config import settings
from app.db.supabase import supabase
from app.core.security import get_current_user, get_current_admin
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Instancia del SDK de Mercado Pago
if settings.MERCADOPAGO_ACCESS_TOKEN:
    sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
else:
    sdk = None
    logger.warning("Falta MERCADOPAGO_ACCESS_TOKEN en el entorno.")

class PaymentRequest(BaseModel):
    monto: float
    descripcion: str = "Pago de Billetera a la Base"

@router.post("/create_preference")
def create_checkout_preference(data: PaymentRequest, claims: Dict[str, Any] = Depends(get_current_user)):
    """Crea una preferencia de cobro en Mercado Pago para que el chofer abone su deuda."""
    if not sdk:
        raise HTTPException(status_code=500, detail="Mercado Pago no está configurado.")
        
    chofer_id = claims.get("sub")
    
    # Crear la preferencia en Mercado Pago
    preference_data = {
        "items": [
            {
                "id": "item-DEUDA-101",
                "title": data.descripcion,
                "quantity": 1,
                "unit_price": data.monto,
                "currency_id": "ARS"
            }
        ],
        "payer": {
            "email": claims.get("email", "dummy@email.com")
        },
        # Metadata para que el Webhook sepa a qué chofer impactar el pago
        "external_reference": f"CHOFER_{chofer_id}_{data.monto}",
        "back_urls": {
            "success": "https://viajes-nea.com/chofer", # Ajustar a dominio frontend
            "pending": "https://viajes-nea.com/chofer",
            "failure": "https://viajes-nea.com/chofer"
        },
        "auto_return": "approved"
    }

    try:
        preference_response = sdk.preference().create(preference_data)
        preference = preference_response["response"]
        return {"init_point": preference["init_point"]}
    except Exception as e:
        logger.error(f"Error MP: {e}")
        raise HTTPException(status_code=500, detail="Error al generar link de pago")

class TripPaymentRequest(BaseModel):
    viaje_id: str
    monto: float
    descripcion: str = "Pago de Viaje"

@router.post("/create_trip_preference")
def create_trip_preference(data: TripPaymentRequest, claims: Dict[str, Any] = Depends(get_current_user)):
    """Crea una preferencia de cobro en Mercado Pago para el usuario pasajero."""
    if not sdk:
        raise HTTPException(status_code=500, detail="Mercado Pago no está configurado.")
        
    cliente_id = claims.get("sub")
    
    preference_data = {
        "items": [
            {
                "id": f"item-VIAJE-{data.viaje_id}",
                "title": data.descripcion,
                "quantity": 1,
                "unit_price": data.monto,
                "currency_id": "ARS"
            }
        ],
        "payer": {
            "email": claims.get("email", "cliente@viajes-nea.com")
        },
        "external_reference": f"VIAJE_{data.viaje_id}_{data.monto}",
        "back_urls": {
            "success": "https://viajes-nea.com/cliente/payment-success",
            "pending": "https://viajes-nea.com/cliente",
            "failure": "https://viajes-nea.com/cliente"
        },
        "auto_return": "approved"
    }

    try:
        preference_response = sdk.preference().create(preference_data)
        preference = preference_response["response"]
        return {"init_point": preference["init_point"]}
    except Exception as e:
        logger.error(f"Error MP: {e}")
        raise HTTPException(status_code=500, detail="Error al generar link de pago")

@router.post("/webhook")
async def mp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook que recibe los avisos de pago de Mercado Pago.
    Documentación oficial MP IPN.
    """
    if not sdk:
        return {"status": "ignored"}
        
    try:
        # Extraer parámetros de la URL (ej: /webhook?data.id=12345&type=payment)
        params = dict(request.query_params)
        payment_id = params.get("data.id")
        topic = params.get("type", params.get("topic"))

        if topic == "payment" and payment_id:
            # Consultar el estado real del pago a MP
            payment_info = sdk.payment().get(payment_id)
            payment_data = payment_info["response"]
            
            estado = payment_data.get("status")
            external_reference = payment_data.get("external_reference", "")
            
            if estado == "approved" and external_reference:
                if external_reference.startswith("CHOFER_"):
                    # Es pago de deuda de chofer
                    partes = external_reference.replace("CHOFER_", "").split("_")
                    chofer_id = partes[0]
                    monto = float(partes[1])
                    background_tasks.add_task(acreditar_pago, chofer_id, monto, payment_id)
                elif external_reference.startswith("VIAJE_"):
                    # Es pago de un viaje de pasajero
                    partes = external_reference.replace("VIAJE_", "").split("_")
                    viaje_id = partes[0]
                    monto = float(partes[1])
                    background_tasks.add_task(acreditar_pago_viaje, viaje_id, monto, payment_id)
                else:
                    # Legacy support para pagos de chofer que no tenían CHOFER_
                    partes = external_reference.split("_")
                    if len(partes) == 2:
                        chofer_id = partes[0]
                        monto = float(partes[1])
                        background_tasks.add_task(acreditar_pago, chofer_id, monto, payment_id)

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error procesando webhook MP: {e}")
        return {"status": "error"}

def acreditar_pago_viaje(viaje_id: str, monto_pagado: float, mp_payment_id: str):
    """Actualizar estado de pago del viaje a Mercado Pago"""
    try:
        # Verificar precio del viaje
        res_viaje = supabase.table("viajes").select("precio").eq("id", viaje_id).execute()
        if not res_viaje.data:
            logger.error(f"Viaje {viaje_id} no encontrado para acreditar pago.")
            return

        precio_viaje = float(res_viaje.data[0].get("precio", 0) or 0)
        
        # Validar monto
        if monto_pagado < precio_viaje:
            logger.warning(f"Pago parcial MP detectado para viaje {viaje_id}. Pagado: {monto_pagado}, Precio: {precio_viaje}.")
            # Se debe manejar administrativamente (pago parcial) - Por ahora no marcamos como fully paid
            return

        supabase.table("viajes").update({
            "metodo_pago": "mp",
        }).eq("id", viaje_id).execute()
        logger.info(f"Viaje {viaje_id} abonado exitosamente vía MP (ID: {mp_payment_id})")
    except Exception as e:
        logger.error(f"Error al acreditar pago de viaje: {e}")

def acreditar_pago(chofer_id: str, monto: float, mp_payment_id: str):
    """Lógica de BD para impactar el pago aprobado."""
    try:
        # 1. Registrar el movimiento positivo
        # El constraint UNIQUE (mp_payment_id) previene los Race Conditions abortando duplicidades atómicamente.
        mov_data = {
            "chofer_id": chofer_id,
            "monto": monto,
            "tipo": "pago_mp",
            "descripcion": f"Abono vía Mercado Pago (ID: {mp_payment_id})",
            "mp_payment_id": mp_payment_id
        }
        
        # La inserción tirará un error si `mp_payment_id` ya existe
        res_insert = supabase.table("movimientos_saldo").insert(mov_data).execute()
        
        # 2. Actualizar el saldo actual en la tabla choferes
        chofer_req = supabase.table("choferes").select("saldo").eq("id", chofer_id).execute()
        saldo_actual = 0
        if chofer_req.data:
            saldo_actual = chofer_req.data[0].get("saldo", 0) or 0
        
        nuevo_saldo = saldo_actual + monto
        supabase.table("choferes").update({"saldo": nuevo_saldo}).eq("id", chofer_id).execute()
        logger.info(f"Saldo del chofer {chofer_id} acreditado. Nuevo saldo: {nuevo_saldo}")
        
    except Exception as e:
        err_str = str(e).lower()
        if "duplicate key value" in err_str or "movimientos_saldo_mp_payment_id_key" in err_str or "23505" in err_str:
            logger.info(f"El pago de MP {mp_payment_id} ya fue procesado previamente (Intervención de Constraint UNIQUE).")
        else:
            logger.error(f"Falló la acreditación del pago en BD: {e}")

@router.get("/balance")
def get_chofer_balance(claims: Dict[str, Any] = Depends(get_current_user)):
    """Obtiene el saldo actual del chofer y sus últimos movimientos."""
    chofer_id = claims.get("sub")
    
    # Saldo
    resp_chofer = supabase.table("choferes").select("saldo").eq("id", chofer_id).execute()
    saldo = resp_chofer.data[0].get("saldo", 0) if resp_chofer.data else 0
    
    # Movimientos
    resp_movs = supabase.table("movimientos_saldo").select("*").eq("chofer_id", chofer_id).order("created_at", desc=True).limit(20).execute()
    
    return {
        "saldo": saldo,
        "movimientos": resp_movs.data
    }

@router.post("/admin/charge")
def admin_manual_charge(data: Dict[str, Any], claims: Dict[str, Any] = Depends(get_current_admin)):
    """El Admin carga un castigo/deuda/diaria o un pago manual en efectivo."""
    chofer_id = data.get("chofer_id")
    monto = float(data.get("monto", 0)) # Positivo es abono en efvo, negativo es cargo a deber
    tipo = data.get("tipo", "cargo_manual")
    descripcion = data.get("descripcion", "Cargo admin")
    
    # 1. Registrar movimiento
    supabase.table("movimientos_saldo").insert({
        "chofer_id": chofer_id,
        "monto": monto,
        "tipo": tipo,
        "descripcion": descripcion
    }).execute()
    
    # 2. Actualizar saldo
    chofer_req = supabase.table("choferes").select("saldo").eq("id", chofer_id).execute()
    saldo_actual = chofer_req.data[0].get("saldo", 0) if chofer_req.data else 0
    nuevo_saldo = saldo_actual + monto
    
    supabase.table("choferes").update({"saldo": nuevo_saldo}).eq("id", chofer_id).execute()
    
    return {"status": "ok", "nuevo_saldo": nuevo_saldo}

@router.get("/admin/balances")
def get_all_balances(claims: Dict[str, Any] = Depends(get_current_admin)):
    """El Admin revisa quién le debe plata a la base."""
    # Obtenemos todos los choferes y su saldo actual
    resp = supabase.table("choferes").select("id, vehiculo, patente, saldo, usuarios(nombre)").execute()
    return resp.data
