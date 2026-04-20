import React, { useState, useEffect } from "react";
import { Briefcase, PlusCircle, CheckCircle, Car, ArrowLeft, Loader2, Clock, Moon, Sun, Calendar, Phone, Mail, MessageCircle, Trash2 } from "lucide-react";
import { getMisOfertasBolsa, createOfertaBolsa } from "../../services/api";

interface BolsaTitularTabProps {
  vehicleId?: string;
  onBack?: () => void;
}

const EXPERIENCIAS = [
  { value: "sin_experiencia", label: "Sin experiencia" },
  { value: "1-3", label: "1 a 3 Años de experiencia" },
  { value: "3-5", label: "3 a 5 Años de experiencia" },
  { value: "+5", label: "Más de 5 años" },
];

const TURNOS = [
  { value: "manana", label: "Mañana", icon: Sun },
  { value: "tarde", label: "Tarde", icon: Clock },
  { value: "noche", label: "Noche", icon: Moon },
  { value: "fines_de_semana", label: "Fines de Semana", icon: Calendar },
];

const CONTACTO_OPTS = [
  { value: "whatsapp", label: "WHATSAPP", icon: MessageCircle },
  { value: "telefono", label: "PHONE", icon: Phone },
  { value: "email", label: "EMAIL", icon: Mail },
];

export default function BolsaTitularTab({ vehicleId, onBack }: BolsaTitularTabProps) {
  const [misOfertas, setMisOfertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [requisitos, setRequisitos] = useState("");
  const [experiencia, setExperiencia] = useState("1-3");
  const [turnos, setTurnos] = useState<string[]>([]);
  const [prefContacto, setPrefContacto] = useState("whatsapp");
  const [contactoValor, setContactoValor] = useState("");
  const [tipoPublicacion, setTipoPublicacion] = useState("vehiculo_busca_chofer");

  const fetchOfertas = async () => {
    setLoading(true);
    try {
      const data = await getMisOfertasBolsa();
      setMisOfertas(data || []);
    } catch {
      console.error("Error cargando mis ofertas:");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOfertas(); }, []);

  const toggleTurno = (val: string) => {
    setTurnos(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    try {
      await createOfertaBolsa({
        vehicle_id: vehicleId || undefined,
        titulo: titulo || "Vacante para chofer",
        descripcion,
        requisitos,
        experiencia_chofer: experiencia,
        turnos_disponibles: turnos,
        preferencia_contacto: prefContacto,
        contacto_valor: contactoValor,
        tipo_publicacion: tipoPublicacion,
      });
      setFeedback({ type: "success", msg: "¡Aviso publicado con éxito! Ya es visible en la bolsa." });
      setShowForm(false);
      fetchOfertas();
    } catch {
      setFeedback({ type: "error", msg: "Error al publicar. Verificá los datos." });
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="animate-spin text-emerald-500 mb-4" size={32} />
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Cargando avisos...</p>
    </div>
  );

  if (showForm) return (
    <div className="bg-white rounded-3xl p-6 shadow-sm animate-in zoom-in-95 duration-300">
      <button onClick={() => setShowForm(false)} className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-zinc-800 transition-colors text-sm font-semibold">
        <ArrowLeft size={16} /> Volver a mis avisos
      </button>
      <h3 className="text-2xl font-bold text-zinc-800 mb-6 flex items-center gap-3">
        <Briefcase className="text-emerald-600" size={24} /> Publicar Auto
      </h3>

      <form onSubmit={handleCreate} className="space-y-5">
        {/* Titulo */}
        <div className="space-y-1">
          <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Título del Aviso</label>
          <input required
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-300"
            placeholder="Ej: Fiat Cronos Turno Día"
            value={titulo} onChange={e => setTitulo(e.target.value)} />
        </div>

        {/* Descripcion */}
        <div className="space-y-1">
          <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Descripción Detallada</label>
          <textarea required
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-300 h-28 resize-none"
            placeholder="Requisitos extra, zona de preferencia..."
            value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        </div>

        {/* Experiencia */}
        <div className="space-y-2">
          <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Experiencia Chofer</label>
          <select
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none bg-white"
            value={experiencia} onChange={e => setExperiencia(e.target.value)}>
            {EXPERIENCIAS.map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
          </select>
        </div>

        {/* Turnos - multi select grid */}
        <div className="space-y-2">
          <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Turnos Disponibles</label>
          <div className="grid grid-cols-2 gap-2">
            {TURNOS.map(t => {
              const selected = turnos.includes(t.value);
              return (
                <button type="button" key={t.value}
                  onClick={() => toggleTurno(t.value)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all
                    ${selected ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-200 text-zinc-500 hover:border-emerald-300"}`}>
                  <t.icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferencia de Contacto */}
        <div className="space-y-2">
          <label className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Preferencia de Contacto</label>
          <div className="flex gap-3">
            {CONTACTO_OPTS.map(c => (
              <button type="button" key={c.value}
                onClick={() => setPrefContacto(c.value)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all
                  ${prefContacto === c.value ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-zinc-200 text-zinc-400"}`}>
                <c.icon size={13} /> {c.label}
              </button>
            ))}
          </div>
          <input
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none placeholder:text-zinc-300"
            placeholder="+54 9 11 ..."
            value={contactoValor} onChange={e => setContactoValor(e.target.value)} />
        </div>

        {/* Feedback */}
        {feedback && (
          <p className={`text-sm font-semibold ${feedback.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
            {feedback.msg}
          </p>
        )}

        <button type="submit" disabled={creating}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50">
          {creating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
          Publicar Disponibilidad
        </button>
      </form>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {feedback && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {feedback.msg}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
            <Briefcase className="text-emerald-600" size={22} /> Bolsa de Trabajo
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">Publicá avisos para tu flota o buscá choferes.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow hover:bg-emerald-600 transition-all flex items-center gap-2">
          <PlusCircle size={16} /> Publicar
        </button>
      </div>

      {/* Avisos Activos */}
      <h3 className="text-sm font-bold text-zinc-700 mb-3 uppercase tracking-wider">Avisos Activos</h3>
      <div className="space-y-4">
        {misOfertas.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-zinc-200 rounded-2xl">
            <Briefcase size={40} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-400 font-semibold text-sm">No tenés avisos publicados.</p>
          </div>
        ) : (
          misOfertas.map(o => (
            <div key={o.id} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Car className="text-emerald-600" size={18} />
                  </div>
                  <div>
                    <h4 className="text-zinc-800 font-bold">{o.titulo}</h4>
                    <span className={`text-xs font-semibold ${o.estado === 'abierta' ? 'text-emerald-600' : 'text-zinc-400'}`}>
                      {o.estado === 'abierta' ? 'Disponible' : o.estado}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-zinc-400 bg-zinc-100 px-2 py-1 rounded-lg">ID: {o.id?.slice(0, 4)}</span>
                </div>
              </div>
              <p className="text-zinc-500 text-sm mt-3">{o.descripcion}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
                <div className="text-xs text-zinc-400">
                  {o.preferencia_contacto && <span className="flex items-center gap-1"><Phone size={11} /> {o.contacto_valor}</span>}
                </div>
                <div className="flex gap-3">
                  <button className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors">Eliminar</button>
                  <button className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors">Editar</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
