import React, { useState, useEffect, useCallback } from 'react';
import { 
  Car, User, Phone, PlusCircle, Loader2, RefreshCw, 
  Search, CheckCircle2, XCircle, Hammer, FileText, MapPin 
} from 'lucide-react';
import MantenimientoTab from './titular/MantenimientoTab';
import TramitesTab from './titular/TramitesTab';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const token = () => localStorage.getItem('sb-access-token') ?? '';

interface FlotaAdminTabProps {
  onVehicleAction?: (v: any) => void;
}

export default function FlotaAdminTab({ onVehicleAction }: FlotaAdminTabProps) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [titulares, setTitulares] = useState<any[]>([]);
  const [choferes, setChoferes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newV, setNewV] = useState({ 
    titular_id: '', marca: '', modelo: '', patente: '', año: new Date().getFullYear() 
  });

  // Action states
  const [selectedV, setSelectedV] = useState<any | null>(null);
  const [subView, setSubView] = useState<'lista' | 'mantenimiento' | 'tramites' | 'asignar'>('lista');
  const [assigning, setAssigning] = useState(false);
  const [targetDriver, setTargetDriver] = useState('');

  const fetchFlota = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, titularsRes, driversRes] = await Promise.all([
        fetch(`${API}/vehicles/`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${API}/admin/usuarios/rol/titular`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${API}/admin/usuarios/rol/chofer`, { headers: { Authorization: `Bearer ${token()}` } })
      ]);

      if (vRes.ok) setVehicles(await vRes.json());
      if (titularsRes.ok) setTitulares(await titularsRes.json());
      if (driversRes.ok) setChoferes(await driversRes.json());

    } catch (e) {
      console.error(e);
      setError("Error al cargar datos de la flota");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlota(); }, [fetchFlota]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${API}/vehicles/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify(newV)
      });
      if (!res.ok) throw new Error("Error al crear vehículo");
      setShowCreate(false);
      setNewV({ titular_id: '', marca: '', modelo: '', patente: '', año: new Date().getFullYear() });
      fetchFlota();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedV) return;
    setAssigning(true);
    try {
      const res = await fetch(`${API}/vehicles/assign-driver`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify({
          vehicle_id: selectedV.id,
          driver_id: targetDriver || null
        })
      });
      if (!res.ok) throw new Error("Error al asignar chofer");
      setSubView('lista');
      fetchFlota();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAssigning(false);
    }
  };

  if (subView === 'mantenimiento' && selectedV) return (
    <div className="space-y-4">
      <button onClick={() => setSubView('lista')} className="text-zinc-400 hover:text-white flex items-center gap-2 text-sm">← Volver a Flota</button>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
        <h3 className="text-xl font-bold text-white mb-6">🔧 Mantenimiento: {selectedV.marca} {selectedV.modelo} ({selectedV.patente})</h3>
        <MantenimientoTab vehiculos={[{ id: selectedV.id, marca: selectedV.marca, modelo: selectedV.modelo, patente: selectedV.patente }]} />
      </div>
    </div>
  );

  if (subView === 'tramites' && selectedV) return (
    <div className="space-y-4">
      <button onClick={() => setSubView('lista')} className="text-zinc-400 hover:text-white flex items-center gap-2 text-sm">← Volver a Flota</button>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
        <h3 className="text-xl font-bold text-white mb-6">📄 Trámites y VTV: {selectedV.marca} {selectedV.modelo} ({selectedV.patente})</h3>
        <TramitesTab vehiculos={[{ id: selectedV.id, marca: selectedV.marca, modelo: selectedV.modelo, patente: selectedV.patente }]} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Gestión de Flota</h2>
          <p className="text-zinc-500 text-sm">Administrá todos los vehículos de la remisería.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchFlota} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20">
            <PlusCircle size={20} /> Alta Vehículo
          </button>
        </div>
      </div>

      {loading && vehicles.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 border-b border-zinc-800 text-[10px] uppercase font-black tracking-widest text-zinc-500">
              <tr>
                <th className="px-6 py-4">Vehículo</th>
                <th className="px-6 py-4">Patente</th>
                <th className="px-6 py-4">Titular</th>
                <th className="px-6 py-4">Chofer</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {vehicles.map(v => (
                <tr key={v.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 text-white">
                    <p className="font-bold">{v.marca} {v.modelo}</p>
                    <p className="text-xs text-zinc-500">{v.año}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-blue-400 font-bold">{v.patente}</td>
                  <td className="px-6 py-4 text-zinc-400">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-orange-400" />
                      {v.titular?.nombre || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {v.driver ? (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 size={14} /> {v.driver.nombre}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-zinc-600 italic text-sm">
                        <XCircle size={14} /> Sin chofer
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setSelectedV(v); setSubView('asignar'); setTargetDriver(v.driver_id || ''); }} 
                        className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                        title="Asignar Chofer"
                      >
                        <MapPin size={18} />
                      </button>
                      <button 
                        onClick={() => { setSelectedV(v); setSubView('mantenimiento'); }} 
                        className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all"
                        title="Mantenimiento"
                      >
                        <Hammer size={18} />
                      </button>
                      <button 
                        onClick={() => { setSelectedV(v); setSubView('tramites'); }} 
                        className="p-2 text-zinc-400 hover:text-teal-400 hover:bg-teal-400/10 rounded-lg transition-all"
                        title="Documentos"
                      >
                        <FileText size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vehicles.length === 0 && (
            <div className="text-center py-20 text-zinc-600">
              <Car size={60} className="mx-auto mb-4 opacity-10" />
              <p>No hay vehículos registrados.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal: Alta Vehículo */}
      {showCreate && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full relative shadow-2xl">
            <button onClick={() => setShowCreate(false)} className="absolute right-6 top-6 text-zinc-500 hover:text-white">✕</button>
            <h3 className="text-2xl text-white font-black mb-6">Registrar Vehículo</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-black tracking-widest">A quién pertenece? (Titular)</label>
                <select 
                  required 
                  value={newV.titular_id} 
                  onChange={e => setNewV({...newV, titular_id: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all font-medium"
                >
                  <option value="">Seleccionar Titular...</option>
                  {titulares.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.email})</option>)}
                </select>
                {titulares.length === 0 && <p className="text-[10px] text-orange-500 mt-1">⚠️ Primero debés crear un titular en la pestaña correspondinte.</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-black tracking-widest">Marca</label>
                  <input required placeholder="Ej: Chevrolet" value={newV.marca} onChange={e => setNewV({...newV, marca: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-black tracking-widest">Modelo</label>
                  <input required placeholder="Ej: Onix" value={newV.modelo} onChange={e => setNewV({...newV, modelo: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-black tracking-widest">Patente</label>
                  <input required placeholder="ABC 123" value={newV.patente} onChange={e => setNewV({...newV, patente: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all uppercase" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-black tracking-widest">Año</label>
                  <input type="number" required value={newV.año} onChange={e => setNewV({...newV, año: parseInt(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>
              <button type="submit" disabled={creating} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all uppercase tracking-widest text-sm mt-4">
                {creating ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Crear Vehículo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Asignar Chofer */}
      {subView === 'asignar' && selectedV && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full relative shadow-2xl">
            <button onClick={() => setSubView('lista')} className="absolute right-6 top-6 text-zinc-500 hover:text-white">✕</button>
            <h3 className="text-xl text-white font-black mb-1">Asignar Chofer</h3>
            <p className="text-zinc-500 text-sm mb-6">{selectedV.marca} {selectedV.modelo} - {selectedV.patente}</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 mb-1 block uppercase font-black tracking-widest">Seleccionar Chofer</label>
                <select 
                  value={targetDriver} 
                  onChange={e => setTargetDriver(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">(Sin Chofer)</option>
                  {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>)}
                </select>
              </div>
              <button onClick={handleAssign} disabled={assigning} className="w-full bg-blue-600 text-white font-black py-3.5 rounded-xl disabled:opacity-50 uppercase tracking-widest text-xs">
                {assigning ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Actualizar Asignación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
