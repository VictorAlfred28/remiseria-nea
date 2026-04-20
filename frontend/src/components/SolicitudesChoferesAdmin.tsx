import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Search, FileImage, ShieldCheck, Mail, Phone, MapPin, Car, Info, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';

export default function SolicitudesChoferesAdmin() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSol, setSelectedSol] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/admin/choferes/pendientes');
      setSolicitudes(resp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  const handleApprove = async () => {
    if (!selectedSol) return;
    setProcessing(true);
    try {
      await api.post(`/admin/choferes/${selectedSol.id}/aprobar`);
      alert("Chofer aprobado exitosamente.");
      setSelectedSol(null);
      fetchSolicitudes();
    } catch (err: any) {
      alert("Error aprobando: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSol) return;
    if (!confirm("¿Estás seguro de rechazar esta solicitud?")) return;
    setProcessing(true);
    try {
      await api.post(`/admin/choferes/${selectedSol.id}/rechazar`);
      alert("Solicitud rechazada.");
      setSelectedSol(null);
      fetchSolicitudes();
    } catch (err: any) {
      alert("Error rechazando: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessing(false);
    }
  };

  const filtered = solicitudes.filter(s => 
    (s.usuarios?.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.usuarios?.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Solicitudes Pendientes</h2>
            <p className="text-zinc-500 text-sm">Gestiona y revisa nuevos candidatos a chofer.</p>
          </div>
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input 
                 type="text" 
                 placeholder="Buscar por nombre o email..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
              />
          </div>
       </div>

       {loading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div> : filtered.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800/80 p-10 rounded-2xl flex flex-col items-center justify-center text-center">
             <ShieldCheck size={48} className="text-zinc-700 mb-4" />
             <h3 className="text-lg font-bold text-white mb-1">Todo al día</h3>
             <p className="text-zinc-500">No hay nuevas solicitudes pendientes de revisión.</p>
          </div>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {filtered.map(sol => (
                 <div key={sol.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-blue-500/50 transition-colors">
                     <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center font-black">
                                 {sol.usuarios?.nombre?.substring(0, 1)}
                             </div>
                             <div>
                                 <h4 className="font-bold text-white text-sm">{sol.usuarios?.nombre}</h4>
                                 <p className="text-xs text-zinc-500">{new Date(sol.created_at).toLocaleDateString()}</p>
                             </div>
                         </div>
                         <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">EN REVISIÓN</span>
                     </div>
                     <div className="space-y-2 mb-4">
                         <div className="flex items-center gap-2 text-xs text-zinc-400"><Car size={14}/> {sol.vehiculo} ({sol.patente})</div>
                         <div className="flex items-center gap-2 text-xs text-zinc-400"><Phone size={14}/> {sol.usuarios?.telefono}</div>
                     </div>
                     <button onClick={() => setSelectedSol(sol)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl text-xs transition-colors">
                         Ver Detalles y Validar
                     </button>
                 </div>
             ))}
          </div>
       )}

       {selectedSol && (
         <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
               
               <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-950 z-10">
                   <div>
                       <h2 className="text-xl font-black text-white">Revisión de Solicitud</h2>
                       <p className="text-zinc-500 text-sm">Chofer: {selectedSol.usuarios?.nombre}</p>
                   </div>
                   <button onClick={() => setSelectedSol(null)} className="text-zinc-500 hover:text-white bg-zinc-900 p-2 rounded-full">✕</button>
               </div>
               
               <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6 flex-1">
                        <div>
                             <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Datos Personales</h3>
                             <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 p-4 text-sm">
                                  <div className="flex items-center justify-between"><span className="text-zinc-500">Email</span><span className="text-white">{selectedSol.usuarios?.email}</span></div>
                                  <div className="flex items-center justify-between"><span className="text-zinc-500">Teléfono</span><span className="text-white">{selectedSol.usuarios?.telefono}</span></div>
                                  <div className="flex items-center justify-between"><span className="text-zinc-500">Dirección</span><span className="text-white">{selectedSol.usuarios?.direccion || 'No especificada'}</span></div>
                             </div>
                        </div>
                        <div>
                             <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Licencia y Vehículo</h3>
                             <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 text-sm">
                                  <div className="flex items-center justify-between"><span className="text-zinc-500">Número Licencia</span><span className="text-white font-mono">{selectedSol.licencia_numero}</span></div>
                                  <div className="flex items-center justify-between"><span className="text-zinc-500">Categoría</span><span className="text-white">{selectedSol.licencia_categoria}</span></div>
                                  <div className="flex items-center justify-between"><span className="text-zinc-500">Vencimiento</span><span className="text-white">{selectedSol.licencia_vencimiento}</span></div>
                                  <hr className="border-zinc-800 my-2" />
                                  <div className="flex items-center justify-between"><span className="text-zinc-500">Vehículo</span><span className="text-white">{selectedSol.vehiculo}</span></div>
                                  <div className="flex items-center justify-between"><span className="text-zinc-500">Patente</span><span className="text-white bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 font-mono">{selectedSol.patente}</span></div>
                             </div>
                        </div>
                   </div>

                   <div className="flex-1 space-y-4">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Documentación Adjunta</h3>
                        {(!selectedSol.documentos || selectedSol.documentos.length === 0) ? (
                            <p className="text-zinc-500 text-sm italic">No se enviaron documentos adjuntos.</p>
                        ) : (
                            <div className="space-y-4">
                               {selectedSol.documentos.map((doc: any, i: number) => (
                                   <div key={i} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                                      <p className="text-xs font-bold text-zinc-400 capitalize mb-2">{doc.title.replace('_', ' ')}</p>
                                      {doc.url.toLowerCase().endsWith('.pdf') ? (
                                          <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-zinc-950 border border-zinc-800 py-3 rounded-lg text-blue-400 text-sm hover:border-blue-500/50 transition-colors">
                                              Ver Documento PDF
                                          </a>
                                      ) : (
                                          <a href={doc.url} target="_blank" rel="noreferrer" className="block w-full overflow-hidden rounded-lg border border-zinc-800 hover:border-blue-500/50 transition-colors">
                                              <img src={doc.url} alt={doc.title} className="w-full h-32 object-cover" />
                                          </a>
                                      )}
                                   </div>
                               ))}
                            </div>
                        )}
                   </div>
               </div>

               <div className="p-6 border-t border-zinc-800 bg-zinc-900 flex gap-3 mt-auto rounded-b-3xl">
                   <button disabled={processing} onClick={handleReject} className="flex-1 border border-red-500/30 text-red-500 hover:bg-red-500/10 py-3 rounded-xl font-bold flex flex-col items-center justify-center transition-colors">
                       Rechazar
                   </button>
                   <button disabled={processing} onClick={handleApprove} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 py-3 rounded-xl font-bold flex flex-col items-center justify-center transition-colors">
                       {processing ? <Loader2 className="animate-spin" size={20} /> : "Aprobar y Activar Cuenta"}
                   </button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
}
