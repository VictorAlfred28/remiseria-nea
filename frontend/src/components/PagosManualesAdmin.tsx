import { useState, useEffect } from "react";
import { getPagosAdmin, approvePagoAdmin, rejectPagoAdmin } from "../services/api";
import { Loader2, CheckCircle2, XCircle, Search, Clock, CreditCard } from "lucide-react";

export default function PagosManualesAdmin() {
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("PENDIENTE");

  const fetchPagos = async () => {
    setLoading(true);
    try {
      const data = await getPagosAdmin();
      setPagos(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPagos();
  }, []);

  const handleApprove = async (id: string, choferId: string) => {
    if (!window.confirm("¿Confirmas la recepción de la transferencia y deseas aprobar este pago? El saldo del chofer se actualizará en Billetera automáticamente.")) return;
    try {
      await approvePagoAdmin(id);
      alert("Pago aprobado exitosamente.");
      fetchPagos();
    } catch (err: any) {
      alert("Error al aprobar: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleReject = async (id: string) => {
    const motivo = window.prompt("Ingresa el motivo del rechazo del comprobante (ej: Comprobante ilegible, Monto no coincide, Transferencia no recibida):");
    if (!motivo) return;
    try {
      await rejectPagoAdmin(id, motivo);
      alert("Pago rechazado exitosamente.");
      fetchPagos();
    } catch (err: any) {
      alert("Error al rechazar: " + (err.response?.data?.detail || err.message));
    }
  };

  const filteredPagos = pagos.filter(p => p.estado === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <CreditCard size={24} className="text-blue-500" /> Validación de Pagos y Transferencias
          </h2>
          <p className="text-zinc-400 text-sm">Gestiona los comprobantes de pagos y transferencias enviados por los choferes.</p>
        </div>
        
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 overflow-hidden">
            <button 
                onClick={() => setFilter('PENDIENTE')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'PENDIENTE' ? 'bg-yellow-500/20 text-yellow-500' : 'text-zinc-500 hover:text-white'}`}
            >
                Pendientes
            </button>
            <button 
                onClick={() => setFilter('APROBADO')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'APROBADO' ? 'bg-green-500/20 text-green-500' : 'text-zinc-500 hover:text-white'}`}
            >
                Aprobados
            </button>
            <button 
                onClick={() => setFilter('RECHAZADO')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'RECHAZADO' ? 'bg-red-500/20 text-red-500' : 'text-zinc-500 hover:text-white'}`}
            >
                Rechazados
            </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-blue-500" size={32}/>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPagos.length === 0 ? (
                <div className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center p-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-2xl">
                    <Search className="text-zinc-600 mb-4" size={48} />
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No hay comprobantes en este estado</p>
                </div>
            ) : filteredPagos.map((p) => {
                const isPendiente = p.estado === 'PENDIENTE';
                return (
                    <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors shadow-lg">
                        <div className="p-5 border-b border-zinc-800/50">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-white text-lg">{p.chofer?.usuarios?.nombre || "Chofer Desconocido"}</h3>
                                    <p className="text-xs text-zinc-500">{p.chofer?.vehiculo} - {p.chofer?.patente}</p>
                                </div>
                                <span className={`px-3 py-1 rounded text-[10px] font-black uppercase ${
                                    isPendiente ? 'bg-yellow-500/20 text-yellow-500' : 
                                    p.estado === 'APROBADO' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                                }`}>
                                    {p.estado}
                                </span>
                            </div>
                            
                            <div className="flex items-end justify-between">
                                <div>
                                    <span className="text-xs text-zinc-500 block uppercase font-bold tracking-widest mb-1">Monto Avisado</span>
                                    <span className="text-2xl font-black text-white">${Number(p.monto).toLocaleString('es-AR')}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-zinc-500 flex items-center gap-1 justify-end"><Clock size={12}/> Fecha y Hora</span>
                                    <span className="text-sm font-bold text-zinc-300">{new Date(p.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short'})}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-5 flex flex-col gap-4">
                            <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                                <Search size={18} /> Ver Comprobante
                            </a>
                            
                            {isPendiente && (
                                <div className="grid grid-cols-2 gap-3 mt-2 pt-4 border-t border-zinc-800/50">
                                    <button onClick={() => handleApprove(p.id, p.chofer_id)} className="bg-green-600/20 hover:bg-green-600 border border-green-600/30 text-green-500 hover:text-white py-3 leading-none rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                                        <CheckCircle2 size={18} /> Aprobar
                                    </button>
                                    <button onClick={() => handleReject(p.id)} className="bg-red-600/20 hover:bg-red-600 border border-red-600/30 text-red-500 hover:text-white py-3 leading-none rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                                        <XCircle size={18} /> Rechazar
                                    </button>
                                </div>
                            )}

                            {p.estado === 'APROBADO' && p.admin_id && (
                                <div className="text-xs text-green-500 bg-green-500/5 border border-green-500/10 p-3 rounded-lg flex items-center gap-2">
                                    <CheckCircle2 size={14} /> Validado y Acreditado en Saldo
                                </div>
                            )}

                            {p.estado === 'RECHAZADO' && p.observaciones && (
                                <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 p-3 rounded-lg flex items-start gap-2">
                                    <XCircle size={14} className="mt-0.5 flex-shrink-0" /> 
                                    <div>
                                        <span className="font-bold block">Motivo Rechazo:</span>
                                        {p.observaciones}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      )}
    </div>
  );
}
