/**
 * MiFlotaTab — Panel del Titular
 * Integrado en ClienteDashboard cuando roles.includes('titular').
 * Muestra: lista de vehículos → detalle → GPS del chofer → historial de viajes.
 * NO crea rutas nuevas, NO duplica paneles.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Car, MapPin, History, ChevronRight, ArrowLeft,
  User, Phone, CheckCircle2, XCircle, Loader2, Truck,
  Navigation, RefreshCw, Briefcase, PlusCircle
} from 'lucide-react';
import BolsaTitularTab from '../bolsa/BolsaTitularTab';
import MantenimientoTab from '../titular/MantenimientoTab';
import TramitesTab from '../titular/TramitesTab';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const token = () => sessionStorage.getItem('sb-access-token') ?? '';

const apiFetch = (path: string) =>
  fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });

// ─── Types ───────────────────────────────────────────────────────────────────
interface Driver { id: string; nombre: string; telefono?: string }
interface Vehicle {
  id: string; marca: string; modelo: string; año: number | null;
  patente: string; estado: string;
  driver: Driver | null;
}
interface Viaje {
  id: string; estado: string; creado_en: string;
  origen: any; destino: any; precio: number; final_price?: number;
}
interface GPS { lat: number | null; lng: number | null; disponible: boolean; estado_chofer?: string }

// ─── Sub-screens ──────────────────────────────────────────────────────────────
type Screen = 'lista' | 'detalle' | 'ubicacion' | 'historial' | 'bolsa' | 'mantenimiento' | 'tramites';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    activo:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    inactivo: 'bg-zinc-700 text-zinc-400 border-zinc-600',
  };
  return map[estado] ?? 'bg-zinc-700 text-zinc-400 border-zinc-600';
};

const formatEstado = (e: string) => ({
  REQUESTED: 'Buscando chofer', ACCEPTED: 'Chofer en camino',
  ARRIVED: 'Llegó al punto', STARTED: 'En viaje',
  FINISHED: 'Finalizado', CANCELLED: 'Cancelado',
  solicitado: 'Solicitado', asignado: 'Asignado',
  finalizado: 'Finalizado', cancelado: 'Cancelado',
}[e] ?? e);

// ─── Component ────────────────────────────────────────────────────────────────
export default function MiFlotaTab() {
  const [screen, setScreen]       = useState<Screen>('lista');
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [selected, setSelected]   = useState<Vehicle | null>(null);
  const [trips, setTrips]         = useState<Viaje[]>([]);
  const [gps, setGps]             = useState<GPS | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Cargar flota ────────────────────────────────────────────────────────────
  const loadVehicles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch('/vehicles/my');
      if (!res.ok) throw new Error('No se pudo cargar la flota.');
      setVehicles(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  // ── Cargar historial ────────────────────────────────────────────────────────
  const loadTrips = useCallback(async (vehicleId: string) => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch(`/vehicles/${vehicleId}/trips`);
      if (!res.ok) throw new Error('No se pudo cargar el historial.');
      const data = await res.json();
      setTrips(Array.isArray(data.viajes) ? data.viajes : []);
    } catch (e: any) {
      setError(e.message); setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Cargar GPS ──────────────────────────────────────────────────────────────
  const loadGps = useCallback(async (vehicleId: string) => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch(`/vehicles/${vehicleId}`);
      if (!res.ok) throw new Error('No se pudo cargar la ubicación.');
      const data = await res.json();
      // El backend retorna ubicacion_actual: { lat, lng, estado_chofer }
      // pero SIN el campo `disponible`. Lo calculamos acá.
      const raw = data.ubicacion_actual;
      if (raw) {
        setGps({
          lat: raw.lat ?? null,
          lng: raw.lng ?? null,
          disponible: raw.lat !== null && raw.lat !== undefined
                   && raw.lng !== null && raw.lng !== undefined,
          estado_chofer: raw.estado_chofer,
        });
      } else {
        setGps({ lat: null, lng: null, disponible: false });
      }
    } catch (e: any) {
      setError(e.message); setGps(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Navegación ──────────────────────────────────────────────────────────────
  const goTo = (s: Screen, v?: Vehicle) => {
    if (v) setSelected(v);
    if (s === 'historial' && v) loadTrips(v.id);
    if (s === 'ubicacion' && v) loadGps(v.id);
    setScreen(s);
  };
  const goBack = () => { setScreen(selected ? 'detalle' : 'lista'); };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: LISTA
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'lista') return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Truck className="text-blue-400" size={20} /> Mi Flota
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setScreen('bolsa')}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all shadow-lg"
          >
            <Briefcase size={12} /> Bolsa
          </button>
          <button
            onClick={loadVehicles}
          disabled={loading}
          className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all"
          title="Actualizar"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {loading && !vehicles.length && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-400" size={32} />
        </div>
      )}

      {!loading && !error && vehicles.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <Car size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No tenés vehículos asignados aún.</p>
          <p className="text-xs mt-1 text-zinc-600">Contactá al administrador para que registre tu flota.</p>
        </div>
      )}

      {vehicles.map(v => (
        <button
          key={v.id}
          onClick={() => goTo('detalle', v)}
          className="w-full text-left bg-zinc-900/50 border border-white/5 rounded-2xl p-4 hover:border-blue-500/30 hover:bg-zinc-900/80 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-2.5 rounded-xl">
                <Car size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-white group-hover:text-blue-300 transition-colors">
                  {v.marca} {v.modelo}
                  {v.año ? <span className="text-zinc-500 font-normal text-sm ml-1">({v.año})</span> : null}
                </p>
                <p className="text-zinc-400 text-sm font-mono tracking-wider">{v.patente}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 border rounded-full font-medium ${estadoBadge(v.estado)}`}>
                {v.estado}
              </span>
              <ChevronRight size={16} className="text-zinc-600 group-hover:text-blue-400 transition-colors" />
            </div>
          </div>

          {/* Chofer asignado */}
          <div className="mt-3 ml-12">
            {v.driver ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <User size={13} className="text-emerald-400" />
                <span className="text-emerald-400">{v.driver.nombre}</span>
                {v.driver.telefono && (
                  <span className="text-zinc-600">· {v.driver.telefono}</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 italic">Sin chofer asignado</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: DETALLE
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'detalle' && selected) return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Back */}
      <button onClick={() => setScreen('lista')} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
        <ArrowLeft size={16} /> Volver a la flota
      </button>

      {/* Header vehículo */}
      <div className="bg-gradient-to-br from-blue-900/30 to-zinc-900/50 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-blue-600/20 p-3 rounded-xl">
            <Car size={28} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{selected.marca} {selected.modelo}</h2>
            <p className="text-zinc-400 font-mono tracking-wider">{selected.patente}</p>
          </div>
          <span className={`ml-auto text-xs px-2.5 py-1 border rounded-full font-medium ${estadoBadge(selected.estado)}`}>
            {selected.estado}
          </span>
        </div>

        {/* Chofer */}
        <div className="bg-black/20 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-2">Chofer Asignado</p>
          {selected.driver ? (
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2 rounded-lg">
                <User size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">{selected.driver.nombre}</p>
                {selected.driver.telefono && (
                  <div className="flex items-center gap-1 text-zinc-400 text-sm">
                    <Phone size={12} />
                    <span>{selected.driver.telefono}</span>
                  </div>
                )}
              </div>
              <CheckCircle2 className="ml-auto text-emerald-500" size={18} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-zinc-500">
                <XCircle size={16} />
                <span className="text-sm italic">Sin chofer asignado.</span>
              </div>
              <button 
                onClick={() => setScreen('bolsa')}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
              >
                <PlusCircle size={14} /> Publicar Vacante
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => goTo('ubicacion', selected)}
          disabled={!selected.driver}
          className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-500/30 hover:bg-zinc-900/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="bg-blue-600/20 p-2.5 rounded-lg group-hover:bg-blue-600/30 transition-colors">
            <MapPin size={20} className="text-blue-400" />
          </div>
          <span className="text-sm font-medium text-zinc-300">Ver ubicación</span>
          {!selected.driver && <span className="text-[10px] text-zinc-600">Requiere chofer asignado</span>}
        </button>

        <button
          onClick={() => goTo('historial', selected)}
          disabled={!selected.driver}
          className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-purple-500/30 hover:bg-zinc-900/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="bg-purple-600/20 p-2.5 rounded-lg group-hover:bg-purple-600/30 transition-colors">
            <History size={20} className="text-purple-400" />
          </div>
          <span className="text-sm font-medium text-zinc-300">Historial viajes</span>
          {!selected.driver && <span className="text-[10px] text-zinc-600">Requiere chofer asignado</span>}
        </button>

        <button
          onClick={() => setScreen('mantenimiento')}
          className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-500/30 hover:bg-zinc-900/80 transition-all group"
        >
          <div className="bg-blue-600/20 p-2.5 rounded-lg group-hover:bg-blue-600/30 transition-colors">
            <span className="text-xl">🔧</span>
          </div>
          <span className="text-sm font-medium text-zinc-300">Mantenimiento</span>
        </button>

        <button
          onClick={() => setScreen('tramites')}
          className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-teal-500/30 hover:bg-zinc-900/80 transition-all group"
        >
          <div className="bg-teal-600/20 p-2.5 rounded-lg group-hover:bg-teal-600/30 transition-colors">
            <span className="text-xl">📄</span>
          </div>
          <span className="text-sm font-medium text-zinc-300">Trámites / VTV</span>
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: UBICACIÓN GPS
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'ubicacion' && selected) return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={goBack} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
        <ArrowLeft size={16} /> Volver al vehículo
      </button>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">
          <Navigation className="text-blue-400" size={18} />
          Ubicación — {selected.marca} {selected.modelo}
        </h3>
        <p className="text-zinc-500 text-xs mb-5">
          Muestra la última posición GPS registrada por el chofer.
        </p>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-blue-400" size={28} />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {!loading && gps && (
          <>
            {gps.disponible ? (
              <div className="space-y-4">
                {/* Mapa embebido via OpenStreetMap iframe — sin API key, sin duplicar tracking */}
                <div className="rounded-xl overflow-hidden border border-white/10 aspect-video">
                  <iframe
                    title="Ubicación del chofer"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${(gps.lng! - 0.01).toFixed(5)},${(gps.lat! - 0.01).toFixed(5)},${(gps.lng! + 0.01).toFixed(5)},${(gps.lat! + 0.01).toFixed(5)}&layer=mapnik&marker=${gps.lat},${gps.lng}`}
                    className="w-full h-full"
                    style={{ border: 0 }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Latitud</p>
                    <p className="font-mono text-white font-bold">{gps.lat?.toFixed(5)}</p>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Longitud</p>
                    <p className="font-mono text-white font-bold">{gps.lng?.toFixed(5)}</p>
                  </div>
                </div>

                {gps.estado_chofer && (
                  <p className="text-center text-sm text-zinc-400">
                    Estado del chofer: <span className="text-white font-medium">{gps.estado_chofer}</span>
                  </p>
                )}

                <button
                  onClick={() => loadGps(selected.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-sm font-medium transition-all"
                >
                  <RefreshCw size={14} /> Actualizar ubicación
                </button>
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-500">
                <MapPin size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">El chofer no ha compartido su ubicación todavía.</p>
                <p className="text-xs mt-1 text-zinc-600">La posición se actualiza cuando el chofer activa el panel.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: HISTORIAL DE VIAJES
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'historial' && selected) return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={goBack} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
        <ArrowLeft size={16} /> Volver al vehículo
      </button>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">
          <History className="text-purple-400" size={18} />
          Historial — {selected.patente}
        </h3>
        <p className="text-zinc-500 text-xs mb-5">
          Últimos 50 viajes del chofer asignado a este vehículo.
        </p>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-purple-400" size={28} />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {!loading && !error && trips.length === 0 && (
          <div className="text-center py-10 text-zinc-500">
            <History size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay viajes registrados para este vehículo.</p>
          </div>
        )}

        <div className="space-y-3">
          {trips.map(v => (
            <div key={v.id} className="bg-black/20 border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-[10px] px-2 py-0.5 border rounded-full font-bold uppercase tracking-wide ${
                  v.estado === 'FINISHED' || v.estado === 'finalizado'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : v.estado === 'CANCELLED' || v.estado === 'cancelado'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {formatEstado(v.estado)}
                </span>
                <span className="text-xs text-zinc-500">
                  {new Date(v.creado_en).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' })}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-start gap-2 text-zinc-300">
                  <MapPin size={12} className="text-rose-400 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{v.origen?.direccion ?? '—'}</span>
                </div>
                <div className="flex items-start gap-2 text-zinc-300">
                  <Navigation size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-1">{v.destino?.direccion ?? '—'}</span>
                </div>
              </div>

              {(v.final_price ?? v.precio) ? (
                <p className="text-right text-emerald-400 font-bold text-sm mt-2">
                  ${Number(v.final_price ?? v.precio).toLocaleString('es-AR')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (screen === 'mantenimiento') return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={goBack} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
        <ArrowLeft size={16} /> Volver al vehículo
      </button>
      <MantenimientoTab vehiculos={vehicles.map(v => ({ id: v.id, marca: v.marca, modelo: v.modelo, patente: v.patente }))} />
    </div>
  );

  if (screen === 'tramites') return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={goBack} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
        <ArrowLeft size={16} /> Volver al vehículo
      </button>
      <TramitesTab vehiculos={vehicles.map(v => ({ id: v.id, marca: v.marca, modelo: v.modelo, patente: v.patente }))} />
    </div>
  );

  if (screen === 'bolsa') return (
    <BolsaTitularTab 
      vehicleId={selected?.id} 
      onBack={() => setScreen(selected ? 'detalle' : 'lista')} 
    />
  );

  return null;
}
