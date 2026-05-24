import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, MapPin, Loader2 } from "lucide-react";

export default function TarifarioPage({ activeTariff, fixedDestinations, loadingChoferData }: any) {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => navigate('/chofer')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 font-medium transition-colors text-sm w-fit">
                <ArrowLeft size={18} /> Volver al Panel
            </button>

            <h2 className="text-xl font-bold mb-4 text-blue-400 flex items-center gap-2"><Zap size={20}/> Tarifario Oficial IA</h2>
            <p className="text-zinc-400 mb-6 text-sm">Estos son los valores oficiales que nuestra Inteligencia Artificial le cotiza a los clientes.</p>
            {loadingChoferData ? <Loader2 className="animate-spin text-zinc-500 mx-auto"/> : (activeTariff || fixedDestinations?.length > 0) ? (
                <div className="flex flex-col gap-6">
                    {(activeTariff || fixedDestinations?.length > 0) && (
                        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl flex flex-col gap-6 shadow-xl">
                            <h3 className="font-bold text-white text-lg border-b border-zinc-800 pb-2 flex items-center gap-2"><Zap className="text-yellow-500"/> VALORES DE REFERENCIA</h3>
                            
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center hover:border-green-500/30 transition-colors">
                                    <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">Tarifa Mínima</p>
                                    <p className="text-green-400 font-black text-xl sm:text-2xl">${(activeTariff?.base_fare || 2500).toLocaleString('es-AR')}</p>
                                </div>
                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center hover:border-green-500/30 transition-colors">
                                    <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">Fracción {activeTariff?.fraction_km || 0.1} KM</p>
                                    <p className="text-green-400 font-black text-xl sm:text-2xl">${(activeTariff?.per_fraction_price || 175).toLocaleString('es-AR')}</p>
                                </div>
                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center hover:border-green-500/30 transition-colors">
                                    <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">Espera 10 Min.</p>
                                    <p className="text-green-400 font-black text-xl sm:text-2xl">${(activeTariff?.wait_block_price || 2500).toLocaleString('es-AR')}</p>
                                </div>
                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center hover:border-green-500/30 transition-colors">
                                    <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">Costo de Baúl</p>
                                    <p className="text-green-400 font-black text-xl sm:text-2xl">${(activeTariff?.trunk_price || 2500).toLocaleString('es-AR')}</p>
                                </div>
                            </div>

                            <div className="mt-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800">
                                <h4 className="text-white font-bold uppercase text-xs tracking-widest mb-4 flex items-center justify-between border-b border-zinc-800 pb-2">
                                    <span>TABLA COMPLETA POR KM RATE</span>
                                    <span className="text-[10px] text-zinc-500 font-normal px-2 py-0.5 rounded-full bg-zinc-900">Distancia Exacta</span>
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[500px] overflow-y-auto scroll-smooth pr-1">
                                    {(() => {
                                        const table = [];
                                        const fraction = activeTariff?.fraction_km || 0.1;
                                        const base_fare = activeTariff?.base_fare || 2500;
                                        const fraction_price = activeTariff?.per_fraction_price || 175;

                                        for (let d = 1.0; d <= 20.0; d += fraction) {
                                            const fractions = Math.round((d - 1.0) / fraction);
                                            const price = base_fare + (fractions * fraction_price);
                                            table.push(
                                                <div key={d.toFixed(1)} className="flex items-center justify-between bg-zinc-900 px-3 py-2.5 rounded-lg border border-zinc-800 hover:border-green-500/50 hover:bg-green-500/5 transition-all group">
                                                    <span className="text-zinc-400 font-bold text-xs uppercase group-hover:text-white transition-colors">{d.toFixed(1).replace('.', ',')} KM</span>
                                                    <span className="text-green-400 font-black text-sm">${price.toLocaleString('es-AR')}</span>
                                                </div>
                                            );
                                        }
                                        return table;
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {fixedDestinations?.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
                            <h3 className="font-bold text-white text-lg border-b border-zinc-800 pb-2 flex items-center gap-2"><MapPin className="text-red-400"/> ZONAS DE PRECIO FIJO</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto scroll-smooth pr-1">
                                {fixedDestinations.map((dest: any) => (
                                    <div key={dest.id} className="flex justify-between items-center bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 hover:border-zinc-500 transition-colors">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">{dest.name} {dest.peaje && <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-1 text-[10px]">C/PEAJE</span>}</span>
                                        <span className="text-white font-black text-sm">${dest.price?.toLocaleString('es-AR')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : <p className="text-zinc-500 italic text-center py-6">Tarifario no configurado por la administración.</p>}
        </div>
    );
}
