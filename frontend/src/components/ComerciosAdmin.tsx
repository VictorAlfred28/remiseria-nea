import { API_BASE_URL } from '../config';
import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Store, ExternalLink, Edit, Trash2, X } from "lucide-react";

export default function ComerciosAdmin() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [editingComercio, setEditingComercio] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/admin/comercios/solicitudes`, {
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
      const resp = await fetch(`${API_BASE_URL}/admin/comercios/solicitudes/${id}/${action}`, {
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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este comercio adherido? Esta acción no se puede deshacer.")) return;
    
    setProcessingId(id);
    try {
      const resp = await fetch(`${API_BASE_URL}/admin/comercios/solicitudes/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if (resp.ok) {
        alert("Comercio eliminado exitosamente.");
        fetchSolicitudes();
      } else {
        const error = await resp.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error de red al eliminar");
    } finally {
      setProcessingId(null);
    }
  };

  const openEdit = (sol: any) => {
    setEditingComercio(sol);
    setEditFormData({
      nombre: sol.nombre || '',
      rubro: sol.rubro || '',
      direccion: sol.direccion || '',
      telefono: sol.telefono || '',
      email: sol.email || '',
      descripcion: sol.descripcion || '',
      logo_url: sol.logo_url || '',
      instagram_url: sol.instagram_url || '',
      facebook_url: sol.facebook_url || '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComercio) return;
    
    setProcessingId(editingComercio.id);
    try {
      const resp = await fetch(`${API_BASE_URL}/admin/comercios/solicitudes/${editingComercio.id}`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(editFormData)
      });
      if (resp.ok) {
        alert("Comercio actualizado exitosamente.");
        setEditingComercio(null);
        fetchSolicitudes();
      } else {
        const error = await resp.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error de red al actualizar");
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
                <div className="grid grid-cols-2 gap-3 mt-auto">
                  {sol.estado === 'PENDIENTE' && (
                    <>
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
                    </>
                  )}
                  {sol.estado !== 'PENDIENTE' && (
                    <button 
                      onClick={() => openEdit(sol)}
                      disabled={processingId === sol.id}
                      className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-xl font-bold transition disabled:opacity-50 text-sm"
                    >
                      <Edit size={16} /> 
                      Editar
                    </button>
                  )}
                  {sol.estado !== 'PENDIENTE' && (
                    <button 
                      onClick={() => handleDelete(sol.id)}
                      disabled={processingId === sol.id}
                      className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 border border-transparent hover:border-rose-500/30 py-2.5 rounded-xl font-bold transition disabled:opacity-50 text-sm"
                    >
                      {processingId === sol.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} 
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingComercio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit size={20} className="text-[#0D6EFD]" />
                Editar Comercio Adherido
              </h3>
              <button 
                onClick={() => setEditingComercio(null)}
                className="text-zinc-500 hover:text-white transition bg-white/5 hover:bg-white/10 rounded-full p-2"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Nombre</label>
                  <input type="text" required value={editFormData.nombre} onChange={e => setEditFormData({...editFormData, nombre: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Rubro</label>
                  <input type="text" required value={editFormData.rubro} onChange={e => setEditFormData({...editFormData, rubro: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Descripción</label>
                  <textarea rows={2} required value={editFormData.descripcion} onChange={e => setEditFormData({...editFormData, descripcion: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Dirección</label>
                  <input type="text" required value={editFormData.direccion} onChange={e => setEditFormData({...editFormData, direccion: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Teléfono</label>
                  <input type="text" required value={editFormData.telefono} onChange={e => setEditFormData({...editFormData, telefono: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Email</label>
                  <input type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">URL Logo</label>
                  <input type="url" value={editFormData.logo_url} onChange={e => setEditFormData({...editFormData, logo_url: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">URL Instagram</label>
                  <input type="url" value={editFormData.instagram_url} onChange={e => setEditFormData({...editFormData, instagram_url: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">URL Facebook</label>
                  <input type="url" value={editFormData.facebook_url} onChange={e => setEditFormData({...editFormData, facebook_url: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0D6EFD]/50 focus:ring-1 focus:ring-[#0D6EFD]/50 transition text-sm" />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 mt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingComercio(null)}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processingId === editingComercio.id}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#0D6EFD] text-white hover:bg-blue-600 transition shadow-[0_0_15px_rgba(13,110,253,0.3)] flex items-center gap-2"
                >
                  {processingId === editingComercio.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
