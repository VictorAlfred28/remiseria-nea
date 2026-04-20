import React, { useState, useEffect } from "react";
import { Briefcase, CheckCircle, XCircle, User, Car, Loader2, MessageCircle, Phone, AlertTriangle } from "lucide-react";
import { getBolsaAdminOfertas, aprobarPostulacionBolsa, rechazarPostulacionBolsa } from "../../services/api";

export default function BolsaAdminTab() {
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null); // post_id

  const fetchOfertas = async () => {
    setLoading(true);
    try {
      const data = await getBolsaAdminOfertas();
      setOfertas(data || []);
    } catch {
      console.error("Error al cargar bolsa en admin:");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfertas();
  }, []);

  const handleAprobar = async (postId: string) => {
    if (!window.confirm("¿Confirmar asignación oficial? Esta acción vinculará al chofer con el vehículo del titular y enviará notificaciones WhatsApp a ambos.")) return;
    
    setProcessing(postId);
    try {
      await aprobarPostulacionBolsa(postId);
      alert("¡Asignación exitosa! El chofer ya figura como conductor oficial de la unidad.");
      fetchOfertas();
    } catch {
      alert("Error al procesar la aprobación.");
    } finally {
      setProcessing(null);
    }
  };

  const handleRechazar = async (postId: string) => {
    if (!window.confirm("¿Seguro que deseas rechazar esta postulación?")) return;
    
    setProcessing(postId);
    try {
      await rechazarPostulacionBolsa(postId);
      fetchOfertas();
    } catch {
      alert("Error al procesar el rechazo.");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Sincronizando Bolsa de Empleos...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <Briefcase className="text-blue-500" size={28} /> Bolsa de Empleos <span className="text-zinc-700 font-light">| Mediación</span>
        </h2>
        <p className="text-zinc-500 text-sm mt-1">Supervisa las vacantes publicadas y aprueba las vinculaciones oficiales.</p>
      </div>

      <div className="space-y-6">
        {ofertas.length === 0 ? (
          <div className="py-20 text-center bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-[2.5rem]">
            <Briefcase size={64} className="mx-auto text-zinc-800 mb-6 opacity-20" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No hay actividad en la bolsa actualmente.</p>
          </div>
        ) : (
          ofertas.map((oferta) => (
            <div key={oferta.id} className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all hover:border-zinc-700/50">
              {/* Header Oferta */}
              <div className="p-8 border-b border-zinc-800/50 bg-gradient-to-r from-zinc-900 to-black/20 flex flex-col lg:flex-row justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${oferta.estado === 'abierta' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                      {oferta.estado}
                    </span>
                    <span className="text-zinc-600 text-xs">•</span>
                    <span className="text-zinc-500 text-xs font-bold">Publicado el {new Date(oferta.created_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white leading-none tracking-tight uppercase">{oferta.titulo}</h3>
                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Titular</p>
                        <p className="text-white text-sm font-bold">{oferta.titular?.nombre}</p>
                      </div>
                    </div>
                    {oferta.vehicle && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <Car size={16} />
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Unidad</p>
                          <p className="text-white text-sm font-bold">{oferta.vehicle.marca} {oferta.vehicle.modelo} <span className="text-zinc-500 font-mono text-[10px] ml-1">[{oferta.vehicle.patente}]</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800 self-start max-w-sm">
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Descripción de la vacante</p>
                  <p className="text-zinc-400 text-xs leading-relaxed italic">{oferta.descripcion || "Sin descripción."}</p>
                </div>
              </div>

              {/* Lista de Postulantes */}
              <div className="p-8 bg-black/10">
                <h4 className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                  <MessageCircle size={14} /> Postulantes ({oferta.postulaciones?.length || 0})
                </h4>
                
                <div className="grid grid-cols-1 gap-4">
                  {!oferta.postulaciones || oferta.postulaciones.length === 0 ? (
                    <div className="py-10 text-center bg-zinc-950/50 rounded-3xl border border-zinc-800/50 text-zinc-600 text-sm italic">
                      No hay postulantes interesados por ahora.
                    </div>
                  ) : (
                    oferta.postulaciones.map((p: any) => (
                      <div key={p.id} className={`group bg-zinc-900 border rounded-3xl p-6 transition-all ${p.estado === 'aprobado' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner ${p.estado === 'aprobado' ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white transition-colors'}`}>
                              {p.chofer?.nombre?.[0]}
                            </div>
                            <div>
                              <p className="text-white font-black text-lg uppercase tracking-tight">{p.chofer?.nombre}</p>
                              <div className="flex items-center gap-3 mt-1 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-1"><Phone size={12} className="text-blue-500"/> {p.chofer?.telefono}</span>
                                <span className="text-zinc-800">•</span>
                                <span>{p.chofer?.email}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 lg:mx-10 bg-black/40 p-4 rounded-2xl border border-zinc-800/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5">
                               <MessageCircle size={40} />
                            </div>
                            <p className="text-zinc-400 text-xs italic leading-relaxed relative z-10">"{p.mensaje || "Sin mensaje."}"</p>
                          </div>

                          <div className="flex items-center gap-3 w-full lg:w-auto">
                            {p.estado === 'pendiente' && oferta.estado === 'abierta' ? (
                              <>
                                <button 
                                  onClick={() => handleRechazar(p.id)}
                                  disabled={!!processing}
                                  className="flex-1 lg:flex-none p-4 rounded-2xl bg-zinc-800 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95 border border-transparent hover:border-red-500/20"
                                  title="Rechazar"
                                >
                                  {processing === p.id ? <Loader2 className="animate-spin" size={20} /> : <XCircle size={20} />}
                                </button>
                                <button 
                                  onClick={() => handleAprobar(p.id)}
                                  disabled={!!processing}
                                  className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  {processing === p.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                  APROBAR MATCH
                                </button>
                              </>
                            ) : (
                              <div className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border flex items-center gap-2 ${p.estado === 'aprobado' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                                {p.estado === 'aprobado' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                {p.estado}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Footer Info */}
      <div className="mt-12 bg-blue-600/5 border border-blue-500/10 p-6 rounded-3xl flex items-start gap-4">
        <AlertTriangle size={24} className="text-blue-500 shrink-0 mt-1" />
        <div>
          <p className="text-blue-200 text-sm font-bold mb-1 uppercase tracking-tight">Información de Mediación</p>
          <p className="text-blue-200/60 text-xs leading-relaxed">
            Al aprobar un "Match", el sistema desliga automáticamente al chofer de cualquier otro vehículo anterior, lo vincula a la unidad del titular en esta oferta y cierra la vacante. Todas las partes son notificadas via WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
