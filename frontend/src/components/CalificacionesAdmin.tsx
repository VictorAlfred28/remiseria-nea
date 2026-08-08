import { useState, useEffect } from 'react';
import { Star, ThumbsUp, Loader2, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function CalificacionesAdmin() {
  const { orgId } = useAuthStore();
  const [calificaciones, setCalificaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'recomendadas'>('todas');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCalificaciones = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('calificaciones')
        .select(`
          id,
          puntuacion,
          comentario,
          recomendado,
          created_at,
          viaje_id,
          pasajero:usuarios!calificaciones_pasajero_id_fkey(nombre, apellido),
          chofer:choferes!calificaciones_chofer_id_fkey(vehiculo, patente, usuarios(nombre, apellido))
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filtro === 'recomendadas') {
        query = query.eq('recomendado', true);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching calificaciones:', error);
        // Fallback: try simpler query without FK hints
        const { data: fallbackData } = await supabase
          .from('calificaciones')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (fallbackData) setCalificaciones(fallbackData);
      } else {
        setCalificaciones(data || []);
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalificaciones();
  }, [orgId, filtro]);

  const totalCalificaciones = calificaciones.length;
  const totalRecomendadas = calificaciones.filter(c => c.recomendado).length;
  const promedioGeneral = totalCalificaciones > 0
    ? (calificaciones.reduce((acc, c) => acc + c.puntuacion, 0) / totalCalificaciones).toFixed(1)
    : '0.0';

  const filteredCalificaciones = calificaciones.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const pasajeroNombre = c.pasajero?.nombre || c.pasajero_id || '';
    const choferNombre = c.chofer?.usuarios?.nombre || c.chofer_id || '';
    const comentario = c.comentario || '';
    return pasajeroNombre.toLowerCase().includes(term)
      || choferNombre.toLowerCase().includes(term)
      || comentario.toLowerCase().includes(term);
  });

  const renderStars = (puntuacion: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <Star
            key={s}
            size={14}
            className={s <= puntuacion ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-950/20 border-2 border-blue-900/50 p-4 sm:p-6 rounded-2xl">
          <p className="text-xs text-blue-500 font-bold mb-1">TOTAL CALIFICACIONES</p>
          <h3 className="text-2xl sm:text-3xl font-black text-blue-400">{totalCalificaciones}</h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl">
          <p className="text-xs text-zinc-500 font-bold mb-1">PROMEDIO GENERAL</p>
          <h3 className="text-2xl font-black text-amber-400 flex items-center gap-2">
            {promedioGeneral} <Star size={20} className="fill-amber-400 text-amber-400" />
          </h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl">
          <p className="text-xs text-zinc-500 font-bold mb-1">TOTAL RECOMENDACIONES</p>
          <h3 className="text-2xl font-black text-emerald-400 flex items-center gap-2">
            {totalRecomendadas} <ThumbsUp size={20} />
          </h3>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setFiltro('todas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              filtro === 'todas'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFiltro('recomendadas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              filtro === 'recomendadas'
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ThumbsUp size={14} /> Recomendadas
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o comentario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : filteredCalificaciones.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Star size={40} className="mx-auto mb-3 text-zinc-700" />
          <p className="font-medium">No hay calificaciones para mostrar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-zinc-900/50 border border-zinc-800 shadow-xl">
          <table className="w-full text-left text-sm" style={{ minWidth: '700px' }}>
            <thead className="bg-zinc-900 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-4 sm:px-6 py-4">Fecha</th>
                <th className="px-4 sm:px-6 py-4">Pasajero</th>
                <th className="px-4 sm:px-6 py-4">Chofer</th>
                <th className="px-4 sm:px-6 py-4">Calificación</th>
                <th className="px-4 sm:px-6 py-4">Comentario</th>
                <th className="px-4 sm:px-6 py-4 text-center">Recomendado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredCalificaciones.map(c => (
                <tr key={c.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 sm:px-6 py-4 text-zinc-400 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString('es-AR', {
                      day: '2-digit', month: '2-digit', year: '2-digit'
                    })}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-white font-medium">
                    {c.pasajero?.nombre
                      ? `${c.pasajero.nombre} ${c.pasajero.apellido || ''}`
                      : <span className="text-zinc-600 text-xs">{String(c.pasajero_id).substring(0, 8)}...</span>
                    }
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <div>
                      <p className="text-white font-medium">
                        {c.chofer?.usuarios?.nombre
                          ? `${c.chofer.usuarios.nombre} ${c.chofer.usuarios.apellido || ''}`
                          : <span className="text-zinc-600 text-xs">{String(c.chofer_id).substring(0, 8)}...</span>
                        }
                      </p>
                      {c.chofer?.vehiculo && (
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {c.chofer.vehiculo} {c.chofer.patente ? `[${c.chofer.patente}]` : ''}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4">{renderStars(c.puntuacion)}</td>
                  <td className="px-4 sm:px-6 py-4 text-zinc-400 text-xs max-w-[200px] truncate">
                    {c.comentario || <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center">
                    {c.recomendado ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-bold uppercase border border-emerald-500/20">
                        <ThumbsUp size={10} /> Sí
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-xs">—</span>
                    )}
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
