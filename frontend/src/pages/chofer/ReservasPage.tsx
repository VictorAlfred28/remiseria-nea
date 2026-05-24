import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Loader2, MapPin, Navigation } from "lucide-react";

export default function ReservasPage({ loadingChoferData, choferReservas, handleFinalizarReserva }: any) {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => navigate('/chofer')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 font-medium transition-colors text-sm w-fit">
                <ArrowLeft size={18} /> Volver al Panel
            </button>

            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <Calendar size={20} className="text-blue-500"/> Reservas Programadas
            </h2>
            <p className="text-zinc-400 mb-6 text-sm">Viajes futuros que el sistema pronto despachará. Estate atento para tomarlos.</p>
            
            <div className="space-y-4">
                {loadingChoferData ? <Loader2 className="animate-spin tracking-widest text-zinc-500 mx-auto"/> : choferReservas.length === 0 ? (
                    <p className="text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-xl">No hay reservas pendientes de despachar.</p>
                ) : choferReservas.map((r: any) => (
                    <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                        <div className="flex justify-between items-start mb-2 border-b border-zinc-800 pb-2">
                            <span className="font-bold text-white text-lg">{new Date(r.fecha_viaje).toLocaleDateString()} a las <span className="text-blue-400">{r.hora_viaje.substring(0,5)}hs</span></span>
                            <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-blue-500/30">Próximamente</span>
                        </div>
                        <p className="text-sm font-medium text-white flex items-center gap-2 mt-3"><MapPin size={14} className="text-red-400"/> {r.origen}</p>
                        <p className="text-sm font-medium text-zinc-400 flex items-center gap-2 mt-1"><Navigation size={14} className="text-green-500"/> {r.destino}</p>
                        <div className="bg-zinc-950 p-2 rounded flex flex-col gap-2 mt-3 text-center">
                            <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Pasajero: {r.nombre_cliente}</span>
                            <button 
                                onClick={() => handleFinalizarReserva(r.id)}
                                className="text-[10px] font-black bg-blue-600/20 text-blue-400 border border-blue-500/30 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all uppercase tracking-tighter"
                            >
                                Confirmar Despacho
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
