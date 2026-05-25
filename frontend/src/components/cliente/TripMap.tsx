import React, { useCallback, useRef } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { DEFAULT_LOCATION } from '../../services/geolocation';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

interface TripMapProps {
  center: { lat: number; lng: number };
  onCenterChanged: (lat: number, lng: number) => void;
  destination?: { lat: number; lng: number } | null;
  isLoaded: boolean;
  isLocating: boolean;
}

export default function TripMap({ center, onCenterChanged, destination, isLoaded, isLocating }: TripMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onIdle = () => {
    if (mapRef.current) {
      const newCenter = mapRef.current.getCenter();
      if (newCenter) {
        onCenterChanged(newCenter.lat(), newCenter.lng());
      }
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLocating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-zinc-900/90 backdrop-blur-sm border border-blue-500/50 text-blue-400 px-4 py-2 rounded-full flex items-center gap-2 text-sm shadow-xl font-medium">
          <Loader2 className="animate-spin" size={16} />
          Obteniendo ubicación...
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        onLoad={onMapLoad}
        onIdle={onIdle}
        options={{
          disableDefaultUI: true,
          zoomControl: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
              featureType: "administrative.locality",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#263c3f" }],
            },
            {
              featureType: "poi.park",
              elementType: "labels.text.fill",
              stylers: [{ color: "#6b9a76" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#38414e" }],
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#212a37" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#9ca5b3" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#746855" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1f2835" }],
            },
            {
              featureType: "road.highway",
              elementType: "labels.text.fill",
              stylers: [{ color: "#f3d19c" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#17263c" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#515c6d" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#17263c" }],
            },
          ]
        }}
      >
        {/* Pin central estático tipo Uber */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none drop-shadow-2xl">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center border-2 border-white relative">
            <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
            <div className="w-1 h-4 bg-black absolute -bottom-4 left-1/2 -translate-x-1/2"></div>
            <div className="w-2 h-2 rounded-full bg-black/50 absolute -bottom-5 left-1/2 -translate-x-1/2 blur-sm"></div>
          </div>
        </div>

        {destination && (
          <Marker 
            position={destination} 
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#22c55e',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#ffffff',
              scale: 8,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
