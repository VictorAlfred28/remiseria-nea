import logging
from datetime import datetime, timedelta, timezone
from app.db.supabase import supabase

logger = logging.getLogger(__name__)

# MODO DRY RUN: Si es True, solo loguea, NO borra archivos físicos.
DRY_RUN = True

# Lotes para no saturar RAM
BATCH_SIZE = 100

async def procesar_limpieza_storage():
    """
    Cron Job para limpiar archivos huérfanos o viejos en Supabase Storage.
    Ejecución: Diario (madrugada).
    """
    logger.info("🧹 Iniciando rutina de limpieza de Storage...")
    
    if DRY_RUN:
        logger.info("⚠️ MODO DRY RUN ACTIVO: No se eliminarán archivos físicos.")

    now = datetime.now(timezone.utc)
    
    # -------------------------------------------------------------
    # 1. ELIMINACIÓN FÍSICA (Archivos con grace_period vencido)
    # -------------------------------------------------------------
    try:
        # Buscar referencies que ya pasaron el periodo de gracia
        expired_res = supabase.table("file_references") \
            .select("id, path, bucket_name") \
            .eq("is_active", False) \
            .lte("grace_until", now.isoformat()) \
            .limit(BATCH_SIZE) \
            .execute()
            
        expired_files = expired_res.data
        if expired_files:
            logger.info(f"Encontrados {len(expired_files)} archivos para eliminación física definitiva.")
            
            for f in expired_files:
                bucket = f["bucket_name"]
                path = f["path"]
                
                try:
                    if not DRY_RUN:
                        # Borrado físico
                        supabase.storage.from_(bucket).remove([path])
                        # Borrado de la DB (o marcar como deleted_at)
                        supabase.table("file_references").update({"deleted_at": now.isoformat()}).eq("id", f["id"]).execute()
                    
                    # Log
                    supabase.table("storage_cleanup_logs").insert({
                        "path": path,
                        "bucket_name": bucket,
                        "motivo": "Periodo de gracia vencido",
                        "estado": "DRY_RUN" if DRY_RUN else "ELIMINADO"
                    }).execute()
                    
                    logger.info(f"[{'DRY_RUN' if DRY_RUN else 'DELETED'}] Archivo: {bucket}/{path}")
                except Exception as e:
                    logger.error(f"Error eliminando archivo {path}: {e}")
    except Exception as e:
         logger.error(f"Error en paso 1 (Eliminación física): {e}")

    # -------------------------------------------------------------
    # 2. MARCADO SOFT DELETE (Archivos inactivos > 30 días)
    # -------------------------------------------------------------
    try:
        # 30 días sin uso
        limite_inactividad = now - timedelta(days=30)
        
        inactive_res = supabase.table("file_references") \
            .select("id, path, bucket_name") \
            .eq("is_active", True) \
            .lte("last_used_at", limite_inactividad.isoformat()) \
            .limit(BATCH_SIZE) \
            .execute()
            
        inactive_files = inactive_res.data
        if inactive_files:
            logger.info(f"Encontrados {len(inactive_files)} archivos sin uso reciente. Marcando para Soft Delete (7 días gracia).")
            
            grace_date = (now + timedelta(days=7)).isoformat()
            
            for f in inactive_files:
                try:
                    supabase.table("file_references").update({
                        "is_active": False,
                        "grace_until": grace_date
                    }).eq("id", f["id"]).execute()
                    
                    # Log
                    supabase.table("storage_cleanup_logs").insert({
                        "path": f["path"],
                        "bucket_name": f["bucket_name"],
                        "motivo": "Sin uso por > 30 días",
                        "estado": "SOFT_DELETED_GRACE"
                    }).execute()
                except Exception as e:
                    logger.error(f"Error marcando soft-delete en {f['path']}: {e}")
                    
    except Exception as e:
         logger.error(f"Error en paso 2 (Soft delete marcaje): {e}")

    logger.info("✅ Rutina de limpieza finalizada.")
