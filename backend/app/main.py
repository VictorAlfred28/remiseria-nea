import asyncio
from datetime import datetime
import pytz
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.core.reminders import procesar_y_enviar_recordatorios
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
    "https://viajesnea.vercel.app",
    "https://viajesnea.agentech.ar",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in origins:
    origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],  # Added PATCH and OPTIONS
    allow_headers=["Content-Type", "Authorization", "x-webhook-secret"],  # Added webhook header
    max_age=3600,
)

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

@app.on_event("startup")
async def start_reminder_loop():
    """Inicializa el scheduler de recordatorios.
    
    SECURITY & RELIABILITY:
    - Error handling to prevent startup failure if scheduler fails
    - Proper timezone configuration for Argentina
    - Graceful degradation if scheduler can't start
    """
    try:
        # Iniciamos el Scheduler de forma segura para FastAPI
        scheduler = AsyncIOScheduler(timezone=pytz.timezone('America/Argentina/Buenos_Aires'))
        
        # Programar la tarea todos los días a las 08:00 AM
        scheduler.add_job(
            procesar_y_enviar_recordatorios,
            trigger=CronTrigger(hour=8, minute=0),
            id="recordatorios_matutinos",
            replace_existing=True
        )
        
        scheduler.start()
        print("[INFO] Reminder scheduler started successfully (08:00 AM daily)")
    except Exception as e:
        print(f"[WARNING] Failed to start reminder scheduler: {e}")
        # Don't crash the whole app if scheduler fails
        # In production, alert ops team about this failure
    print("APScheduler iniciado. Recordatorios programados para las 08:00 AM (ART).")

@app.get("/")
def read_root():
    return {"message": f"Bienvenido a la API de {settings.PROJECT_NAME}"}
