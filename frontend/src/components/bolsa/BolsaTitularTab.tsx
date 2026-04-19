import React, { useState, useEffect } from "react";
import { Briefcase, Users, PlusCircle, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Car, ArrowLeft, Loader2 } from "lucide-react";
import { getMisOfertasBolsa, createOfertaBolsa } from "../../services/api";

interface BolsaTitularTabProps {
  vehicleId?: string;
  onBack?: () => void;
}

export default function BolsaTitularTab({ vehicleId, onBack }: BolsaTitularTabProps) {
  const [misOfertas, setMisOfertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [requisitos, setRequisitos] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchOfertas = async () => {
    setLoading(true);
    try {
      const data = await getMisOfertasBolsa();
      setMisOfertas(data || []);
    } catch (e) {
      console.error("Error cargando mis ofertas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfertas();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createOfertaBolsa({
        vehicle_id: vehicleId,
        titulo,
        descripcion,
        requisitos
      });
      alert("¡Oferta publicada! Los choferes ya pueden postularse.");
      setTitulo(""); setDescripcion(""); setRequisitos("");
      setShowForm(false);
      fetchOfertas();
    } catch (e) {
      alert("Error al publicar la oferta.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-500 mb-4" />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Cargando tus vacantes...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Briefcase size={20} className="text-blue-500" /> Bolsa de Empleos
            </h2>
            <p className="text-zinc-500 text-xs">Gestioná las vacantes para tus vehículos.</p>
          </div>
        </div>
        
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
          >
            <PlusCircle size={16} /> Publicar Vacante
          </button>
        )}
      </div>

      {showForm ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-8 animate-in zoom-in-95 duration-200">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">Completa los datos de la vacante</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <input 
              required
              value={titulo} 
              onChange={e => setTitulo(e.target.value)}
              placeholder="Título (ej: Chofer para Turno Noche)" 
              className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
            <textarea 
              value={descripcion} 
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción de la propuesta (horarios, zona, etc)" 
              className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <input 
              value={requisitos} 
              onChange={e => setRequisitos(e.target.value)}
              placeholder="Requisitos (ej: Carnet profesional, +2 años exp)" 
              className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="flex-1 bg-zinc-800 text-zinc-400 py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={creating}
                className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {creating ? <Loader2 className="animate-spin mx-auto" /> : "Publicar Ahora"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          {misOfertas.length === 0 ? (
            <div className="py-12 text-center bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl">
              <PlusCircle size={40} className="mx-auto text-zinc-700 mb-3 opacity-20" />
              <p className="text-zinc-500 text-sm">Aún no has publicado ninguna vacante.</p>
            </div>
          ) : (
            misOfertas.map((oferta) => (
              <div key={oferta.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden hover:border-zinc-700 transition-all">
                <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                      <Briefcase size={24} />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-lg leading-tight uppercase">{oferta.titulo}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${oferta.estado === 'abierta' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                          {oferta.estado}
                        </span>
                        {oferta.vehicles && (
                          <span className="text-zinc-500 text-[10px] font-bold flex items-center gap-1">
                            <Car size={10} /> {oferta.vehicles.patente}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right hidden sm:block">
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Publicado</p>
                      <p className="text-zinc-300 text-xs font-bold">{new Date(oferta.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Lista de postulaciones para esta oferta */}
                <div className="bg-black/20 p-4 sm:p-6">
                  <h4 className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Users size={12} /> Postulaciones recibidas ({oferta.postulaciones?.length || 0})
                  </h4>
                  
                  <div className="space-y-3">
                    {!oferta.postulaciones || oferta.postulaciones.length === 0 ? (
                      <p className="text-zinc-600 text-xs italic">Nadie se ha postulado todavía.</p>
                    ) : (
                      oferta.postulaciones.map((p: any) => (
                        <div key={p.id} className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-sm">
                              {p.chofer?.nombre?.[0]}
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm">{p.chofer?.nombre}</p>
                              <p className="text-zinc-500 text-[10px] font-bold">{p.chofer?.telefono}</p>
                            </div>
                          </div>
                          
                          <div className="flex-1 max-w-sm px-4">
                            <p className="text-zinc-400 text-xs line-clamp-2 italic leading-relaxed">"{p.mensaje || "Sin mensaje."}"</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${p.estado === 'aprobado' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : p.estado === 'rechazado' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                              {p.estado}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {oferta.estado === 'abierta' && (
                    <div className="mt-6 pt-4 border-t border-zinc-800/50">
                      <p className="text-[10px] text-zinc-600 italic">
                        * Para aprobar a un chofer, contactate con Administración para que valide el perfil y realice el alta oficial.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
