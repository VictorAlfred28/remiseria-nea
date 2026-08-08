import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Car, MapPin, Navigation, Info, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// --- Iconos reutilizados ---
const carIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3202/3202926.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

const destIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const originIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// --- Tipos ---
export type TripStatus = 
  | 'Buscando conductor' 
  | 'Conductor asignado' 
  | 'En camino' 
  | 'Pasajero abordo' 
  | 'En progreso' 
  | 'Llegando' 
  | 'Finalizado';

export interface TripSimulatorProps {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  tripStatus: TripStatus;
  driverName?: string;
  vehicleInfo?: {
    model: string;
    licensePlate: string;
  };
  estimatedTime?: string;
  distance?: string;
  realtimeCoords?: { lat: number; lng: number } | null;
  simulationDurationMs?: number; // Por defecto 45000 (45 seg)
}

// --- Utilidad Matemática ---
// Distancia simple entre dos puntos (Euclidiana plana para tramos muy cortos)
const getDistance = (p1: [number, number], p2: [number, number]) => {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

// Componente para ajustar bounds del mapa
function MapBoundsFit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

export default function TripSimulator({
  origin,
  destination,
  tripStatus,
  driverName,
  vehicleInfo,
  estimatedTime,
  distance,
  realtimeCoords,
  simulationDurationMs = 45000,
}: TripSimulatorProps) {
  
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(true);
  const animationRef = useRef<number | null>(null);

  // 1. Obtener Ruta desde OSRM
  useEffect(() => {
    let isMounted = true;
    
    const fetchRoute = async () => {
      setIsRouteLoading(true);
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        
        if (data.routes && data.routes.length > 0 && isMounted) {
          // OSRM devuelve [lng, lat], Leaflet usa [lat, lng]
          const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          setRouteCoords(coords);
          setCurrentPos(coords[0]); // Iniciar en el origen
        }
      } catch (err) {
        console.error("Error obteniendo ruta OSRM:", err);
      } finally {
        if (isMounted) setIsRouteLoading(false);
      }
    };

    fetchRoute();
    
    return () => { isMounted = false; };
  }, [origin.lat, origin.lng, destination.lat, destination.lng]);

  // 2. Lógica de Animación (Simulador) vs Realtime
  useEffect(() => {
    // Si hay realtimeCoords, las usamos directamente (puedes agregar interpolación suave aquí en el futuro)
    if (realtimeCoords) {
      setCurrentPos([realtimeCoords.lat, realtimeCoords.lng]);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    // Si NO hay realtimeCoords y ya tenemos la ruta cargada, iniciamos la simulación
    if (routeCoords.length > 1) {
      
      // Precalcular segmentos y distancias
      const segments: { start: [number, number], end: [number, number], distance: number }[] = [];
      let totalDistance = 0;
      
      for (let i = 0; i < routeCoords.length - 1; i++) {
        const d = getDistance(routeCoords[i], routeCoords[i + 1]);
        segments.push({ start: routeCoords[i], end: routeCoords[i + 1], distance: d });
        totalDistance += d;
      }

      let startTime: number | null = null;

      const animate = (time: number) => {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        
        // Progreso de 0 a 1
        const progress = Math.min(elapsed / simulationDurationMs, 1);
        const targetDistance = totalDistance * progress;
        
        let accumulatedDistance = 0;
        
        // Encontrar en qué segmento estamos
        for (let i = 0; i < segments.length; i++) {
          const segDist = segments[i].distance;
          
          if (accumulatedDistance + segDist >= targetDistance || i === segments.length - 1) {
            // Interpolar dentro de este segmento
            // Evitar división por cero
            const segmentProgress = segDist === 0 ? 1 : (targetDistance - accumulatedDistance) / segDist;
            const lat = segments[i].start[0] + (segments[i].end[0] - segments[i].start[0]) * segmentProgress;
            const lng = segments[i].start[1] + (segments[i].end[1] - segments[i].start[1]) * segmentProgress;
            
            setCurrentPos([lat, lng]);
            break;
          }
          accumulatedDistance += segDist;
        }

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Asegurar que termine en el punto final exacto
          setCurrentPos(routeCoords[routeCoords.length - 1]);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }
  }, [routeCoords, realtimeCoords, simulationDurationMs]);

  const isFinalizado = tripStatus === 'Finalizado';

  return (
    <div className="relative w-full h-full flex flex-col bg-zinc-950 overflow-hidden font-sans text-white rounded-xl shadow-2xl border border-white/5">
      
      {/* Cabecera / Status Móvil Superior */}
      <div className="absolute top-0 w-full z-[400] p-4 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl pointer-events-auto transition-all">
          <div className="flex items-center gap-3">
             {tripStatus === 'Buscando conductor' && <Loader2 className="animate-spin text-blue-500" size={24} />}
             {tripStatus === 'Llegando' && <MapPin className="text-green-500 animate-bounce" size={24} />}
             {['En camino', 'En progreso'].includes(tripStatus) && <Navigation className="text-blue-500 animate-pulse" size={24} />}
             {isFinalizado && <MapPin className="text-blue-500" size={24} />}
             
             <div>
               <h2 className="font-black text-lg tracking-tight text-white">{tripStatus}</h2>
               {estimatedTime && <p className="text-xs text-zinc-400 font-medium">Llegada est. en {estimatedTime}</p>}
             </div>
          </div>
        </div>
      </div>

      {/* Capa del Mapa */}
      <div className="flex-1 w-full relative z-0">
        <MapContainer 
          center={[origin.lat, origin.lng]} 
          zoom={14} 
          className="h-full w-full" 
          zoomControl={false}
          scrollWheelZoom={false} // Evitar zoom extremo accidental
          doubleClickZoom={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-tiles-dark" // Opcional si tienes CSS filter para dark mode
          />

          {/* Rutas (Polyline) */}
          {routeCoords.length > 0 && (
            <Polyline 
              positions={routeCoords} 
              color="#3b82f6" // Color azul de la ruta
              weight={5} 
              opacity={0.8}
            />
          )}

          {/* Auto-ajustar vista para que se vean origen y destino */}
          {routeCoords.length > 0 && <MapBoundsFit points={routeCoords} />}

          {/* Marcador de Origen */}
          <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
            <Popup>Punto de Origen</Popup>
          </Marker>

          {/* Marcador de Destino */}
          <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
            <Popup>Destino</Popup>
          </Marker>

          {/* Marcador Animado del Vehículo */}
          {currentPos && !isFinalizado && (
            <Marker position={currentPos} icon={carIcon}>
              {vehicleInfo?.licensePlate && (
                <Popup>
                  <div className="font-bold text-center text-zinc-900 leading-tight">
                    <span className="text-lg bg-yellow-200 px-1 py-0.5 mt-1 block uppercase rounded">
                      {vehicleInfo.licensePlate}
                    </span>
                  </div>
                </Popup>
              )}
            </Marker>
          )}
        </MapContainer>

        {isRouteLoading && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[400] bg-black/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
             <Loader2 className="animate-spin text-blue-400" size={20} />
             <p className="text-sm font-medium text-white shadow-sm">Calculando ruta...</p>
          </div>
        )}
      </div>

      {/* Panel Flotante Inferior estilo Uber */}
      <div className="absolute bottom-0 w-full z-[400] p-4 pointer-events-none">
        <div className="bg-black/90 backdrop-blur-xl border border-white/10 p-5 rounded-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto">
          
          {driverName ? (
            <div className="flex justify-between items-center bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-blue-950/50 rounded-full flex items-center justify-center text-blue-500 border border-blue-900 shadow-inner">
                   <Car size={28} />
                </div>
                <div>
                  <p className="font-black text-xl text-white tracking-tight">{driverName}</p>
                  <p className="text-sm text-zinc-400 font-medium capitalize">{vehicleInfo?.model || 'Vehículo Asignado'}</p>
                </div>
              </div>
              
              {vehicleInfo?.licensePlate && (
                <div className="text-right flex flex-col items-end">
                  <p className="text-[10px] uppercase font-black text-zinc-500 mb-1 tracking-wider">Patente</p>
                  <p className="bg-white text-black font-black px-3 py-1.5 rounded-lg shadow-sm text-sm whitespace-nowrap uppercase tracking-widest border-2 border-zinc-300">
                    {vehicleInfo.licensePlate}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 gap-3">
               <Loader2 className="animate-spin text-blue-500" size={20} />
               <p className="text-zinc-300 font-medium tracking-wide">Esperando datos del conductor...</p>
            </div>
          )}

          {/* Detalles Extras (Distancia / Info) */}
          <div className="mt-4 flex gap-4 text-sm text-zinc-400 px-2 items-center">
            <Info size={18} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1">
               <p className="font-medium text-zinc-300">Viaje asegurado con UBI</p>
               <p className="text-xs text-zinc-500">{distance ? `Distancia total estimada: ${distance}` : 'Monitoreo en tiempo real activo'}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Estilos CSS Globales inyectados para mantener oscuridad si TileLayer no tiene filtros */}
      <style>{`
        .map-tiles-dark {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }
      `}</style>
    </div>
  );
}
