import React, { useState, useEffect } from "react";
import { Briefcase, Send, Clock, User, Car, Loader2, CheckCircle, XCircle, AlertCircle, MessageSquare } from "lucide-react";
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
    } catch (e) {
      console.error("Error cargando bolsa:", e);
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
      <div className="flex flex-col items-center justify-center p-20">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Conectando con la Bolsa de Empleos...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Tabs */}
      <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 w-full sm:w-fit mb-8 shadow-inner">
        <button 
          onClick={() => setView('ofertas')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${view === 'ofertas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Briefcase size={14} /> Vacantes Disponibles
        </button>
        <button 
          onClick={() => setView('mis-postulaciones')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-widest ${view === 'mis-postulaciones' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Clock size={14} /> Mis Postulaciones
        </button>
      </div>

      {view === 'ofertas' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ofertas.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl">
              <Briefcase size={48} className="mx-auto text-zinc-700 mb-4 opacity-20" />
              <p className="text-zinc-500 font-medium">No hay vacantes abiertas en este momento.</p>
              <p className="text-zinc-600 text-xs mt-1">Vuelve a revisar más tarde.</p>
            </div>
          ) : (
            ofertas.map((oferta) => {
              const yaPostulado = misPostulaciones.some(p => p.oferta_id === oferta.id);
              return (
                <div key={oferta.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col hover:border-zinc-700 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Car size={80} />
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="text-xl font-black text-white leading-tight mb-1">{oferta.titulo}</h3>
                    <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-tighter">
                      <User size={12} className="text-blue-500" /> {oferta.titular?.nombre}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6 flex-grow">
                    {oferta.vehicle && (
                      <div className="bg-black/40 p-3 rounded-2xl border border-zinc-800/50 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                          <Car size={16} />
                        </div>
                        <div>
                          <p className="text-white text-xs font-bold uppercase">{oferta.vehicle.marca} {oferta.vehicle.modelo}</p>
                          <p className="text-zinc-500 text-[10px] font-mono tracking-tighter uppercase">{oferta.vehicle.patente}</p>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-zinc-400 text-sm leading-relaxed line-clamp-3">
                      {oferta.descripcion || "Sin descripción adicional."}
                    </p>

                    {oferta.requisitos && (
                      <div className="pt-2">
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Requisitos</p>
                        <p className="text-zinc-300 text-xs italic">"{oferta.requisitos}"</p>
                      </div>
                    )}
                  </div>

                  {yaPostulado ? (
                    <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase">
                      <CheckCircle size={16} /> Ya te has postulado
                    </div>
                  ) : applying === oferta.id ? (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <textarea 
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        placeholder="Contanos tu experiencia o disponibilidad..."
                        className="w-full bg-black border border-blue-500/30 rounded-2xl p-4 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setApplying(null)}
                          className="flex-1 bg-zinc-800 text-zinc-400 py-3 rounded-2xl text-xs font-bold hover:bg-zinc-700 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => handleAplicar(oferta.id)}
                          className="flex-[2] bg-blue-600 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                        >
                          Enviar Postulación
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setApplying(oferta.id); setMensaje(""); }}
                      className="w-full bg-white text-black py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-95"
                    >
                      <Send size={14} /> Quiero postularme
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {misPostulaciones.length === 0 ? (
            <div className="py-16 text-center bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl">
              <Clock size={48} className="mx-auto text-zinc-700 mb-4 opacity-20" />
              <p className="text-zinc-500 font-medium">Aún no te has postulado a ninguna vacante.</p>
            </div>
          ) : (
            misPostulaciones.map((post) => (
              <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-zinc-700 transition-all">
                <div className="flex items-start gap-4">
                  <div className={`p-4 rounded-2xl border ${post.estado === 'aprobado' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : post.estado === 'rechazado' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                    {post.estado === 'aprobado' ? <CheckCircle size={24} /> : post.estado === 'rechazado' ? <XCircle size={24} /> : <Clock size={24} />}
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg leading-tight uppercase tracking-tight">{post.oferta?.titulo}</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase mt-1">Con {post.oferta?.titular?.nombre}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${post.estado === 'aprobado' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : post.estado === 'rechazado' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                        {post.estado}
                      </span>
                      {post.oferta?.vehicle && (
                        <span className="bg-zinc-950 border border-zinc-700 px-2.5 py-1 rounded-lg text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          {post.oferta.vehicle.patente}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-black/30 p-4 rounded-2xl border border-zinc-800 sm:max-w-xs w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={14} className="text-zinc-600" />
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Tu mensaje</span>
                  </div>
                  <p className="text-zinc-400 text-xs italic leading-relaxed">"{post.mensaje || "Sin mensaje."}"</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
