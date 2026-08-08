import React, { useState, useEffect } from "react";
import { Wrench, PlusCircle, AlertTriangle, CheckCircle, Loader2, Car, Trash2, Calendar } from "lucide-react";
import { api } from "../../services/api";

interface Vehicle {
  id: string;
  marca: string;
  modelo: string;
  patente: string;
  kilometraje_actual?: number;
}

interface Mantenimiento {
  id: string;
  vehiculo_id: string;
  tipo_mantenimiento: string;
  kilometraje?: number;
  fecha: string;
  descripcion?: string;
  costo: number;
  estado: string;
  vehiculo?: Vehicle;
}

const TIPOS_MTO = [
  "Cambio de Aceite",
  "Rotación de Neumáticos",
  "Cambio de Correa",
  "Cambio de Frenos",
  "Revisión General",
  "Cambio de Filtros",
  "Alineación / Balanceo",
  "Otro",
];

export default function MantenimientoTab({ vehiculos }: { vehiculos: Vehicle[] }) {
  const [registros, setRegistros] = useState<Mantenimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");

  // Form
  const [vehiculoId, setVehiculoId] = useState(vehiculos[0]?.id || "");
  const [tipo, setTipo] = useState("Cambio de Aceite");
  const [km, setKm] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [desc, setDesc] = useState("");
  const [costo, setCosto] = useState("");
  const [estado, setEstado] = useState("completado");

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const res = await api.get("/mantenimientos");
      setRegistros(res.data || []);
    } catch {
      console.error("Error cargando mantenimientos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRegistros(); }, []);
  useEffect(() => { if (vehiculos[0]) setVehiculoId(vehiculos[0].id); }, [vehiculos]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    try {
      await api.post("/mantenimientos", {
        vehiculo_id: vehiculoId,
        tipo_mantenimiento: tipo,
        kilometraje: km ? parseInt(km) : null,
        fecha,
        descripcion: desc,
        costo: parseFloat(costo) || 0,
        estado,
      });
      setFeedbackType("success");
      setFeedback("Mantenimiento registrado correctamente.");
      setShowForm(false);
      fetchRegistros();
    } catch {
      setFeedbackType("error");
      setFeedback("Error al registrar mantenimiento.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    await api.delete(`/mantenimientos/${id}`);
  };

  // Agrupar por vehículo
  const byVehicle: Record<string, Mantenimiento[]> = {};
  registros.forEach(r => {
    const vid = r.vehiculo_id;
    if (!byVehicle[vid]) byVehicle[vid] = [];
    byVehicle[vid].push(r);
  });

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
            <Wrench className="text-blue-600" size={22} /> Control Preventivo de Flota
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">Historial de servicios y mantenimientos por vehículo.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow hover:bg-blue-700 transition-all flex items-center gap-2">
          <PlusCircle size={16} /> Registrar
        </button>
      </div>

      {feedback && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold border ${feedbackType === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
          {feedback}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h3 className="text-base font-bold text-zinc-700 mb-4">Nuevo Registro de Mantenimiento</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Vehículo</label>
              <select required className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-blue-500 outline-none bg-white"
                value={vehiculoId} onChange={e => setVehiculoId(e.target.value)}>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} - {v.patente}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Tipo de Mantenimiento</label>
              <select required className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-blue-500 outline-none bg-white"
                value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS_MTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Fecha</label>
              <input required type="date" className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-blue-500 outline-none"
                value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Kilometraje actual</label>
              <input type="number" placeholder="98000" className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-blue-500 outline-none"
                value={km} onChange={e => setKm(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Costo ($)</label>
              <input type="number" step="0.01" placeholder="0.00" className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-blue-500 outline-none"
                value={costo} onChange={e => setCosto(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Descripción / Observaciones</label>
              <input className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-blue-500 outline-none"
                placeholder="Ej: Se cambió aceite 10W40 + filtro."
                value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Estado</label>
              <select className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-blue-500 outline-none bg-white"
                value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="completado">Completado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3 mt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 font-semibold transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={creating}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
                {creating ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />} Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Listado por vehículo */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-500" size={28} />
        </div>
      ) : Object.keys(byVehicle).length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-zinc-200 rounded-2xl">
          <Wrench size={40} className="mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-400 font-semibold text-sm">No hay registros de mantenimiento todavía.</p>
        </div>
      ) : (
        vehiculos
          .filter(v => byVehicle[v.id])
          .map(v => (
            <div key={v.id} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Car className="text-blue-600" size={18} />
                  </div>
                  <div>
                    <h4 className="text-zinc-800 font-bold">{v.marca} {v.modelo}</h4>
                    <span className="text-zinc-500 text-xs font-semibold">({v.patente})</span>
                  </div>
                </div>
                {v.kilometraje_actual && (
                  <span className="text-zinc-500 text-xs font-semibold">{v.kilometraje_actual?.toLocaleString()} km actuales</span>
                )}
              </div>

              <div className="space-y-2">
                {byVehicle[v.id].map(mto => {
                  const vencido = mto.estado === "pendiente";
                  return (
                    <div key={mto.id} className={`flex items-center justify-between p-3 rounded-xl border ${vencido ? "border-red-200 bg-red-50" : "border-zinc-100 bg-zinc-50"}`}>
                      <div>
                        <p className="text-zinc-700 text-sm font-semibold">{mto.tipo_mantenimiento}</p>
                        <p className="text-zinc-400 text-xs flex items-center gap-1 mt-0.5">
                          <Calendar size={10} /> {mto.fecha} {mto.kilometraje ? `· ${mto.kilometraje.toLocaleString()} km` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {vencido && <AlertTriangle size={14} className="text-red-500" />}
                        <span className={`text-xs font-bold ${vencido ? "text-red-500" : "text-emerald-600"}`}>
                          {vencido ? "Pendiente" : "✓ Completado"}
                        </span>
                        {mto.costo > 0 && <span className="text-zinc-600 text-xs font-semibold">${mto.costo.toLocaleString()}</span>}
                        <button onClick={() => handleDelete(mto.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
      )}
    </div>
  );
}
