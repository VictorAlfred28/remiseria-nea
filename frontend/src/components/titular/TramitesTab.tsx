import React, { useState, useEffect, useRef } from "react";
import { FileText, Upload, PlusCircle, AlertTriangle, CheckCircle, Loader2, Users, Car, Calendar, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { api } from "../../services/api";

interface Tramite {
  id: string;
  tipo_tramite: string;
  fecha_emision?: string;
  fecha_vencimiento: string;
  archivo_url?: string;
  estado: string;
  vehiculo_id?: string;
  chofer_id?: string;
  vehiculo?: { marca: string; modelo: string; patente: string };
}

interface Vehicle {
  id: string;
  marca: string;
  modelo: string;
  patente: string;
}

const TIPOS_TRAMITE = [
  { value: "seguro", label: "Seguro del Vehículo", icon: "🛡️" },
  { value: "vtv", label: "VTV / Revisión Técnica", icon: "🔧" },
  { value: "licencia", label: "Licencia de Conducir", icon: "🪪" },
  { value: "cedula", label: "Cédula Verde / Azul", icon: "📄" },
  { value: "habilitacion", label: "Habilitación Remis", icon: "🏢" },
  { value: "otro", label: "Otro Documento", icon: "📎" },
];

function getDaysUntilExpiry(fecha: string): number {
  const today = new Date();
  const expiry = new Date(fecha);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function TramitesTab({ vehiculos, choferId }: { vehiculos?: Vehicle[]; choferId?: string }) {
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form
  const [tipo, setTipo] = useState("seguro");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVenc, setFechaVenc] = useState("");
  const [vehiculoId, setVehiculoId] = useState(vehiculos?.[0]?.id || "");
  const [archivoUrl, setArchivoUrl] = useState("");
  const [fileName, setFileName] = useState("");

  const fetchTramites = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tramites");
      setTramites(res.data || []);
    } catch {
      console.error("Error cargando trámites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTramites(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `tramites/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage
        .from("tramites_vehiculares")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("tramites_vehiculares")
        .getPublicUrl(path);

      setArchivoUrl(urlData.publicUrl);
      setFileName(file.name);
    } catch {
      setFeedback({ type: "error", msg: "Error al subir el archivo. Revisá el tamaño o formato." });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaVenc) { setFeedback({ type: "error", msg: "La fecha de vencimiento es obligatoria." }); return; }
    setCreating(true);
    setFeedback(null);
    try {
      await api.post("/tramites", {
        tipo_tramite: tipo,
        fecha_emision: fechaEmision || null,
        fecha_vencimiento: fechaVenc,
        archivo_url: archivoUrl || null,
        vehiculo_id: vehiculoId || null,
        chofer_id: choferId || null,
        estado: "vigente",
      });
      setFeedback({ type: "success", msg: "Trámite registrado exitosamente." });
      setShowForm(false);
      setArchivoUrl("");
      setFileName("");
      fetchTramites();
    } catch {
      setFeedback({ type: "error", msg: "Error al guardar el trámite." });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este trámite?")) return;
    await api.delete(`/tramites/${id}`);
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
            <FileText className="text-teal-600" size={22} /> Gestión de Habilitaciones
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">Control de vencimientos y documentación oficial.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold shadow hover:bg-teal-700 transition-all flex items-center gap-2">
          <PlusCircle size={16} /> Nuevo Trámite
        </button>
      </div>

      {feedback && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold border ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
          {feedback.msg}
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h3 className="text-base font-bold text-zinc-700 mb-5">Registrar Documento / Trámite</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Tipo de Trámite</label>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_TRAMITE.map(t => (
                  <button type="button" key={t.value}
                    onClick={() => setTipo(t.value)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all
                      ${tipo === t.value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-zinc-200 text-zinc-500 hover:border-teal-300"}`}>
                    <div className="text-xl mb-1">{t.icon}</div>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {vehiculos && vehiculos.length > 0 && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Vehículo (opcional)</label>
                <select className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-teal-500 outline-none bg-white"
                  value={vehiculoId} onChange={e => setVehiculoId(e.target.value)}>
                  <option value="">— Sin vehículo asociado —</option>
                  {vehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} ({v.patente})</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Fecha de Emisión</label>
              <input type="date" className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-teal-500 outline-none"
                value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Fecha de Vencimiento *</label>
              <input type="date" required className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-teal-500 outline-none"
                value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} />
            </div>

            {/* Upload de archivo */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Cargar PDF/Foto</label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all
                  ${archivoUrl ? "border-teal-400 bg-teal-50" : "border-zinc-200 hover:border-teal-300"}`}>
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-teal-600 text-sm font-semibold">
                    <Loader2 className="animate-spin" size={16} /> Subiendo...
                  </div>
                ) : archivoUrl ? (
                  <div className="flex items-center justify-center gap-2 text-teal-700 text-sm font-semibold">
                    <CheckCircle size={16} /> {fileName}
                  </div>
                ) : (
                  <div className="text-zinc-400 text-sm">
                    <Upload size={22} className="mx-auto mb-1" />
                    <p className="font-semibold">Cargar PDF/Foto</p>
                    <p className="text-xs">JPG, PNG, PDF — máx 5MB</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.png,.jpeg,.webp" className="hidden"
                onChange={handleFileUpload} />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-500 font-semibold hover:bg-zinc-50 transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={creating || uploading}
                className="flex-1 py-3 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-teal-700 transition-all disabled:opacity-50">
                {creating ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />} Guardar Trámite
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Listado de tarjetas */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-teal-500" size={28} />
        </div>
      ) : tramites.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-zinc-200 rounded-2xl">
          <FileText size={40} className="mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-400 font-semibold text-sm">No hay trámites registrados.</p>
          <p className="text-zinc-400 text-xs mt-1">Cargá tu seguro, VTV o licencia para llevar el control.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tramites.map(t => {
            const dias = getDaysUntilExpiry(t.fecha_vencimiento);
            const vencido = dias < 0;
            const urgente = dias >= 0 && dias <= 30;
            const tipoInfo = TIPOS_TRAMITE.find(x => x.value === t.tipo_tramite);
            return (
              <div key={t.id} className={`bg-white border rounded-2xl p-5 flex flex-col gap-4 transition-all hover:shadow-md
                ${vencido ? "border-red-300" : urgente ? "border-amber-300" : "border-zinc-200"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                      ${vencido ? "bg-red-100" : urgente ? "bg-amber-100" : "bg-teal-100"}`}>
                      {tipoInfo?.icon || "📎"}
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-800">{tipoInfo?.label || t.tipo_tramite}</h4>
                      {t.vehiculo && (
                        <p className="text-xs text-zinc-500 font-semibold flex items-center gap-1">
                          <Car size={10} /> {t.vehiculo.marca} {t.vehiculo.modelo} ({t.vehiculo.patente})
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(t.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Calendar size={11} /> Vence: <strong className="text-zinc-700">{t.fecha_vencimiento}</strong>
                  </span>
                  <span className={`font-bold px-2.5 py-1 rounded-lg ${vencido ? "bg-red-100 text-red-600" : urgente ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {vencido ? "⚠ VENCIDO" : urgente ? `⏳ ${dias} días` : "✓ Vigente"}
                  </span>
                </div>

                {t.archivo_url && (
                  <a href={t.archivo_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-teal-600 text-xs font-semibold hover:underline">
                    <FileText size={12} /> Ver documento adjunto
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
