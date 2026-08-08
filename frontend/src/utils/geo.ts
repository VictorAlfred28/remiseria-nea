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
