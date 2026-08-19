# DIAGNÓSTICO INTEGRAL Y PLAN DE TRABAJO - ERROR DE GEOLOCALIZACIÓN GPS

## 1. Mapeo del Flujo de Geolocalización Actual
El flujo actual de geolocalización en UBI Integral se divide en tres actores principales:
*   **Pasajero (ClienteDashboard):** La ubicación se maneja mediante `@capacitor/geolocation`. Al abrir la app, NO se solicita la ubicación en vivo. Se inicializa el mapa en coordenadas estáticas (Corrientes Capital). La ubicación solo se solicita si el usuario presiona el botón "Usar mi ubicación".
*   **Chofer (ChoferDashboard):** Utiliza `@capacitor/geolocation` para la web y `@capacitor-community/background-geolocation` para Android nativo. Al "Comenzar Turno", se registra un "watcher" que obtiene actualizaciones. Estas coordenadas se guardan en el estado local y se envían a la tabla `choferes` en Supabase (cada x segundos mediante `setInterval`).
*   **Tracker/Pasajero (LiveTracker):** Escucha un canal de Supabase en tiempo real (Presence) para renderizar el coche del chofer en un mapa de Leaflet usando formato `[lat, lng]`.

## 2. Origen del Problema de "Ubicación Incorrecta"
Tras analizar el frontend y backend, se han identificado las causas por las que un usuario (estando en un punto físico X) ve su ubicación en un punto Y (generalmente Corrientes):

1.  **Ausencia de Geolocalización Automática (On Mount):** En `ClienteDashboard.tsx`, el mapa arranca con `mapCenter` hardcodeado en `lat: -27.4692, lng: -58.8306` (Corrientes). Al cargar el mapa de Google Maps, el evento `onIdle` captura este centro y sobrescribe el `origenCoords` del pasajero. Si el pasajero está en Resistencia y no presiona el botón de "GPS", la aplicación asume que está en Corrientes.
2.  **Caché de Dispositivo (Stale Location):** En `geolocation.ts`, la función `getCurrentPosition` no define el parámetro `maximumAge: 0`. Esto permite que el sistema operativo Android devuelva una `lastKnownLocation` muy antigua en lugar de forzar una lectura actual del sensor GPS.
3.  **Fallbacks Silenciosos a Corrientes (Frontend):** Si `getCurrentPosition` tarda más de 10 segundos (`timeout: 10000`), arroja error pero devuelve el `DEFAULT_LOCATION` (Corrientes). El dashboard alerta el error, pero aplica las coordenadas de Corrientes al mapa.
4.  **Fallbacks Silenciosos a Corrientes (Backend):** En `geocoding.py`, si falla la resolución de la API de Google, el backend inyecta silenciosamente las coordenadas de Corrientes Capital (`DEFAULT_LAT`, `DEFAULT_LNG`) con un pequeño "jitter", falseando el destino o el origen.
5.  **Fallbacks a Resistencia (Hardcoded):** En `handleSolicitarViaje` (ClienteDashboard), si `origenCoords` es null, las coordenadas se envían harcodeadas a `lat: -27.4511, lng: -58.9866` (Resistencia centro).

## 3. Puntos de Falla en la Comunicación (Frontend a DB)
*   Las coordenadas del pasajero se envían correctamente como `{ lat, lng }` al solicitar el viaje en `POST /ubicacion/actualizar` y en las reservas.
*   Sin embargo, en `ChoferDashboard.tsx`, el `setInterval` de envío de ubicación al servidor lee del estado de React (`choferCoords`), el cual puede estar desactualizado debido a las reglas de stale state del closure del timer si no se utiliza una referencia (`useRef`).

## 4. Inconsistencias de Mapas
*   El componente `TripMap.tsx` recibe la prop `driverLocation`, pero su código base **NUNCA la renderiza**. El pasajero no ve el movimiento del chofer en el dashboard principal; el pin del mapa siempre permanece estático. El seguimiento real solo funciona si el pasajero abre el link externo de `/track/:id` (`LiveTracker.tsx`).
*   No hay inversión de coordenadas (es decir, uso accidental de `[lng, lat]` en lugar de `[lat, lng]`). Todo el stack usa formato de Google Maps `{ lat, lng }` y Leaflet `[lat, lng]`, lo cual es congruente.

---

## 5. PLAN DE SOLUCIÓN Y CORRECCIONES A APLICAR

1.  **Eliminación de Fallbacks Rígidos:** Modificar `geolocation.ts` y `geocoding.py` para no inyectar ubicaciones por defecto sin el consentimiento explícito. Si el GPS falla, la app debe requerir que el usuario ingrese la dirección manualmente o re-intentar, no teletransportarlo a Corrientes.
2.  **Reforzar Lectura Fresca del Sensor (Frontend):**
    *   Añadir `maximumAge: 0` a todas las llamadas de `Geolocation.getCurrentPosition` y `watchPosition`.
    *   Aumentar razonablemente el timeout del GPS (a 15-20 seg) para dispositivos lentos.
3.  **Localización Automática al Abrir la App:**
    *   Implementar un `useEffect` en `ClienteDashboard.tsx` que solicite la ubicación de manera proactiva al montar el componente (si los permisos lo permiten), para que el mapa inicie en la ubicación real del usuario.
4.  **Corregir Hardcodes en Peticiones:**
    *   En `handleSolicitarViaje`, remover el fallback arbitrario a Resistencia.
5.  **Revisión del Ciclo de Vida en ChoferDashboard:**
    *   Asegurar que el GPS en background (Android) se sincronice de manera precisa sin demoras por distancia (`distanceFilter`).
6.  **Actualizar UI del TripMap:**
    *   Implementar el renderizado del `driverLocation` dentro de `TripMap.tsx` para que la ubicación no sea un engaño visual.

*Se procederá a ejecutar estas correcciones tras la aprobación del diagnóstico.*
