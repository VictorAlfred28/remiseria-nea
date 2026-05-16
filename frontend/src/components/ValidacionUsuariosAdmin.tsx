import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Check, X, User, Car, Store, AlertCircle, Loader2 } from 'lucide-react';

interface PendingUser {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: string;
  creado_en: string;
}

export default function ValidacionUsuariosAdmin() {
  const [usuarios, setUsuarios] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/usuarios/pendientes');
      setUsuarios(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al obtener usuarios pendientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleAction = async (id: string, action: 'aprobar' | 'rechazar') => {
    try {
      setActionLoading(id);
      await api.post(`/admin/usuarios/${id}/${action}`);
      setUsuarios(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || `Error al ${action} el usuario`);
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleIcon = (rol: string) => {
    switch (rol) {
      case 'chofer': return <Car size={16} className="text-blue-400" />;
      case 'comercio': return <Store size={16} className="text-purple-400" />;
      default: return <User size={16} className="text-green-400" />;
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Validación de Usuarios</h2>
          <p className="text-zinc-400 text-sm">Aprueba o rechaza nuevos registros en la plataforma.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {usuarios.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
          <User size={48} className="text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No hay usuarios pendientes de aprobación.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-950/50 border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Fecha Solicitud</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{u.nombre}</p>
                    <p className="text-zinc-500 text-xs">{u.id.substring(0, 8)}...</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    <p>{u.email}</p>
                    <p className="text-xs text-zinc-500">{u.telefono || 'Sin teléfono'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(u.rol)}
                      <span className="capitalize text-zinc-300">{u.rol}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(u.creado_en).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAction(u.id, 'aprobar')}
                        disabled={actionLoading === u.id}
                        className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                        title="Aprobar Usuario"
                      >
                        {actionLoading === u.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      </button>
                      <button
                        onClick={() => handleAction(u.id, 'rechazar')}
                        disabled={actionLoading === u.id}
                        className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                        title="Rechazar Usuario"
                      >
                        {actionLoading === u.id ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
