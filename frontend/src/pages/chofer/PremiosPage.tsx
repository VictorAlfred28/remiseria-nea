import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, CheckCircle2 } from "lucide-react";

export default function PremiosPage({ beneficios }: any) {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => navigate('/chofer')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 font-medium transition-colors text-sm w-fit">
                <ArrowLeft size={18} /> Volver al Panel
            </button>

            <h2 className="text-xl font-bold mb-4 text-purple-400 flex items-center gap-2"><Gift size={20}/> Tus Beneficios</h2>
            <p className="text-zinc-400 mb-6 text-sm">Estas son las recompensas y acuerdos exclusivos habilitados por tu empresa en comercios adheridos.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {beneficios?.length === 0 ? (
                     <div className="col-span-1 sm:col-span-2 text-center opacity-40 p-8 border border-dashed border-zinc-700 rounded-xl my-4">
                        <Gift size={48} className="mx-auto mb-4 text-zinc-600" />
                        <p className="text-sm">No hay beneficios disponibles en este momento.</p>
                     </div>
                 ) : (
                     beneficios?.map((ben: any) => (
                         <div key={ben.id} className="bg-gradient-to-br from-purple-900/40 to-zinc-900 border border-purple-800/30 p-5 rounded-2xl shadow-xl hover:border-purple-500/40 transition-colors relative overflow-hidden group flex flex-col">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                             <h3 className="font-bold text-white mb-1 text-lg">{ben.titulo}</h3>
                             <p className="text-sm text-purple-200 leading-relaxed mb-6">{ben.descripcion}</p>
                             <div className="flex items-center justify-between mt-auto">
                                 <div className="text-xs font-bold text-purple-400 bg-purple-950/40 border border-purple-500/20 px-2 py-1.5 rounded">
                                     {ben.puntos_requeridos > 0 ? `${ben.puntos_requeridos} PUNTOS` : 'GRATUITO'}
                                 </div>
                                 <button className="text-xs font-bold uppercase disabled bg-purple-600/50 px-3 py-1.5 rounded-lg text-white flex items-center gap-1 shadow-lg shadow-purple-900/50"><CheckCircle2 size={14}/> Disponible</button>
                             </div>
                         </div>
                     ))
                 )}
            </div>
        </div>
    );
}
