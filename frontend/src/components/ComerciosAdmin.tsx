import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Store, ExternalLink } from "lucide-react";

export default function ComerciosAdmin() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/comercios/solicitudes`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if (resp.ok) {
        setSolicitudes(await resp.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'aprobar' | 'rechazar') => {
    if (!confirm(`¿Estás seguro de ${action} esta solicitud?`)) return;
    
    setProcessingId(id);
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/comercios/solicitudes/${id}/${action}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if (resp.ok) {
        alert(`Solicitud ${action}da exitosamente.`);
        fetchSolicitudes();
      } else {
        const error = await resp.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error de red");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2"><Store className="text-blue-500" /> Solicitudes de Comercios</h2>
          <p className="text-zinc-500 text-sm">Gestiona las solicitudes de socios para adherir sus negocios a la plataforma.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {solicitudes.length === 0 ? (
             <div className="col-span-full border-2 border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-500">
                 No hay solicitudes pendientes.
             </div>
          ) : (
            solicitudes.map((sol) => (
              <div key={sol.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden flex flex-col group hover:border-zinc-700 transition">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    {sol.logo_url ? (
                      <img src={sol.logo_url} alt="Logo" className="w-12 h-12 rounded-full border-2 border-zinc-700 object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                        <Store size={20} />
                      </div>
                    )}
                    <div>
                      <h3 className="text-white font-bold text-lg leading-tight">{sol.nombre}</h3>
                      <p className="text-xs text-blue-400 font-bold uppercase">{sol.rubro}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded 
                    ${sol.estado === 'PENDIENTE' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                      sol.estado === 'APROBADO' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                      'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                    {sol.estado}
                  </span>
                </div>

                {/* Body */}
                <div className="flex-1 space-y-3 mb-6">
                  <p className="text-zinc-400 text-sm italic border-l-2 border-zinc-800 pl-3">"{sol.descripcion}"</p>
                  <div className="text-xs text-zinc-500 grid gap-1">
                    <p><strong className="text-zinc-300">Dirección:</strong> {sol.direccion}</p>
                    {sol.telefono && <p><strong className="text-zinc-300">Teléfono:</strong> {sol.telefono}</p>}
                    {sol.email && <p><strong className="text-zinc-300">Email Contacto:</strong> {sol.email}</p>}
                    <p><strong className="text-zinc-300">Usuario Asignado:</strong> {sol.auth_users?.email || 'N/A'}</p>
                  </div>
                  
                  {(sol.instagram_url || sol.facebook_url) && (
                    <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                       {sol.instagram_url && <a href={sol.instagram_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs flex gap-1 items-center"><ExternalLink size={12}/> Instagram</a>}
                       {sol.facebook_url && <a href={sol.facebook_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs flex gap-1 items-center"><ExternalLink size={12}/> Facebook</a>}
                    </div>
                  )}
                </div>

                {/* Footer (Actions) */}
                {sol.estado === 'PENDIENTE' && (
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <button 
                      onClick={() => handleAction(sol.id, 'rechazar')}
                      disabled={processingId === sol.id}
                      className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 border border-transparent hover:border-rose-500/30 py-2.5 rounded-xl font-bold transition disabled:opacity-50 text-sm"
                    >
                      {processingId === sol.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} 
                      Rechazar
                    </button>
                    <button 
                      onClick={() => handleAction(sol.id, 'aprobar')}
                      disabled={processingId === sol.id}
                      className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold transition shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50 text-sm"
                    >
                      {processingId === sol.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Aprobar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
