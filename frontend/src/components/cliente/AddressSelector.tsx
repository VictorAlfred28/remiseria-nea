import React, { useEffect } from 'react';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from 'use-places-autocomplete';
import { MapPin, Navigation, Search } from 'lucide-react';

interface AddressSelectorProps {
  onOriginSelect: (lat: number, lng: number, address: string) => void;
  onDestinationSelect: (lat: number, lng: number, address: string) => void;
  onRequestCurrentLocation: () => void;
  originAddress: string;
}

export default function AddressSelector({
  onOriginSelect,
  onDestinationSelect,
  onRequestCurrentLocation,
  originAddress,
}: AddressSelectorProps) {
  
  // Configuración de Autocomplete para Corrientes
  const searchOptions = {
    requestOptions: {
      componentRestrictions: { country: 'ar' },
      bounds: {
        north: -27.3,
        south: -27.6,
        east: -58.7,
        west: -59.0,
      },
      strictBounds: false,
    },
    debounce: 300,
  };

  const {
    ready,
    value: originValue,
    suggestions: { status: originStatus, data: originData },
    setValue: setOriginValue,
    clearSuggestions: clearOriginSuggestions,
  } = usePlacesAutocomplete(searchOptions);

  const {
    value: destValue,
    suggestions: { status: destStatus, data: destData },
    setValue: setDestValue,
    clearSuggestions: clearDestSuggestions,
  } = usePlacesAutocomplete(searchOptions);

  // Sincronizar el origen si el mapa o GPS lo actualizan
  useEffect(() => {
    if (originAddress && originAddress !== originValue) {
      setOriginValue(originAddress, false);
      clearOriginSuggestions();
    }
  }, [originAddress]);

  const handleSelectOrigin = async (address: string) => {
    setOriginValue(address, false);
    clearOriginSuggestions();
    try {
      const results = await getGeocode({ address });
      const { lat, lng } = await getLatLng(results[0]);
      onOriginSelect(lat, lng, address);
    } catch (error) {
      console.error('Error: ', error);
    }
  };

  const handleSelectDest = async (address: string) => {
    setDestValue(address, false);
    clearDestSuggestions();
    try {
      const results = await getGeocode({ address });
      const { lat, lng } = await getLatLng(results[0]);
      onDestinationSelect(lat, lng, address);
    } catch (error) {
      console.error('Error: ', error);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-4 shadow-2xl relative z-10">
      
      {/* ORIGEN */}
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="w-8 flex justify-center">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
          </div>
          <input
            value={originValue}
            onChange={(e) => setOriginValue(e.target.value)}
            disabled={!ready}
            placeholder="¿Dónde te buscamos?"
            className="w-full bg-zinc-950 border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none focus:border-blue-500 transition-colors"
          />
          <button 
            onClick={onRequestCurrentLocation}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
            title="Usar mi ubicación"
          >
            <Navigation size={18} />
          </button>
        </div>
        
        {/* Sugerencias Origen */}
        {originStatus === "OK" && (
          <ul className="absolute z-20 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl max-h-60 overflow-y-auto">
            {originData.map(({ place_id, description }) => (
              <li 
                key={place_id} 
                onClick={() => handleSelectOrigin(description)}
                className="px-4 py-3 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-300 flex items-center gap-3 border-b border-zinc-700/50 last:border-0"
              >
                <MapPin size={16} className="text-zinc-500" />
                {description}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex h-6 -my-2 relative z-0">
         <div className="w-8 flex justify-center">
             <div className="w-0.5 h-full bg-zinc-800"></div>
         </div>
      </div>

      {/* DESTINO */}
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="w-8 flex justify-center">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
          </div>
          <input
            value={destValue}
            onChange={(e) => setDestValue(e.target.value)}
            disabled={!ready}
            placeholder="¿A dónde vas?"
            className="w-full bg-zinc-950 border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none focus:border-green-500 transition-colors"
          />
        </div>

        {/* Sugerencias Destino */}
        {destStatus === "OK" && (
          <ul className="absolute z-20 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl max-h-60 overflow-y-auto">
            {destData.map(({ place_id, description }) => (
              <li 
                key={place_id} 
                onClick={() => handleSelectDest(description)}
                className="px-4 py-3 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-300 flex items-center gap-3 border-b border-zinc-700/50 last:border-0"
              >
                <Search size={16} className="text-zinc-500" />
                {description}
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
