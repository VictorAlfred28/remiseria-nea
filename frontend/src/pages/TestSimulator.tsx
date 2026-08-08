import React, { useState } from 'react';
import TripSimulator from '../components/cliente/TripSimulator';
import type { TripStatus } from '../components/cliente/TripSimulator';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TestSimulator() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TripStatus>('Buscando conductor');
  const [key, setKey] = useState(0); // Para forzar re-render y reiniciar simulación

  // Puntos fijos de prueba (Resistencia, Chaco)
  const origin = { lat: -27.451, lng: -58.986 }; // Ej. Plaza 25 de Mayo
  const destination = { lat: -27.464, lng: -58.972 }; // Ej. Sarmiento Shopping

  const handleRestart = () => {
    setStatus('Buscando conductor');
    setKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 md:p-8 font-sans">
      
      {/* Controles del Test */}
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 p-6 rounded-2xl mb-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
           <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white flex items-center gap-2 text-sm font-bold mb-2 transition-colors">
             <ArrowLeft size={16} /> Volver
           </button>
           <h1 className="text-2xl font-black text-white">Prueba: Trip Simulator</h1>
           <p className="text-sm text-zinc-500">Cambia el estado para ver cómo reacciona el componente.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value as TripStatus)}
            className="bg-zinc-950 border border-zinc-800 text-white px-4 py-2.5 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="Buscando conductor">Buscando conductor</option>
            <option value="Conductor asignado">Conductor asignado</option>
            <option value="En camino">En camino</option>
            <option value="Llegando">Llegando</option>
            <option value="En progreso">Viaje en progreso</option>
            <option value="Finalizado">Finalizado</option>
          </select>
          
          <button 
            onClick={handleRestart}
            className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] active:scale-95"
            title="Reiniciar Simulación"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* Contenedor Simulando pantalla de celular */}
      <div className="w-full max-w-md h-[800px] bg-black rounded-[2.5rem] border-8 border-zinc-900 shadow-2xl overflow-hidden relative">
        <TripSimulator 
          key={key}
          origin={origin}
          destination={destination}
          tripStatus={status}
          driverName={status === 'Buscando conductor' ? undefined : "Juan Pérez"}
          vehicleInfo={status === 'Buscando conductor' ? undefined : { model: "Toyota Etios", licensePlate: "AF 456 XY" }}
          estimatedTime="4 min"
          distance="1.2 km"
          simulationDurationMs={30000} // 30 segundos para probar rápido
        />
      </div>

    </div>
  );
}
