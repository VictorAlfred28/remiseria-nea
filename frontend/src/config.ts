// src/config.ts

import { Capacitor } from '@capacitor/core';

/**
 * URL base oficial para la API.
 * 
 * Reglas:
 * 1. Intenta usar la variable de entorno de Vite.
 * 2. Si no existe, y NO estamos en localhost, usa el servidor de producción oficial.
 * 3. Si estamos en localhost, intenta conectarse al backend local, para desarrollo.
 */
export const getApiUrl = () => {
    // Si la variable de entorno está definida explícitamente, la usamos (ideal para builds correctos)
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // Detectamos si el frontend corre localmente en el navegador, excluyendo Capacitor
    const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    const isLocalhost = typeof window !== 'undefined' && 
                       (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocalhost && !isNative) {
        console.warn("VITE_API_URL no está definida. Usando http://localhost:8000/api/v1 para desarrollo local.");
        return 'http://localhost:8000/api/v1';
    }

    // Producción real o Capacitor: forzamos el endpoint oficial
    console.warn("VITE_API_URL no encontrada o en entorno nativo. Usando fallback seguro oficial.");
    return 'https://api.viajesnea.agentech.ar/api/v1';
};

export const API_BASE_URL = getApiUrl();
