import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, Navigation2, BellRing, CheckCircle2, XCircle, Loader2, Lock } from "lucide-react";
import { calculateDistance } from "../../utils/geo";

// El cronómetro aislado
export const LocalWaitTimer = ({ isActive }: { isActive: boolean }) => {
    const [waitTimer, setWaitTimer] = React.useState(0);
    const timerRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (isActive) {
            timerRef.current = setInterval(() => {
                setWaitTimer(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setWaitTimer(0);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isActive]);

    if (!isActive) return null;

    return (
        <div className="bg-blue-950/20 p-5 rounded-xl border border-blue-500/30 text-center animate-pulse">
            <p className="text-xs font-black text-blue-400 mb-2 uppercase tracking-[0.2em]">Tiempo de Espera</p>
            <div className="text-4xl font-black text-white font-mono">
                {Math.floor(waitTimer / 60)}:{(waitTimer % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-[10px] mt-2 font-bold uppercase tracking-widest text-zinc-500">
                {waitTimer < 300 ? `Quedan ${Math.ceil((300 - waitTimer)/60)} min gratis` : <span className="text-yellow-500">Generando cargos por espera</span>}
            </p>
        </div>
    );
};

export default function SolicitudesPage({
    viajeActivo,
    isOnline,
    isBlocked,
    radarLoading,
    viajesDisponibles,
    choferCoords,
    handleAceptarViaje,
    handleNotificarLlegada,
    handleIniciarViaje,
    handleCancelarViaje,
    handleFinalizarViaje
}: any) {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => navigate('/chofer')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 font-medium transition-colors text-sm w-fit">
                <ArrowLeft size={18} /> Volver al Panel
            </button>

            <div className="space-y-6">
                {viajeActivo && (
                    // PANTALLA DE VIAJE EN CURSO 
                    <div className="bg-gradient-to-b from-blue-950/40 to-zinc-900 border-2 border-blue-500/40 p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="text-center mb-6">
                            <span className="bg-blue-500/20 text-blue-400 font-bold px-4 py-1.5 rounded-full text-sm uppercase tracking-wide border border-blue-500/30 inline-block mb-3 animate-pulse">
                                Viaje en Curso
                            </span>
                            <h2 className="text-2xl font-black text-white">Navegando al Destino</h2>
                            <p className="text-zinc-400 mt-1">
                                El pasajero te está esperando.
                                {viajeActivo.origen?.cliente_telefono && ` (📱 ${viajeActivo.origen.cliente_telefono})`}
                            </p>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                <p className="text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-widest">Punto de Origen</p>
                                <p className="text-lg text-white font-medium flex items-center gap-2">
                                    <MapPin className="text-red-400" size={20} />
                                    {viajeActivo.origen?.direccion || "Origen"}
                                </p>
                            </div>
                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                <p className="text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-widest">Punto de Destino</p>
                                <p className="text-lg text-white font-medium flex items-center gap-2">
                                    <Navigation className="text-blue-400" size={20} />
                                    {viajeActivo.destino?.direccion || "Destino"}
                                </p>
                            </div>
                            
                            <LocalWaitTimer isActive={viajeActivo.estado === 'ARRIVED'} />

                            <div className="bg-blue-950/20 p-4 rounded-xl border border-blue-500/20 text-center">
                                <p className="text-sm font-semibold text-blue-500 mb-1 uppercase tracking-widest">Cotización Estimada</p>
                                <p className="text-2xl text-cyan-400 font-black">
                                    ${viajeActivo.precio}
                                </p>
                                {viajeActivo.estado === 'STARTED' && (
                                    <p className="text-[10px] text-zinc-500 uppercase font-bold mt-1">El precio se ajustará al finalizar</p>
                                )}
                            </div>

                            {viajeActivo.usado_viaje_gratis && (
                                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-center shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse">
                                    <p className="text-amber-500 font-black text-lg tracking-tighter flex items-center justify-center gap-2">
                                        🎁 VIAJE GRATIS (COSTO $0)
                                    </p>
                                    <p className="text-amber-500/70 text-[10px] font-bold uppercase mt-1">Beneficio por fidelidad del pasajero</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            {viajeActivo.origen?.lat && viajeActivo.destino?.lat && (
                                <>
                                    <div className="w-full h-48 rounded-xl overflow-hidden border border-zinc-800 shadow-inner my-2">
                                        <iframe 
                                            width="100%" 
                                            height="100%" 
                                            frameBorder="0" 
                                            style={{ border: 0 }} 
                                            allowFullScreen 
                                            loading="lazy"
                                            src={`https://maps.google.com/maps?saddr=${viajeActivo.origen.lat},${viajeActivo.origen.lng}&daddr=${viajeActivo.destino.lat},${viajeActivo.destino.lng}&output=embed`}
                                        ></iframe>
                                    </div>
                                    <a 
                                        href={`https://www.google.com/maps/dir/?api=1&origin=${viajeActivo.origen.lat},${viajeActivo.origen.lng}&destination=${viajeActivo.destino.lat},${viajeActivo.destino.lng}&travelmode=driving`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full bg-blue-600 hover:bg-blue-500 flex justify-center items-center gap-2 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                                    >
                                        <Navigation2 size={20} /> ABRIR EN APP MAPS
                                    </a>
                                </>
                            )}
                            
                            <div className="grid grid-cols-2 gap-3 mt-2">
                               {viajeActivo.estado === 'ACCEPTED' || viajeActivo.estado === 'asignado' || viajeActivo.estado === 'en_camino' ? (
                                   <button 
                                       onClick={handleNotificarLlegada}
                                       className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 flex justify-center items-center gap-2 text-white font-bold py-4 rounded-xl transition-all shadow-lg"
                                   >
                                       <BellRing size={18} /> AVISAR LLEGADA
                                   </button>
                               ) : viajeActivo.estado === 'ARRIVED' ? (
                                   <button 
                                       onClick={handleIniciarViaje}
                                       className="w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 flex justify-center items-center gap-2 text-black font-black py-4 rounded-xl transition-all shadow-lg shadow-yellow-500/20"
                                   >
                                       <Navigation size={18} /> INICIAR VIAJE
                                   </button>
                               ) : (
                                   <button 
                                       disabled
                                       className="w-full bg-green-900/50 text-green-300 opacity-60 flex justify-center items-center gap-2 font-bold py-4 rounded-xl cursor-default"
                                    >
                                       <CheckCircle2 size={18} /> EN TRAMO (VIAJANDO)
                                   </button>
                               )}
                               
                               <button 
                                   onClick={handleCancelarViaje}
                                   className="w-full bg-red-950/40 hover:bg-red-900 border border-red-900/50 active:scale-95 flex justify-center items-center gap-2 text-red-400 font-bold py-4 rounded-xl transition-all"
                               >
                                   <XCircle size={18} /> CANCELAR
                               </button>
                            </div>
                            
                            <button 
                                disabled={viajeActivo.estado === 'ACCEPTED' || viajeActivo.estado === 'ARRIVED'}
                                onClick={handleFinalizarViaje}
                                className={`w-full mt-2 flex justify-center items-center gap-2 font-black py-5 rounded-xl transition-all shadow-xl text-lg uppercase ${
                                    (viajeActivo.estado === 'ACCEPTED' || viajeActivo.estado === 'ARRIVED')
                                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                                    : 'bg-green-500 hover:bg-green-400 text-black shadow-green-500/30'
                                }`}
                            >
                                <CheckCircle2 size={24} /> FINALIZAR VIAJE Y CALCULAR
                            </button>
                        </div>
                    </div>
                )}

                {/* PANTALLA DE RADAR DE VIAJES PENDIENTES */}
                <div className="pt-4 border-t border-white/5">
                    <h2 className="text-xl font-bold mb-4 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span>Radar de Solicitudes</span>
                            {isOnline && (
                                 <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                    {radarLoading ? (
                                        <Loader2 size={10} className="animate-spin text-blue-400" />
                                    ) : (
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                    )}
                                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                                        {radarLoading ? 'Buscando...' : 'Activo'}
                                    </span>
                                 </div>
                            )}
                        </div>
                        {viajeActivo && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-lg uppercase tracking-widest font-black ring-1 ring-yellow-500/30">Ocupado</span>}
                    </h2>
                    
                    {isBlocked ? (
                        <div className="bg-zinc-900/50 border-2 border-dashed border-red-900/30 p-12 rounded-3xl text-center space-y-4">
                            <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/20">
                                <Lock size={40} className="text-red-500" />
                            </div>
                            <h3 className="text-2xl font-black text-white">Radar Deshabilitado</h3>
                            <p className="text-zinc-400 max-w-md mx-auto">
                                No puedes recibir solicitudes de viajes mientras tu cuenta esté bloqueada por deuda. Regulariza tu situación en la oficina para volver a trabajar.
                            </p>
                        </div>
                    ) : !isOnline ? (
                        <p className="text-zinc-500 py-6 text-center text-sm border border-dashed border-zinc-800 rounded-xl">Inicia tu turno para buscar viajes locales.</p>
                    ) : (
                    <div className="space-y-4">
                        {viajesDisponibles.length === 0 ? (
                            <p className="text-zinc-500 py-6 text-center text-sm border border-dashed border-zinc-800 rounded-xl">No hay viajes disponibles por ahora.</p>
                        ) : (
                            viajesDisponibles.map((viaje: any) => {
                                const distancia = (choferCoords && viaje.origen?.lat) ? 
                                    calculateDistance(choferCoords.lat, choferCoords.lng, viaje.origen.lat, viaje.origen.lng) 
                                    : "N/A ";
                                
                                let distancia_destino = null;
                                if (viajeActivo && viajeActivo.destino?.lat && viaje.origen?.lat) {
                                    distancia_destino = calculateDistance(viajeActivo.destino.lat, viajeActivo.destino.lng, viaje.origen.lat, viaje.origen.lng);
                                }

                                return (
                                    <div key={viaje.id} className={`bg-zinc-900 border ${distancia_destino !== null && parseFloat(distancia_destino) < 2 ? 'border-blue-500/40' : 'border-zinc-800'} p-5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-zinc-700 animate-in slide-in-from-top-4 fade-in duration-300`}>
                                        <div className="w-full">
                                            <div className="flex justify-between w-full items-start">
                                                <p className="font-bold text-lg text-white flex items-center gap-2">
                                                    <MapPin size={18} className="text-red-400"/> {viaje.origen?.direccion || "Origen Desconocido"}
                                                </p>
                                                <div className="flex flex-col items-end">
                                                    <p className={`font-bold px-3 py-1 rounded-full text-sm flex-shrink-0 ${viaje.usado_viaje_gratis ? 'bg-amber-500 text-black' : 'bg-blue-950/40 text-blue-400'}`}>
                                                        {viaje.usado_viaje_gratis ? '🎁 GRATIS' : `$${viaje.precio}`}
                                                    </p>
                                                    {viaje.usado_viaje_gratis && <span className="text-[9px] text-amber-500 font-bold mt-1 uppercase">Puntos Cliente</span>}
                                                </div>
                                            </div>
                                            <p className="text-zinc-400 text-sm mt-2 flex items-center gap-2">
                                                <Navigation size={14}/> Destino: {viaje.destino?.direccion || "A confirmar"}
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <p className="text-yellow-500/90 text-[10px] font-bold bg-yellow-950/30 inline-block px-2 py-1 rounded-md uppercase tracking-wider">
                                                    📍 A {distancia} Km de ti
                                                </p>
                                                {distancia_destino !== null && (
                                                    <p className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${parseFloat(distancia_destino) < 2 ? 'bg-blue-900/40 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                        🏁 A {distancia_destino} Km de tu destino
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if (viajeActivo) {
                                                    if (!window.confirm("Ya tienes un viaje activo. ¿Deseas aceptar este como tu próximo viaje? Se notificará al pasajero.")) return;
                                                }
                                                handleAceptarViaje(viaje);
                                            }}
                                            className="w-full sm:w-auto mt-2 sm:mt-0 bg-white hover:bg-zinc-200 text-black font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-white/10 active:scale-95 whitespace-nowrap"
                                        >
                                            Aceptar Viaje
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
