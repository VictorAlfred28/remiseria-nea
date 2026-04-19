from fastapi import APIRouter
from app.api.v1.endpoints import admin, chofer, openai, webhooks, public, tariffs, reservations, payments, cliente, radar, socios, family, titular, vehicles

api_router = APIRouter()
api_router.include_router(admin.router, prefix="/admin", tags=["Administración"])
api_router.include_router(chofer.router, prefix="/chofer", tags=["Choferes"])
api_router.include_router(radar.router, prefix="/radar", tags=["Radar Inteligente"])
api_router.include_router(cliente.router, prefix="/cliente", tags=["Clientes Pasajeros"])
api_router.include_router(titular.router, prefix="/titular", tags=["Titulares de Vehículos"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehículos"])
api_router.include_router(openai.router, prefix="/ai", tags=["Asistente IA"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks Evolution"])
api_router.include_router(public.router, prefix="/public", tags=["Endpoints Públicos - Visitas"])
api_router.include_router(tariffs.router, prefix="/tariffs", tags=["Tarifario Dinámico"])
api_router.include_router(reservations.router, prefix="/reservations", tags=["Reservas"])
api_router.include_router(payments.router, prefix="/payments", tags=["Billetera y Pagos MP"])
api_router.include_router(socios.router, prefix="/socios", tags=["Socios Carnet Digital"])
api_router.include_router(family.router, prefix="/family", tags=["Control Parental"])
