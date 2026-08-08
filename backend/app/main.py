import asyncio
from datetime import datetime
import pytz
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.core.reminders import procesar_y_enviar_recordatorios
from app.core.storage_cleanup import procesar_limpieza_storage
from app.core.middleware import ErrorLoggingMiddleware

from fastapi.responses import ORJSONResponse

app = FastAPI(
    title=settings.PROJECT_NAME,
    default_response_class=ORJSONResponse
)

# 🔍 Add error logging middleware FIRST (executes last)
app.add_middleware(ErrorLoggingMiddleware)

app.include_router(api_router, prefix="/api/v1")

# CORS configuration
# Permitimos orígenes explícitos y un fallback amplio por regex para despliegues VPS / IPs Dinámicas
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://localhost",
    "https://viajesnea.vercel.app",
    "https://viajesnea.agentech.ar",
    "https://app.trasladosubi.com",
    "https://api.viajesnea.agentech.ar",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in origins:
    origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],  # Permitir todos los métodos
    allow_headers=["*"],  # Permitir todos los headers para evitar bloqueos silenciosos por preflight
    max_age=3600,
)

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import logging
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def start_reminder_loop():
    """Inicializa el scheduler de recordatorios."""
    try:
        scheduler = AsyncIOScheduler(timezone=pytz.timezone('America/Argentina/Buenos_Aires'))
        scheduler.add_job(
            procesar_y_enviar_recordatorios,
            trigger=CronTrigger(hour=8, minute=0),
            id="recordatorios_matutinos",
            replace_existing=True
        )
        scheduler.add_job(
            procesar_limpieza_storage,
            trigger=CronTrigger(hour=3, minute=0),
            id="limpieza_storage_madrugada",
            replace_existing=True
        )
        scheduler.start()
        logger.info("[STARTUP] Reminder scheduler iniciado — 08:00 AM diario (ART)")
    except Exception as e:
        logger.warning(f"[STARTUP] No se pudo iniciar el scheduler de recordatorios: {e}")

@app.get("/")
def read_root():
    return {"message": f"Bienvenido a la API de {settings.PROJECT_NAME}"}
