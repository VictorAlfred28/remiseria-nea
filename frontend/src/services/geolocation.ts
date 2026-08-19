import { Geolocation } from '@capacitor/geolocation';

export interface UserLocation {
  lat?: number;
  lng?: number;
  accuracy?: number;
  address?: string;
  error?: string;
}

/**
 * Solicita permisos y obtiene la ubicación actual del usuario.
 * Si falla, retorna un objeto con el mensaje de error.
 */
export async function getCurrentUserLocation(): Promise<UserLocation> {
  try {
    const permissions = await Geolocation.requestPermissions();
    if (permissions.location !== 'granted') {
      return {
        error: 'Permiso denegado. Por favor ingresa tu dirección manualmente.',
      };
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0, // No usar caché, forzar lectura nueva
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch (err: any) {
    console.error('Error obteniendo ubicación:', err);
    let errorMsg = 'No pudimos obtener tu ubicación. Por favor ingresa la dirección manualmente.';
    if (err.message === 'location unavailable') {
      errorMsg = 'GPS desactivado o sin conexión. Verifica los ajustes de tu dispositivo.';
    } else if (err.message === 'location timeout') {
      errorMsg = 'El GPS tardó demasiado en responder.';
    }

    return {
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
