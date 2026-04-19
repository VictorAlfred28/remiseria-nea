import React, { useState, useEffect } from "react";
import { Briefcase, Users, PlusCircle, CheckCircle, XCircle, Car, ArrowLeft, Loader2 } from "lucide-react";
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
    } catch {
      console.error("Error cargando mis ofertas:");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfertas();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    
    setCreating(true);
    try {
      await createOfertaBolsa({
        vehicle_id: vehicleId,
        titulo: titulo || "Vacante para chofer oficial",
        descripcion,
        requisitos
      });
      alert("¡Vacante publicada con éxito! Ya es visible para los choferes en la bolsa.");
      setShowForm(false);
      fetchOfertas();
    } catch {
      alert("Error al publicar vacante.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-[3rem] border border-zinc-800">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Cargando tus vacantes...</p>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 animate-in zoom-in-95 duration-300">
        <button onClick={() => setShowForm(false)} className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
           <ArrowLeft size={16} /> Volver a mis ofertas
        </button>

        <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-3 decoration-blue-500 decoration-4 underline-offset-8">
           <PlusCircle className="text-blue-500" size={24} /> NUEVA VACANTE
        </h3>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Título de la oferta</label>
            <input 
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-zinc-800"
              placeholder="Ej: Chofer para turno noche / Zona Norte"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Descripción del trabajo</label>
            <textarea 
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-zinc-800 h-32 resize-none"
              placeholder="Describí las condiciones, horarios, recaudación..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 text-[10px] font-black uppercase tracking-widest ml-1">Requisitos (Opcional)</label>
            <input 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-zinc-800"
              placeholder="Ej: Registro profesional vigente, +5 años exp..."
              value={requisitos}
              onChange={(e) => setRequisitos(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={creating}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {creating ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
            PUBLICAR EN LA BOLSA
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Briefcase className="text-blue-500" size={28} /> Mis Vacantes
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Gestioná las ofertas de trabajo para tus vehículos.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={onBack}
            className="px-6 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <button 
            onClick={() => setShowForm(true)}
            className="px-8 py-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <PlusCircle size={16} /> PUBLICAR NUEVA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {misOfertas.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-[3rem]">
            <Briefcase size={48} className="mx-auto text-zinc-800 mb-4 opacity-20" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No tenés vacantes publicadas actualmente.</p>
          </div>
        ) : (
          misOfertas.map((o) => (
            <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 hover:border-zinc-700 transition-all group relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5">
                   <Users size={60} />
               </div>
               
               <div className="flex items-center justify-between mb-4">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${o.estado === 'abierta' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                    {o.estado}
                  </span>
                  <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">{new Date(o.created_at).toLocaleDateString()}</span>
               </div>

               <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">{o.titulo}</h3>
               <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold mb-6">
                  <Car size={14} className="text-blue-500"/> {o.vehicle?.marca} {o.vehicle?.modelo} <span className="text-zinc-700">•</span> {o.vehicle?.patente}
               </div>

               <div className="bg-black/40 p-4 rounded-xl border border-zinc-800/50 mb-6">
                  <p className="text-zinc-400 text-xs italic line-clamp-2">"{o.descripcion}"</p>
               </div>

               <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 font-black text-white flex items-center justify-center text-[10px]">
                      {o.postulaciones?.length || 0}
                    </div>
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Postulantes</span>
                  </div>
                  
                  <div className="text-zinc-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                     <CheckCircle size={12} /> Administración revisando
                  </div>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
