import React, { useState, useEffect } from "react";
import { Store, Clock, XCircle, CheckCircle2, TrendingUp, Tag, Plus, Edit2, Trash2, Camera, UploadCloud, LogOut, ChevronRight } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../../store/useAuthStore";

export default function MiNegocioTab() {
  const { user } = useAuthStore();
  const [estadoNegocio, setEstadoNegocio] = useState<string | null>(null);
  const [solicitudEnCurso, setSolicitudEnCurso] = useState<any>(null);
  const [datosComercio, setDatosComercio] = useState<any>(null);
  const [promociones, setPromociones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario Solicitud
  const [formSolicitud, setFormSolicitud] = useState({
    nombre: "",
    rubro: "",
    direccion: "",
    telefono: "",
    email: "",
    descripcion: "",
    facebook_url: "",
    instagram_url: ""
  });
  const [fotoLocal, setFotoLocal] = useState<File | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Formulario Promocion
  const [showFormPromo, setShowFormPromo] = useState(false);
  const [formPromo, setFormPromo] = useState({
    titulo: "",
    descripcion: "",
    tipo: "fijo",
    descuento_porcentaje: 0,
    fecha_inicio: "",
    fecha_fin: ""
  });

  useEffect(() => {
    cargarEstado();
  }, [user]);

  const cargarEstado = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/negocio/estado`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if (resp.ok) {
        const d = await resp.json();
        setEstadoNegocio(d.estado);
        if (d.estado === "APROBADO") {
          setDatosComercio(d.data_comercio);
          cargarPromociones();
        } else if (d.solicitud) {
          setSolicitudEnCurso(d.solicitud);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cargarPromociones = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/negocio/promociones`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setPromociones(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const subidaLogo = async () => {
    if (!fotoLocal || !user) return null;
    setUploadingFoto(true);
    try {
      const fileExt = fotoLocal.name.split('.').pop();
      const filePath = `comercio_${user.id}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('comercios').upload(filePath, fotoLocal, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('comercios').getPublicUrl(filePath);
      return publicUrl;
    } catch (e: any) {
      alert(`Error subiendo foto: ${e.message}`);
      return null;
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleEnviarSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingFoto(true);
    
    let logo_url = null;
    if (fotoLocal) {
        logo_url = await subidaLogo();
    }

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/negocio/solicitud`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
        },
        body: JSON.stringify({ ...formSolicitud, logo_url })
      });
      if (resp.ok) {
        alert("Solicitud enviada correctamente. El administrador la revisará a la brevedad.");
        setFormSolicitud({nombre: "", rubro: "", direccion: "", telefono: "", email: "", descripcion: "", facebook_url: "", instagram_url: ""});
        setFotoLocal(null);
        cargarEstado();
      } else {
        const errorData = await resp.json();
        alert(`Error: ${errorData.detail}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error de red");
    } finally {
       setUploadingFoto(false);
    }
  };

  const handleCrearPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datosComercio) return;
    
    // Asumimos que usa la organizacion root (si aplica). Backend lo saca del token.
    try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/negocio/promociones`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
            },
            body: JSON.stringify(formPromo)
        });
        if (resp.ok) {
            alert("Promoción creada correctamente.");
            setShowFormPromo(false);
            setFormPromo({titulo: "", descripcion: "", tipo: "fijo", descuento_porcentaje: 0, fecha_inicio: "", fecha_fin: ""});
            cargarPromociones();
        } else {
            alert("Hubo un error al crear la promoción.");
        }
    } catch (e) {
        console.error(e);
        alert("Error de red");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl">
         <div className="animate-spin text-blue-500"><Store size={40} /></div>
      </div>
    );
  }

  // --- RENDERS CONDITIONALES DEPENDIENDO DEL ESTADO ---

  if (estadoNegocio === "PENDIENTE") {
      return (
          <div className="bg-amber-900/20 border border-amber-500/30 p-8 rounded-3xl text-center space-y-4 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
             <Clock size={64} className="text-amber-400 mx-auto animate-pulse mb-4" />
             <h2 className="text-2xl font-black text-amber-400">Solicitud en Revisión</h2>
             <p className="text-amber-200/70 max-w-lg mx-auto">
                Tu solicitud para adherir <strong>{solicitudEnCurso?.nombre}</strong> está siendo evaluada por un administrador. 
                Te notificaremos cuando el estado cambie. ¡Gracias por querer sumarte!
             </p>
          </div>
      );
  }

  if (estadoNegocio === "RECHAZADO") {
      return (
          <div className="bg-rose-900/20 border border-rose-500/30 p-8 rounded-3xl text-center space-y-4 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
             <XCircle size={64} className="text-rose-400 mx-auto mb-4" />
             <h2 className="text-2xl font-black text-rose-400">Solicitud Rechazada</h2>
             <p className="text-rose-200/70 max-w-lg mx-auto">
                Lamentablemente tu solicitud para adherir el comercio no cumple con los requisitos necesarios en este momento.
             </p>
             <button 
                onClick={() => setEstadoNegocio("NINGUNO")}
                className="mt-6 px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition shadow-[0_0_15px_rgba(244,63,94,0.4)]"
             >
                Intentar de nuevo
             </button>
          </div>
      );
  }

  if (estadoNegocio === "APROBADO" && datosComercio) {
      return (
          <div className="space-y-6">
              {/* Header Mi Negocio */}
              <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/20 rounded-3xl p-6 border border-blue-500/20 shadow-xl relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
                 <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none translate-y-1/3 translate-x-1/3"></div>
                 
                 {datosComercio.logo_url ? (
                     <div className="w-24 h-24 rounded-full border-4 border-blue-500 overflow-hidden shadow-lg shrink-0">
                         <img src={datosComercio.logo_url} alt="Logo" className="w-full h-full object-cover" />
                     </div>
                 ) : (
                     <div className="w-24 h-24 rounded-full bg-blue-600/30 flex justify-center items-center text-blue-400 shrink-0">
                         <Store size={40} />
                     </div>
                 )}

                 <div className="flex-1 text-center md:text-left z-10">
                     <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                         <h2 className="text-2xl font-black text-white">{datosComercio.nombre_comercio}</h2>
                         <span className="bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold py-1 px-2 rounded-lg border border-emerald-500/30">
                             ACTIVO
                         </span>
                     </div>
                     <p className="text-zinc-400 text-sm mb-3 max-w-2xl">{datosComercio.descripcion || "Sin descripción proporcionada."}</p>
                     
                     <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-medium text-blue-200/80">
                         <span>📍 {datosComercio.direccion}</span>
                         {datosComercio.telefono && <span>📞 {datosComercio.telefono}</span>}
                         {datosComercio.rubro && <span className="bg-blue-600/20 px-2 py-1 rounded-md">{datosComercio.rubro}</span>}
                     </div>
                 </div>
              </div>

              {/* Boton Agregar Propuestas y Stats */}
              <div className="flex justify-between items-center bg-black/30 p-4 border border-white/5 rounded-2xl">
                 <div className="flex items-center gap-4">
                    <div className="bg-blue-600/20 p-3 rounded-xl">
                       <Tag size={24} className="text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Mis Promociones</p>
                        <p className="text-xl font-bold text-white">{promociones.length} Activas</p>
                    </div>
                 </div>
                 
                 <button 
                   onClick={() => setShowFormPromo(!showFormPromo)}
                   className={`${showFormPromo ? 'bg-zinc-800 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'} px-5 py-2.5 rounded-xl font-bold transition flex items-center gap-2`}
                 >
                    {showFormPromo ? <XCircle size={18} /> : <Plus size={18} />}
                    <span className="hidden sm:inline">{showFormPromo ? "Cancelar" : "Crear Promoción"}</span>
                 </button>
              </div>

              {/* Formulario Crear Promocion */}
              {showFormPromo && (
                 <div className="bg-zinc-900/50 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-6 animate-in slide-in-from-top-4 fade-in">
                     <h3 className="text-lg font-bold text-white mb-6 border-b border-white/5 pb-4">Nueva Promoción / Beneficio</h3>
                     <form onSubmit={handleCrearPromo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-1">
                             <label className="text-xs text-zinc-400 font-bold ml-1">Título de la promoción *</label>
                             <input required type="text" value={formPromo.titulo} onChange={e => setFormPromo({...formPromo, titulo: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Ej: 20% Off en Cenas" />
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs text-zinc-400 font-bold ml-1">Descripción</label>
                             <input type="text" value={formPromo.descripcion} onChange={e => setFormPromo({...formPromo, descripcion: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Detalles, términos y condiciones..." />
                         </div>
                         
                         <div className="space-y-1">
                             <label className="text-xs text-zinc-400 font-bold ml-1">Tipo de Descuento</label>
                             <select value={formPromo.tipo} onChange={e => setFormPromo({...formPromo, tipo: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none appearance-none">
                                 <option value="porcentaje">Porcentaje (%)</option>
                                 <option value="fijo">Monto Fijo ($)</option>
                             </select>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs text-zinc-400 font-bold ml-1">Valor *</label>
                             <input required type="number" min="0" value={formPromo.descuento_porcentaje} onChange={e => setFormPromo({...formPromo, descuento_porcentaje: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none" placeholder="Ej: 20" />
                         </div>

                         <div className="space-y-1">
                             <label className="text-xs text-zinc-400 font-bold ml-1">Vigencia Desde</label>
                             <input type="date" value={formPromo.fecha_inicio} onChange={e => setFormPromo({...formPromo, fecha_inicio: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 outline-none" />
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs text-zinc-400 font-bold ml-1">Vigencia Hasta</label>
                             <input type="date" value={formPromo.fecha_fin} onChange={e => setFormPromo({...formPromo, fecha_fin: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 outline-none" />
                         </div>

                         <div className="md:col-span-2 pt-4">
                             <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition shadow-[0_0_20px_rgba(37,99,235,0.3)]">Guardar Promoción</button>
                         </div>
                     </form>
                 </div>
              )}

              {/* Lista de Promociones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {promociones.length === 0 ? (
                      <div className="md:col-span-2 text-center p-8 bg-zinc-900/30 rounded-2xl border border-white/5 border-dashed">
                          <p className="text-zinc-500">No tienes promociones activas.</p>
                      </div>
                  ) : (
                      promociones.map((promo, idx) => (
                           <div key={idx} className="bg-zinc-900 border border-white/5 p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                              <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-blue-500 to-indigo-600"></div>
                              <div className="ml-2">
                                  <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-bold text-white text-lg pr-4">{promo.titulo}</h4>
                                      <span className="shrink-0 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded border border-emerald-500/20">ACTIVA</span>
                                  </div>
                                  <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{promo.descripcion}</p>
                                  <div className="flex gap-2">
                                      {promo.tipo === 'porcentaje' ? (
                                         <span className="bg-blue-600/20 text-blue-400 font-black text-sm px-3 py-1 rounded-lg border border-blue-500/20">
                                            {promo.descuento_porcentaje}% OFF
                                         </span>
                                      ) : (
                                         <span className="bg-indigo-600/20 text-indigo-400 font-black text-sm px-3 py-1 rounded-lg border border-indigo-500/20">
                                            ${promo.descuento_porcentaje} OFF
                                         </span>
                                      )}
                                      {(promo.fecha_inicio || promo.fecha_fin) && (
                                         <span className="bg-white/5 text-zinc-400 text-xs px-3 py-1 rounded-lg border border-white/5 flex items-center">
                                            Vence: {promo.fecha_fin || 'Sin límite'}
                                         </span>
                                      )}
                                  </div>
                              </div>
                           </div>
                      ))
                  )}
              </div>
          </div>
      );
  }

  // --- RETURN POR DEFECTO: FORMULARIO DE ADHESIÓN ---
  return (
    <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl animate-in fade-in">
        <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 rotate-3">
                <Store size={32} className="text-blue-400 -rotate-3" />
            </div>
            <h2 className="text-2xl font-black text-white px-4">¿Querés sumar tu negocio?</h2>
            <p className="text-zinc-400 mt-2 max-w-md mx-auto text-sm">
               Convertite en un "Comercio Adherido" de Viajes NEA, ofrece promociones a nuestra flota de choferes y pasajeros, y atráe nuevos clientes.
            </p>
        </div>

        <form onSubmit={handleEnviarSolicitud} className="max-w-2xl mx-auto space-y-6">
            
            <div className="flex justify-center mb-8">
               <label className="cursor-pointer group flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-500 group-hover:border-blue-500 flex items-center justify-center overflow-hidden transition relative">
                     {fotoLocal ? (
                        <img src={URL.createObjectURL(fotoLocal)} className="w-full h-full object-cover" />
                     ) : (
                        <Camera className="text-zinc-500 group-hover:text-blue-400" size={24} />
                     )}
                     <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                         <UploadCloud className="text-white" size={20} />
                     </div>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFotoLocal(e.target.files?.[0] || null)} />
                  <span className="text-xs font-medium text-zinc-500 mt-2 group-hover:text-blue-400">Subir Logo (Opcional)</span>
               </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold ml-1">Nombre del Comercio *</label>
                  <input required value={formSolicitud.nombre} onChange={e => setFormSolicitud({...formSolicitud, nombre: e.target.value})} type="text" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="Ej: Lo de Pepe" />
               </div>
               <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold ml-1">Rubro *</label>
                  <input required value={formSolicitud.rubro} onChange={e => setFormSolicitud({...formSolicitud, rubro: e.target.value})} type="text" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Restaurante, Indumentaria..." />
               </div>
               <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-zinc-400 font-bold ml-1">Dirección *</label>
                  <input required value={formSolicitud.direccion} onChange={e => setFormSolicitud({...formSolicitud, direccion: e.target.value})} type="text" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Av. Principal 123" />
               </div>
               <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold ml-1">Teléfono</label>
                  <input value={formSolicitud.telefono} onChange={e => setFormSolicitud({...formSolicitud, telefono: e.target.value})} type="text" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="362 4..." />
               </div>
               <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold ml-1">Correo Electrónico</label>
                  <input value={formSolicitud.email} onChange={e => setFormSolicitud({...formSolicitud, email: e.target.value})} type="email" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="contacto@negocio.com" />
               </div>
               <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-zinc-400 font-bold ml-1">Breve Descripción *</label>
                  <textarea required value={formSolicitud.descripcion} onChange={e => setFormSolicitud({...formSolicitud, descripcion: e.target.value})} className="w-full h-24 bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 outline-none transition resize-none" placeholder="¿Qué hace tu negocio? ¿Qué le quieres ofrecer a nuestra red?..." />
               </div>

               <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold ml-1">Instagram (Opcional)</label>
                  <input value={formSolicitud.instagram_url} onChange={e => setFormSolicitud({...formSolicitud, instagram_url: e.target.value})} type="text" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="URL o @usuario" />
               </div>
               <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold ml-1">Facebook (Opcional)</label>
                  <input value={formSolicitud.facebook_url} onChange={e => setFormSolicitud({...formSolicitud, facebook_url: e.target.value})} type="text" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="URL de Facebook" />
               </div>
            </div>

            <div className="pt-4 border-t border-white/5">
                <button 
                  disabled={uploadingFoto} 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-xl font-black text-lg shadow-[0_0_20px_rgba(37,99,235,0.4)] transition"
                >
                   {uploadingFoto ? "Procesando..." : "Enviar Solicitud de Adhesión"}
                </button>
            </div>
        </form>
    </div>
  );
}
