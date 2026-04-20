import React, { useState, useEffect } from "react";
import { Briefcase, Send, Clock, User, Car, Loader2, CheckCircle, MessageSquare } from "lucide-react";
import { getBolsaOfertasCercanas, aplicarOfertaBolsa, getMisPostulacionesBolsa } from "../../services/api";

export default function BolsaChoferTab() {
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [misPostulaciones, setMisPostulaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [view, setView] = useState<'ofertas' | 'mis-postulaciones'>('ofertas');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([
        getBolsaOfertasCercanas(),
        getMisPostulacionesBolsa()
      ]);
      setOfertas(o || []);
      setMisPostulaciones(p || []);
    } catch {
      console.error("Error cargando bolsa:");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAplicar = async (ofertaId: string) => {
    if (!mensaje.trim()) {
      alert("Por favor, escribí un breve mensaje sobre tu experiencia.");
      return;
    }
    setApplying(ofertaId);
    try {
      await aplicarOfertaBolsa(ofertaId, mensaje);
      alert("¡Postulación enviada con éxito! Administración revisará tu perfil.");
      setMensaje("");
      setApplying(null);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Error al postularte.");
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Buscando oportunidades...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Briefcase className="text-blue-500" size={28} /> Bolsa de Empleos
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Encontrá tu próximo vehículo para trabajar de forma oficial.</p>
        </div>
        
        <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
           <button 
             onClick={() => setView('ofertas')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'ofertas' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
           >
             Vacantes
           </button>
           <button 
             onClick={() => setView('mis-postulaciones')}
             className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'mis-postulaciones' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
           >
             Mis Postulaciones
           </button>
        </div>
      </div>

      {view === 'ofertas' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ofertas.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-[2.5rem]">
               <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No hay vacantes disponibles en este momento.</p>
            </div>
          ) : (
            ofertas.map((o) => {
              const yaPostulado = misPostulaciones.some(p => p.bolsa_id === o.id);
              return (
                <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Car size={80} />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-tighter border border-blue-500/20">TRABAJO OFICIAL</span>
                  </div>

                  <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">{o.titulo}</h3>
                  <div className="flex items-center gap-3 text-zinc-500 text-xs font-bold mb-6">
                    <span className="flex items-center gap-1"><User size={14}/> {o.titular?.nombre}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Car size={14}/> {o.vehicle?.marca} {o.vehicle?.modelo}</span>
                  </div>

                  <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800/50 mb-6">
                    <p className="text-zinc-400 text-sm italic leading-relaxed">"{o.descripcion}"</p>
                  </div>

                  {yaPostulado ? (
                    <div className="w-full py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                       <CheckCircle size={16} /> YA TE POSTULASTE
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <textarea 
                          placeholder="Contale al titular por qué sos un buen candidato (ej: experiencia, zona, disponibilidad)..."
                          value={mensaje}
                          onChange={(e) => setMensaje(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white text-sm focus:border-blue-500 outline-none transition-all placeholder:text-zinc-700 h-24 resize-none"
                        />
                      </div>
                      <button 
                        onClick={() => handleAplicar(o.id)}
                        disabled={!!applying}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {applying === o.id ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                        POSTULARME AHORA
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {misPostulaciones.length === 0 ? (
            <div className="py-20 text-center bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-[2.5rem]">
               <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Todavía no te postulaste a ninguna vacante.</p>
            </div>
          ) : (
            misPostulaciones.map((p) => (
              <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-black uppercase tracking-tight">{p.bolsa?.titulo}</h4>
                    <p className="text-zinc-500 text-xs font-bold">Postulado el {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex-1 bg-black/30 p-4 rounded-2xl border border-zinc-800/50">
                   <p className="text-zinc-500 text-xs italic flex items-center gap-2">
                     <MessageSquare size={12} /> "{p.mensaje}"
                   </p>
                </div>

                <div className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 ${
                  p.estado === 'pendiente' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                  p.estado === 'aprobado' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  'bg-red-500/10 border-red-500/20 text-red-500'
                }`}>
                  <Clock size={14} /> {p.estado}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
