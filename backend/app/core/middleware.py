"""
Global middleware for enhanced error logging and debugging.

Provides:
- Detailed logging of 400 Bad Request errors
- Request/response tracking
- Performance monitoring
"""

import logging
import time
import json
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware para capturar y loguear errores HTTP con detalles.
    Especialmente útil para debugging de errores 400 Bad Request.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Capturar el inicio de la request
        start_time = time.time()
        request_id = request.headers.get("x-request-id", "unknown")
        
        # Loguear request básica
        logger.info(f"[{request_id}] {request.method} {request.url.path}")
        
        try:
            # Leer el body para loguear (si aplica)
            if request.method in ["POST", "PUT", "PATCH"]:
                try:
                    body = await request.body()
                    if body:
                        try:
                            body_json = json.loads(body)
                            logger.debug(f"[{request_id}] Request body: {json.dumps(body_json, indent=2)}")
                        except json.JSONDecodeError:
                            logger.debug(f"[{request_id}] Request body (non-JSON): {body.decode('utf-8', errors='ignore')[:500]}")
                    # Re-crear el stream para que pueda ser leído por el endpoint
                    async def receive():
                        return {"type": "http.request", "body": body}
                    request._receive = receive
                except Exception as e:
                    logger.warning(f"[{request_id}] Error reading request body: {str(e)}")
            
            # Procesar la request
            response = await call_next(request)
            
            # Calcular tiempo de procesamiento
            process_time = time.time() - start_time
            
            # Loguear respuesta
            logger.info(
                f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} "
                f"({process_time:.3f}s)"
            )
            
            # Si es error 400, loguear más detalles
            if response.status_code == 400:
                logger.warning(f"[{request_id}] ⚠️  400 Bad Request on {request.method} {request.url.path}")
                try:
                    # Intentar leer el body de error
                    body = b""
                    async for chunk in response.body_iterator:
                        body += chunk
                    
                    try:
                        error_data = json.loads(body)
                        logger.warning(f"[{request_id}] Error details: {json.dumps(error_data, indent=2)}")
                    except json.JSONDecodeError:
                        logger.warning(f"[{request_id}] Error response (non-JSON): {body.decode('utf-8', errors='ignore')}")
                    
                    # Re-crear la respuesta con el body
                    return Response(
                        content=body,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type=response.media_type,
                    )
                except Exception as e:
                    logger.error(f"[{request_id}] Error capturing error response: {str(e)}")
            
            # Si es error 5xx, loguear también
            if response.status_code >= 500:
                logger.error(f"[{request_id}] 🔴 {response.status_code} Server Error on {request.method} {request.url.path}")
            
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"[{request_id}] ❌ Unhandled exception on {request.method} {request.url.path}: "
                f"{type(e).__name__}: {str(e)} ({process_time:.3f}s)"
            )
            
            # Retornar error 500 estructurado
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "error_type": type(e).__name__,
                    "request_id": request_id
                }
            )
