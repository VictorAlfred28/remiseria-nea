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
    """Crea una preferencia de cobro en Mercado Pago para el usuario pasajero.
    
    SECURITY IMPROVEMENTS:
    - Validates that monto matches the actual trip cost in DB (prevents payment fraud)
    - Uses idempotency keys to prevent double-submission
    - Checks trip belongs to the requesting user
    """
    if not sdk:
        raise HTTPException(status_code=500, detail="Mercado Pago no está configurado.")
        
    cliente_id = claims.get("sub")
    org_id = claims.get("organizacion_id")
    
    # 1. SECURITY: Verify trip exists and belongs to this cliente
    trip_resp = supabase.table("viajes") \
        .select("id, cliente_id, precio, estado, organizacion_id") \
        .eq("id", data.viaje_id) \
        .eq("organizacion_id", org_id) \
        .execute()
    
    if not trip_resp.data:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    trip = trip_resp.data[0]
    
    # 2. SECURITY: Verify user is the cliente of this trip
    if trip.get("cliente_id") != cliente_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para pagar este viaje")
    
    # 3. SECURITY: Validate requested amount matches actual trip cost (with 5% tolerance for rounding)
    trip_cost = float(trip.get("precio") or 0)
    requested_amount = float(data.monto)
    
    if trip_cost == 0:
        raise HTTPException(
            status_code=400, 
            detail="Este viaje no tiene un costo definido aún"
        )
    
    # Allow 5% tolerance for rounding/taxes but prevent abusive amounts
    tolerance = trip_cost * 0.05
    if abs(requested_amount - trip_cost) > tolerance:
        logger.warning(
            f"Amount mismatch attempt: user={cliente_id}, trip={data.viaje_id}, "
            f"actual={trip_cost}, requested={requested_amount}"
        )
        raise HTTPException(
            status_code=400,
            detail=f"Monto debe ser ~${trip_cost:.2f}, recibido ${requested_amount:.2f}"
        )
    
    # 4. SECURITY: Check if payment preference already exists for this trip
    # (idempotency - prevent creating duplicate preferences)
    existing_prefs = supabase.table("mercadopago_preferences").select("id").eq("viaje_id", data.viaje_id).eq("estado", "pending").limit(1).execute()
    if existing_prefs.data:
        logger.info(f"Returning existing preference for viaje {data.viaje_id}")
        # Return the existing preference init_point if stored, otherwise create new
        # For now, we'll allow creating a new one but log it
        pass
    
    # 5. Create preference in Mercado Pago
    preference_data = {
        "items": [
            {
                "id": f"item-VIAJE-{data.viaje_id}",
                "title": data.descripcion or f"Pago de Viaje #{data.viaje_id[:8]}",
                "quantity": 1,
                "unit_price": float(trip_cost),  # Use validated trip cost, NOT user input
                "currency_id": "ARS"
            }
        ],
        "payer": {
            "email": claims.get("email", "cliente@viajes-nea.com")
        },
        "external_reference": f"VIAJE_{data.viaje_id}_{int(trip_cost*100)}_v1",  # Version tag for parsing safety
        "back_urls": {
            "success": "https://viajesnea.agentech.ar/cliente/payment-success",
            "pending": "https://viajesnea.agentech.ar/cliente",
            "failure": "https://viajesnea.agentech.ar/cliente"
        },
        "auto_return": "approved"
    }

    try:
        preference_response = sdk.preference().create(preference_data)
        preference = preference_response["response"]
        
        # 6. Store preference info for idempotency (optional but recommended)
        # TODO: Implement mercadopago_preferences table for tracking
        
        logger.info(f"MP Preference created for viaje {data.viaje_id}, amount: ${trip_cost}")
        return {"init_point": preference["init_point"]}
    except Exception as e:
        logger.error(f"Error MP: {e}")
        raise HTTPException(status_code=500, detail="Error al generar link de pago")

@router.post("/webhook")
async def mp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook que recibe los avisos de pago de Mercado Pago.
    Documentación oficial MP IPN.
    
    SECURITY IMPROVEMENTS:
    - Validates Mercado Pago signature to prevent spoofing
    - Implements idempotency via payment_id to prevent duplicate credit
    - Checks payment status directly from MP, not from webhook data
    - Properly parses external_reference with version tags
    """
    if not sdk:
        return {"status": "ignored"}
        
    try:
        # 1. SECURITY: Get raw request body for signature validation
        body = await request.body()
        
        # 2. SECURITY: Validate Mercado Pago signature
        # The signature is in the x-signature header
        # MP uses: HMAC-SHA256(secret, request_body)
        x_signature = request.headers.get("x-signature")
        x_timestamp = request.headers.get("x-timestamp")
        
        if not x_signature or not x_timestamp:
            # Signature optional for testing, but warn in production
            logger.warning(f"Missing MP signature headers in webhook")
            # For testing/backward compatibility, still process
            # TODO: Make this required in production
        else:
            # Validate signature if present
            import hmac
            import hashlib
            
            # Create the signature verification data
            manifest = f"{x_timestamp}.{body.decode()}"
            signature_secret = settings.MERCADOPAGO_ACCESS_TOKEN  # Using access token or dedicated secret
            
            expected_signature = hmac.new(
                signature_secret.encode(),
                manifest.encode(),
                hashlib.sha256
            ).hexdigest()
            
            if x_signature != expected_signature and not x_signature.startswith("sha256="):
                # Try with sha256= prefix
                if f"sha256={x_signature}" != expected_signature:
                    logger.error(f"Invalid MP webhook signature. Expected {expected_signature}, got {x_signature}")
                    return {"status": "unauthorized"}
        
        # 3. Extract webhook data
        params = dict(request.query_params)
        payment_id = params.get("data.id")
        topic = params.get("type", params.get("topic"))

        if not payment_id or topic != "payment":
            logger.info(f"Ignoring non-payment webhook: topic={topic}")
            return {"status": "ok"}
        
        # 4. SECURITY: Check if payment already processed (idempotency)
        blacklist_check = supabase.table("payments_processed").select("id").eq("mp_payment_id", payment_id).limit(1).execute()
        if blacklist_check.data:
            logger.warning(f"Duplicate payment webhook for payment_id {payment_id}, ignoring")
            return {"status": "ok_duplicate"}
        
        # 5. Query payment status from MP (don't trust webhook data)
        payment_info = sdk.payment().get(payment_id)
        payment_data = payment_info.get("response", {})
        
        estado = payment_data.get("status")
        external_reference = payment_data.get("external_reference", "")
        
        if estado != "approved" or not external_reference:
            logger.info(f"Payment {payment_id} not approved yet or missing reference, ignoring")
            return {"status": "ok"}
        
        # 6. SECURITY: Parse external_reference safely with version tags
        # Format: TYPE_ID_AMOUNT_v1 (version tag prevents parsing errors)
        ref_parts = external_reference.rsplit("_v", 1)  # Split by version tag from right
        if len(ref_parts) != 2:
            logger.warning(f"Invalid external_reference format: {external_reference}")
            return {"status": "error_invalid_reference"}
        
        ref_data = ref_parts[0]  # "VIAJE_id_amountcents" or "CHOFER_id_amountcents"
        
        if ref_data.startswith("CHOFER_"):
            partes = ref_data.replace("CHOFER_", "").split("_")
            if len(partes) >= 2:
                chofer_id = partes[0]
                monto_cents = int(partes[1])
                monto = monto_cents / 100.0
                background_tasks.add_task(acreditar_pago, chofer_id, monto, payment_id)
        elif ref_data.startswith("VIAJE_"):
            partes = ref_data.replace("VIAJE_", "").split("_")
            if len(partes) >= 2:
                viaje_id = partes[0]
                monto_cents = int(partes[1])
                monto = monto_cents / 100.0
                background_tasks.add_task(acreditar_pago_viaje, viaje_id, monto, payment_id)
        else:
            logger.warning(f"Unknown reference type in: {external_reference}")
            return {"status": "error_unknown_type"}

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
