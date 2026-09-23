/**
 * Formula Haversine para calcular distancia en km entre dos puntos geográficos
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
    if (!lat1 || !lon1 || !lat2 || !lon2) return "0.0";
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distancia en km
    return distance.toFixed(1);
}

/**
 * Valida que las coordenadas geográficas sean números reales y dentro del rango mundial
 */
export function isValidCoordinate(lat: any, lng: any): boolean {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
}

const routeCache = new Map<string, number>();
const routePromises = new Map<string, Promise<number | null>>();

/**
 * Obtiene la distancia vial real usando Google Routes API.
 * Retorna la distancia en kilómetros como un float exacto.
 * Implementa caché en memoria y previene race conditions en llamadas simultáneas.
 */
export async function obtenerDistanciaVial(origenLat: number, origenLng: number, destLat: number, destLng: number): Promise<number | null> {
    const key = `${origenLat},${origenLng}|${destLat},${destLng}`;
    
    if (routeCache.has(key)) {
        return routeCache.get(key)!;
    }
    
    if (routePromises.has(key)) {
        return routePromises.get(key)!;
    }
    
    const promise = (async () => {
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!apiKey) throw new Error("API Key de Google Maps no configurada");
            
            const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
            const payload = {
                origin: { location: { latLng: { latitude: origenLat, longitude: origenLng } } },
                destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
                travelMode: "DRIVE"
            };
            
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": apiKey,
                    "X-Goog-FieldMask": "routes.distanceMeters"
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error("Error from Routes API:", await response.text());
                return null;
            }
            
            const data = await response.json();
            if (data.routes && data.routes.length > 0 && data.routes[0].distanceMeters !== undefined) {
                const distanceKm = data.routes[0].distanceMeters / 1000.0;
                routeCache.set(key, distanceKm);
                return distanceKm;
            }
            
            return null;
        } catch (error) {
            console.error("Error obteniendo ruta vial:", error);
            return null;
        } finally {
            routePromises.delete(key);
        }
    })();
    
    routePromises.set(key, promise);
    return promise;
}
