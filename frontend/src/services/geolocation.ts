import { Geolocation } from '@capacitor/geolocation';

export const DEFAULT_LOCATION = {
  lat: -27.4692,
  lng: -58.8306,
};

export interface UserLocation {
  lat: number;
  lng: number;
  address?: string;
  error?: string;
}

/**
 * Solicita permisos y obtiene la ubicación actual del usuario.
 * Si falla, retorna la ubicación por defecto (Corrientes Capital).
 */
export async function getCurrentUserLocation(): Promise<UserLocation> {
  try {
    const permissions = await Geolocation.requestPermissions();
    if (permissions.location !== 'granted') {
      return {
        ...DEFAULT_LOCATION,
        error: 'Permiso denegado. Se usará la ubicación por defecto.',
      };
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (err: any) {
    console.error('Error obteniendo ubicación:', err);
    let errorMsg = 'No pudimos obtener tu ubicación.';
    if (err.message === 'location unavailable') {
      errorMsg = 'GPS desactivado o sin conexión.';
    } else if (err.message === 'location timeout') {
      errorMsg = 'El GPS tardó demasiado en responder.';
    }

    return {
      ...DEFAULT_LOCATION,
      error: errorMsg,
    };
  }
}

/**
 * Convierte coordenadas (lat, lng) en una dirección formateada.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!window.google || !window.google.maps) {
    console.warn("Google Maps no está cargado.");
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  const geocoder = new window.google.maps.Geocoder();
  try {
    const response = await geocoder.geocode({ location: { lat, lng } });
    if (response.results && response.results.length > 0) {
      return response.results[0].formatted_address;
    }
    return 'Dirección no encontrada';
  } catch (error) {
    console.error('Error en Reverse Geocoding:', error);
    return 'Error obteniendo dirección';
  }
}
