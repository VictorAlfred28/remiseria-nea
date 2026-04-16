import { useState, useEffect, useMemo } from "react";
import { Car, MapPin, Calculator, Loader2, Navigation, History, CreditCard, Calendar, User, Phone, XCircle, ChevronRight, Lock, Building, CheckCircle2, Star, MessageSquare, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import WeatherWidget from "../components/WeatherWidget";
import { calculateDistance } from "../utils/geo";
import QRCode from "react-qr-code";

export default function ClienteDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'pedir' | 'reservas' | 'historial' | 'perfil' | 'empresa' | 'carnet'>('pedir');
  
  // States
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [origenCoords, setOrigenCoords] = useState<{lat: number, lng: number} | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [cotizacion, setCotizacion] = useState<any>(null);

  // Autocomplete Sugerencias
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [activeSugField, setActiveSugField] = useState<'origen' | 'destino' | null>(null);
  
  const [viajeActivo, setViajeActivo] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [promociones, setPromociones] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  
  // Reservas Form
  const [resFecha, setResFecha] = useState("");
  const [resHora, setResHora] = useState("");
  const [viajeMinimizado, setViajeMinimizado] = useState(false);
  
  // Soporte
  const [orgSoporteMoto, setOrgSoporteMoto] = useState<any>(null);
  
  // Perfil
  const [newPassword, setNewPassword] = useState("");
  const [passMessage, setPassMessage] = useState("");
  
  // Puntos Status
  const [puntosStatus, setPuntosStatus] = useState<any>(null);
  const [usarViajeGratis, setUsarViajeGratis] = useState(false);

  // Empresas Status
  const [empresaAsignada, setEmpresaAsignada] = useState<any>(null);
  const [tipoViaje, setTipoViaje] = useState<'PERSONAL' | 'EMPRESARIAL'>('PERSONAL');

  // Rating Status
  const [viajeACompletar, setViajeACompletar] = useState<any>(null);
  const [ratingVal, setRatingVal] = useState(5);
  const [ratingComentario, setRatingComentario] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  
  // Carnet Digital
  const [qrToken, setQrToken] = useState<string | null>(null);

  useEffect(() => {
    cargarDatosIniciales();
    
    const subscription = supabase.channel('viajes_cliente')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes', filter: `cliente_id=eq.${user?.id}` }, () => {
          cargarViajeActivo();
          verificarRatings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    }
  }, [user]);

  const cargarDatosIniciales = async () => {
    if(!user) return;
    await cargarViajeActivo();
    await verificarRatings();
    
    // Cargar organizacion support
    const { data: orgInfo } = await supabase.from('organizaciones').select('whatsapp_numero, nombre').limit(1);
    if(orgInfo) setOrgSoporteMoto(orgInfo[0]);

    // Fetch API Historial (usamos el endpoint pero supabase es directo aca tmb)
    const { data: hist } = await supabase.from('viajes').select('*, promocion_id(titulo)').eq('cliente_id', user.id).order('creado_en', { ascending: false }).limit(50);
    if(hist) setHistorial(hist);
    
    // Fetch Puntos
    cargarPuntosStatus();
    
    // Fetch Empresa Info
    cargarEmpresaStatus();
    
    // Fetch Promos
    const { data: promos } = await supabase.from('promociones').select('*').eq('activa', true);
    if(promos) setPromociones(promos);
    
    cargarReservas();
  };

  const cargarEmpresaStatus = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/empresa`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if(resp.ok) {
        const d = await resp.json();
        if(d.has_empresa) {
          setEmpresaAsignada(d);
          const ultimo = localStorage.getItem('ultimo_tipo_viaje');
          if (ultimo === 'EMPRESARIAL') setTipoViaje('EMPRESARIAL');
        }
      }
    } catch (e) {
      console.error("Error cargando empresa:", e);
    }
  };

  const cargarPuntosStatus = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/puntos/status`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if(resp.ok) {
        const d = await resp.json();
        setPuntosStatus(d);
      }
    } catch (e) {
      console.error("Error cargando puntos:", e);
    }
  };

  const cargarReservas = async () => {
     try {
       const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/reservas`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
       });
       if(resp.ok) {
           const d = await resp.json();
           setReservas(d);
       }
     } catch (e) {}
  };

  const cargarViajeActivo = async () => {
    const { data } = await supabase.from('viajes').select('*').eq('cliente_id', user?.id).in('estado', ['solicitado', 'REQUESTED', 'asignado', 'ACCEPTED', 'en_camino', 'ARRIVED', 'STARTED']).order('creado_en', { ascending: false }).limit(1);
    if(data && data.length > 0) {
      setViajeActivo(data[0]);
    } else {
      setViajeActivo(null);
      setViajeMinimizado(false);
    }
  }

  const cargarQrSocio = async () => {
     try {
       const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/socios/qr_token`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
       });
       if(resp.ok) {
           const d = await resp.json();
           setQrToken(d.qr_token);
       }
     } catch (e) {
        console.error("Error cargando QR:", e);
     }
  };

  useEffect(() => {
     if(activeTab === 'carnet') {
         cargarQrSocio();
         const interval = setInterval(cargarQrSocio, 4.5 * 60 * 1000); // 4.5 minutos
         return () => clearInterval(interval);
     }
  }, [activeTab]);

  const verificarRatings = async () => {
     if(!user) return;
     const { data } = await supabase.from('viajes').select('*').eq('cliente_id', user.id).eq('estado', 'FINISHED').order('creado_en', { ascending: false }).limit(1);
     if(data && data.length > 0) {
         const ultimoViaje = data[0];
         const { data: califs } = await supabase.from('calificaciones').select('id').eq('viaje_id', ultimoViaje.id);
         if(!califs || califs.length === 0) {
            setViajeACompletar(ultimoViaje);
         } else {
            setViajeACompletar(null);
         }
     } else {
         setViajeACompletar(null);
     }
  };

  const handleCalificar = async () => {
     if(!viajeACompletar) return;
     setRatingLoading(true);
     try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/viaje/${viajeACompletar.id}/calificar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` },
            body: JSON.stringify({ puntuacion: ratingVal, comentario: ratingComentario })
        });
        if(resp.ok) {
           setViajeACompletar(null);
           alert("¡Gracias por tu calificación!");
        } else {
           alert("Hubo un error al calificar.");
        }
     } catch(e) {
        console.error(e);
     } finally {
        setRatingLoading(false);
     }
  };

  const formatEstadoViaje = (estado: string) => {
     switch(estado) {
         case 'solicitado':
         case 'REQUESTED': return "Buscando chofer...";
         case 'asignado':
         case 'ACCEPTED': return "Chofer en camino";
         case 'ARRIVED': return "Llegó a tu ubicación";
         case 'en_camino':
         case 'STARTED': return "En viaje";
         case 'finalizado':
         case 'FINISHED': return "Finalizado";
         default: return estado;
     }
  };

  // ---- Funciones Viaje Activo ---- //
  const handleCotizar = async () => {
    if (!origen || !destino) return;
    setLoading(true);
    
    // Coordenadas reales o fallback a Resistencia centro
    const oLat = origenCoords?.lat || -27.4511;
    const oLng = origenCoords?.lng || -58.9866;
    const dLat = destinoCoords?.lat || -27.4566;
    const dLng = destinoCoords?.lng || -58.9822;
    
    // Calculo Dinámico por Haversine
    const distanciaKmCalculada = parseFloat(calculateDistance(oLat, oLng, dLat, dLng));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/viaje/cotizar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
        },
        body: JSON.stringify({
          origen: { direccion: origen, lat: oLat, lng: oLng },
          destino: { direccion: destino, lat: dLat, lng: dLng },
          precio_estimado: 0, // Ignorado por el backend nuevo (usa pricing.py)
          distancia_km: distanciaKmCalculada,
          tipo_viaje: tipoViaje
        })
      });
      const data = await response.json();
      // Le agregaremos la distancia al objeto para usarlo en la UI
      data.distancia_km = distanciaKmCalculada;
      setCotizacion(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitarViaje = async () => {
    if (!cotizacion) return;
    setLoading(true);
    
    const oLat = origenCoords?.lat || -27.4511;
    const oLng = origenCoords?.lng || -58.9866;
    const dLat = destinoCoords?.lat || -27.4566;
    const dLng = destinoCoords?.lng || -58.9822;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/viaje`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
        },
        body: JSON.stringify({
          origen: { direccion: origen, lat: oLat, lng: oLng },
          destino: { direccion: destino, lat: dLat, lng: dLng },
          precio_estimado: cotizacion.precio_original,
          distancia_km: cotizacion.distancia_km || 2.5,
          usar_viaje_gratis: usarViajeGratis,
          tipo_viaje: tipoViaje
        })
      });

      if(response.ok) {
        await cargarViajeActivo();
        await cargarPuntosStatus();
        setOrigen(''); setDestino(''); setCotizacion(null); setUsarViajeGratis(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarViaje = async () => {
    if(!viajeActivo) return;
    if(!confirm("¿Estás seguro que deseas cancelar este viaje?")) return;
    setLoading(true);
    try {
       const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/viaje/${viajeActivo.id}/cancelar`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
       });
       if(resp.ok){
         setViajeActivo(null);
         cargarDatosIniciales();
       } else {
         try {
             const errorData = await resp.json();
             alert(`No se pudo cancelar el viaje: ${errorData.detail}`);
         } catch {
             alert("Error de conexión o fallo en el servidor.");
         }
       }
    } catch(e) {
      console.error(e);
    } finally {
       setLoading(false);
    }
  };

  const handlePagarViaje = async (viaje: any) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/payments/create_trip_preference`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
         },
         body: JSON.stringify({
            viaje_id: viaje.id,
            monto: viaje.precio,
            descripcion: `Viaje a ${viaje.destino.direccion || 'Destino'}`
         })
      });
      
      const data = await resp.json();
      if(data.init_point) {
         window.location.href = data.init_point;
      }
    } catch (e) {
       alert("Error al iniciar pago con Mercado Pago");
    }
  };
  // ---- Lógica de Autocompletado y GPS ---- //
  const handleFetchSugerencias = async (query: string, field: 'origen' | 'destino') => {
      if (query.length < 3) {
          setSugerencias([]);
          return;
      }
      try {
          // Bounding Box ajustado para el NEA (Chaco, Corrientes) para mejorar fuertemente la relevancia
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar&viewbox=-60.5,-26.0,-57.0,-28.5&bounded=1&limit=5`);
          const data = await res.json();
          setSugerencias(data);
          setActiveSugField(field);
      } catch (e) {
          console.error("Error Nominatim:", e);
      }
  };

  const handleSelectSugerencia = (item: any) => {
      if (activeSugField === 'origen') {
          setOrigen(item.display_name);
          setOrigenCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
      } else if (activeSugField === 'destino') {
          setDestino(item.display_name);
          setDestinoCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
      }
      setSugerencias([]);
      setActiveSugField(null);
  };

  const useMyLocation = () => {
      if (!navigator.geolocation) return;
      setLoading(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const { latitude, longitude } = pos.coords;
          setOrigenCoords({ lat: latitude, lng: longitude });
          try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
              const data = await res.json();
              setOrigen(data.display_name || `Ubicación actual (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          } catch (e) {
              setOrigen(`Mi ubicación actual`);
          }
          setLoading(false);
      }, () => {
          setLoading(false);
          alert("No pudimos obtener tu ubicación.");
      });
  };
  // ---- Reservas ---- //
  const handleReservarViaje = async () => {
     if(!origen || !destino || !resFecha || !resHora) return;
     setLoading(true);
     try {
       const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cliente/reservas`, {
          method: "POST",
          headers: {
             "Content-Type": "application/json",
             "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
          },
          body: JSON.stringify({
             origen, destino, fecha: resFecha, hora: resHora
          })
       });
       if(resp.ok) {
          alert("¡Reserva agendada exitosamente!");
          setOrigen(""); setDestino(""); setResFecha(""); setResHora("");
          cargarReservas();
       }
     } catch(e) {
        console.error(e);
     } finally {
        setLoading(false);
     }
  };

  // ---- Perfil ---- //
  const handleChangePassword = async (e: any) => {
     e.preventDefault();
     if(newPassword.length < 6) {
        setPassMessage("La contraseña debe tener al menos 6 caracteres.");
        return;
     }
     setLoading(true);
     const { error } = await supabase.auth.updateUser({ password: newPassword });
     if(error) {
        setPassMessage("Error actualizando la contraseña.");
     } else {
        setPassMessage("¡Contraseña actualizada exitosamente!");
        setNewPassword("");
     }
     setLoading(false);
     setTimeout(() => setPassMessage(""), 3000);
  };

  // ---- Computar Rutinarios ---- //
  const viajesFrecuentes = useMemo(() => {
     if(!historial || historial.length === 0) return [];
     const contador: Record<string, {count: number, origen: string, destino: string}> = {};
     
     historial.forEach(v => {
        const o = v.origen?.direccion;
        const d = v.destino?.direccion;
        if(o && d) {
           const key = `${o}|${d}`;
           if(contador[key]) contador[key].count++;
           else contador[key] = { count: 1, origen: o, destino: d };
        }
     });
     
     return Object.values(contador).sort((a,b) => b.count - a.count).slice(0, 3);
  }, [historial]);

  const seleccionarRutinario = (o: string, d: string) => {
     setOrigen(o);
     setDestino(d);
     setActiveTab('pedir');
  };

  const handleSupportWhatsApp = () => {
      let tel = orgSoporteMoto?.whatsapp_numero || "5491111111111"; // Fallback
      if(tel.startsWith("+")) tel = tel.replace("+","");
      window.open(`https://wa.me/${tel}?text=Hola, preciso ayuda desde la plataforma Web.`, "_blank");
  };

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0 relative">
      {/* HEADER PERFIL Y TABS */}
      <header className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex flex-col gap-3">
             <div>
               <h1 className="text-2xl font-black text-white flex items-center gap-2">
                 ¡Hola, {user?.user_metadata?.nombre || 'Pasajero'}! 👋
               </h1>
               <p className="text-zinc-400 text-sm mt-1">Tu panel de movilidad inteligente</p>
             </div>
             <div className="w-full animate-in fade-in slide-in-from-left-4 duration-700">
               <WeatherWidget />
             </div>
           </div>
           
           {/* Navigation Tabs Desktop */}
           <div className="hidden md:flex bg-black/40 p-1.5 rounded-xl gap-1">
               {[
                 { id: 'pedir', label: 'Inicio', icon: Car },
                 { id: 'reservas', label: 'Reservas', icon: Calendar },
                 { id: 'historial', label: 'Historial', icon: History },
                 { id: 'perfil', label: 'Perfil', icon: User },
                 { id: 'carnet', label: 'Carnet Socio', icon: Star },
                 ...(empresaAsignada ? [{ id: 'empresa', label: 'Mi Empresa', icon: Building }] : [])
               ].map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as any)}
                   className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all rounded-lg ${
                      activeTab === tab.id 
                       ? 'bg-blue-600 text-white shadow-lg' 
                       : 'text-zinc-400 hover:text-white hover:bg-white/5'
                   }`}
                 >
                   <tab.icon size={16} /> {tab.label}
                 </button>
              ))}
           </div>
        </div>
        
        {/* Navigation Tabs Mobile (Scrollable) */}
        <div className="flex md:hidden bg-black/40 p-1.5 rounded-xl gap-1 mt-4 overflow-x-auto snap-x scrollbar-hide py-2">
           {[
             { id: 'pedir', label: 'Inicio', icon: Car },
             { id: 'reservas', label: 'Reservas', icon: Calendar },
             { id: 'historial', label: 'Historial', icon: History },
             { id: 'perfil', label: 'Perfil', icon: User },
             { id: 'carnet', label: 'Carnet Socio', icon: Star },
             ...(empresaAsignada ? [{ id: 'empresa', label: 'Mi Empresa', icon: Building }] : [])
           ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`snap-center flex-shrink-0 flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all rounded-lg ${
                   activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
           ))}
        </div>
      </header>

      {/* RENDERIZADO CONDICIONAL SEGUN EL TAB */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA PRINCIPAL */}
        <div className="lg:col-span-2">
          
          {/* TAB: PEDIR AHORA */}
          {activeTab === 'pedir' && (
            <div className="space-y-6">
               {(viajeActivo && viajeMinimizado) && (
                  <button 
                    onClick={() => setViajeMinimizado(false)}
                    className="w-full bg-blue-600/20 border border-blue-500/30 p-4 rounded-2xl flex items-center justify-between hover:bg-blue-600/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                       <div className="bg-blue-600 p-2 rounded-lg group-hover:scale-110 transition-transform">
                          <Car size={20} className="text-white" />
                       </div>
                       <div className="text-left">
                          <p className="text-white font-bold text-sm">Viaje en curso ({formatEstadoViaje(viajeActivo.estado)})</p>
                          <p className="text-blue-400 text-xs">Toca para abrir el panel de seguimiento</p>
                       </div>
                    </div>
                    <ChevronRight size={20} className="text-blue-400" />
                  </button>
               )}

               {(viajeActivo && !viajeMinimizado) ? (
                 /* UI VIAJE ACTIVO */
                 <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/20 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Navigation size={120} />
                    </div>
                    
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setViajeMinimizado(true);
                             }}
                             className="bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-all text-white relative z-50 shadow-lg active:scale-95"
                             title="Volver al panel"
                           >
                             <ArrowLeft size={18} />
                           </button>
                           <span className="inline-flex items-center px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                             Viaje en Curso
                           </span>
                        </div>
                        <h2 className="text-2xl font-bold text-white">{formatEstadoViaje(viajeActivo.estado)}</h2>
                        {['ACCEPTED', 'asignado'].includes(viajeActivo.estado) && (
                            <p className="text-sm font-medium text-amber-400 mt-1">ETA Estimado: ~5 min</p>
                        )}
                      </div>
                      <div className="text-right">
                         <p className="text-sm text-zinc-400">Total a pagar</p>
                         <p className="text-2xl font-bold text-emerald-400">${Number(viajeActivo.precio).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="bg-black/20 border border-white/5 rounded-2xl p-4 mb-6 relative z-10">
                       <div className="flex items-start gap-3 mb-4">
                          <MapPin className="text-rose-400 mt-1" size={18} />
                          <div>
                            <p className="text-xs text-zinc-500 font-medium">ORIGEN</p>
                            <p className="text-white text-sm">{viajeActivo.origen.direccion}</p>
                          </div>
                       </div>
                       <div className="flex items-start gap-3">
                          <Navigation className="text-blue-400 mt-1" size={18} />
                          <div>
                            <p className="text-xs text-zinc-500 font-medium">DESTINO</p>
                            <p className="text-white text-sm">{viajeActivo.destino.direccion}</p>
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                      <a 
                        href={`/track/${viajeActivo.id}`} 
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2"
                        target="_blank" rel="noreferrer"
                      >
                        <MapPin size={18} /> Ver Ubicación Real
                      </a>
                      {viajeActivo.estado !== 'ARRIVED' && viajeActivo.estado !== 'en_camino' && (
                         <button 
                           onClick={handleCancelarViaje}
                           disabled={loading}
                           className="flex-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-medium py-3 rounded-xl transition-all border border-rose-500/20 flex items-center justify-center gap-2"
                         >
                           <XCircle size={18} /> Cancelar Viaje
                         </button>
                      )}
                      <button 
                        onClick={() => handlePagarViaje(viajeActivo)}
                        className="flex-1 bg-[#009EE3] hover:bg-[#0089C9] text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(0,158,227,0.3)] flex items-center justify-center gap-2"
                      >
                        <CreditCard size={18} /> Abonar 
                      </button>
                    </div>
                 </div>
               ) : (
                 /* UI SOLICITAR VIAJE */
                 <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
                   <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                     <Car className="text-blue-400" /> Solicitar Móvil AHORA
                   </h2>
                   
                   {empresaAsignada && (
                     <div className="mb-6 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">Modo de Viaje</p>
                          <p className="text-white font-medium flex items-center gap-2 text-sm">
                             {tipoViaje === 'EMPRESARIAL' ? <span className="bg-blue-600/20 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded uppercase text-blue-400 font-bold">Empresa</span> : null}
                             {tipoViaje === 'EMPRESARIAL' ? empresaAsignada.nombre_empresa : 'Viaje Personal'}
                          </p>
                        </div>
                        <button 
                           onClick={() => {
                             const n = tipoViaje === 'PERSONAL' ? 'EMPRESARIAL' : 'PERSONAL';
                             setTipoViaje(n);
                             localStorage.setItem('ultimo_tipo_viaje', n);
                             if(cotizacion) setCotizacion(null);
                           }}
                           className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${tipoViaje === 'EMPRESARIAL' ? 'bg-blue-600' : 'bg-zinc-700'}`}
                        >
                           <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${tipoViaje === 'EMPRESARIAL' ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                     </div>
                   )}

                      <div className="space-y-4 relative">
                      <div className="absolute left-6 top-8 bottom-12 w-0.5 bg-zinc-800"></div>
                      
                      {/* ORIGEN */}
                      <div className="relative pl-10">
                        <div className="absolute left-4 top-3.5 w-4 h-4 bg-rose-500/20 border border-rose-500 rounded-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                        </div>
                        <div className="flex gap-2">
                           <input
                             type="text"
                             value={origen}
                             onChange={(e) => {
                                 setOrigen(e.target.value);
                                 handleFetchSugerencias(e.target.value, 'origen');
                                 if(cotizacion) setCotizacion(null);
                             }}
                             placeholder="¿Dónde te buscamos?"
                             className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                           />
                           <button 
                             onClick={useMyLocation}
                             className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-3 rounded-xl border border-white/5 transition-colors"
                             title="Usar mi ubicación actual"
                           >
                             <MapPin size={18} />
                           </button>
                        </div>
                        {activeSugField === 'origen' && sugerencias.length > 0 && (
                            <div className="absolute z-50 left-10 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                               {sugerencias.map((s, i) => (
                                   <button 
                                     key={i} 
                                     onClick={() => handleSelectSugerencia(s)}
                                     className="w-full text-left px-4 py-3 hover:bg-blue-600/20 text-sm text-zinc-300 border-b border-white/5 last:border-0 truncate"
                                   >
                                      {s.display_name}
                                   </button>
                               ))}
                            </div>
                        )}
                      </div>

                      {/* DESTINO */}
                      <div className="relative pl-10 mt-6 pt-4">
                        <div className="absolute left-4 top-7 w-4 h-4 bg-blue-500/20 border border-blue-500 rounded-full flex items-center justify-center">
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                         </div>
                        <input
                          type="text"
                          value={destino}
                          onChange={(e) => {
                              setDestino(e.target.value);
                              handleFetchSugerencias(e.target.value, 'destino');
                              if(cotizacion) setCotizacion(null);
                          }}
                          placeholder="¿A dónde nos dirigimos?"
                          className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {activeSugField === 'destino' && sugerencias.length > 0 && (
                            <div className="absolute z-50 left-10 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                               {sugerencias.map((s, i) => (
                                   <button 
                                     key={i} 
                                     onClick={() => handleSelectSugerencia(s)}
                                     className="w-full text-left px-4 py-3 hover:bg-blue-600/20 text-sm text-zinc-300 border-b border-white/5 last:border-0 truncate"
                                   >
                                      {s.display_name}
                                   </button>
                               ))}
                            </div>
                        )}
                      </div>
                    </div>

                   {!cotizacion ? (
                     <button 
                       onClick={handleCotizar}
                       disabled={loading || !origen || !destino}
                       className="w-full mt-6 bg-white hover:bg-zinc-200 text-black font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                     >
                       {loading ? <Loader2 className="animate-spin" size={18} /> : <Calculator size={18} />}
                       Calcular Viaje
                     </button>
                   ) : (
                     <div className="mt-8 animate-in slide-in-from-bottom flex flex-col items-center">
                        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl w-full p-5 text-center mb-4">
                           {cotizacion.monto_descontado > 0 && (
                             <div className="mb-1 text-sm font-medium text-emerald-400 bg-emerald-500/10 inline-block px-3 py-1 rounded-full">
                               ¡Promoción aplicada! (-${cotizacion.monto_descontado})
                             </div>
                           )}
                           <p className="text-zinc-400 text-sm mb-1 mt-2">
                              Distancia aproximada: {cotizacion.distancia_km ? `${cotizacion.distancia_km.toFixed(1)} KM` : "Calculando..."}
                           </p>
                           <p className="text-zinc-300 font-bold text-sm mb-1 mt-1">Costo Estimado Final</p>
                           <div className="flex items-center justify-center gap-3">
                              {cotizacion.monto_descontado > 0 && (
                                <span className="text-xl text-zinc-500 line-through decoration-rose-500/50">${cotizacion.precio_original}</span>
                              )}
                              <span className="text-4xl font-black text-white">${cotizacion.precio_final}</span>
                           </div>
                        </div>
                        <div className="flex gap-3 w-full">
                          <button 
                            onClick={() => setCotizacion(null)}
                            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 rounded-xl transition-all"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={handleSolicitarViaje}
                            disabled={loading}
                            className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                          >
                             Pedir Ahora
                          </button>
                        </div>
                     </div>
                   )}

                   {/* Lógica de Viaje Gratis */}
                   {!viajeActivo && (puntosStatus?.viajes_gratis || 0) > 0 && cotizacion && (
                     <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="bg-amber-500/20 p-2 rounded-full">
                           <Car className="text-amber-500" size={20} />
                         </div>
                         <div>
                           <p className="text-white font-bold text-sm">¡Tienes {puntosStatus.viajes_gratis} viaje(s) gratis!</p>
                           <p className="text-amber-400/70 text-xs">Puedes usar uno ahora</p>
                         </div>
                       </div>
                       <button 
                         onClick={() => setUsarViajeGratis(!usarViajeGratis)}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                           usarViajeGratis 
                           ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
                           : 'bg-zinc-800 text-white border border-white/5'
                         }`}
                       >
                         {usarViajeGratis ? 'USANDO...' : 'USAR AHORA'}
                       </button>
                     </div>
                   )}
                 </div>
               )}

               {/* VIAJES FRECUENTES */}
               {!viajeActivo && viajesFrecuentes.length > 0 && (
                 <div className="bg-zinc-900/50 backdrop-blur-xl border border-blue-500/10 rounded-3xl p-6">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                       <History size={18} className="text-blue-400" /> Vuelve a viajar
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {viajesFrecuentes.map((v, i) => (
                           <button 
                             key={i}
                             onClick={() => seleccionarRutinario(v.origen, v.destino)}
                             className="flex flex-col text-left bg-black/40 hover:bg-blue-600/20 hover:border-blue-500/30 border border-white/5 p-4 rounded-2xl transition-colors group"
                           >
                              <div className="flex items-center gap-2 mb-2">
                                <MapPin size={14} className="text-rose-400" />
                                <span className="text-sm font-medium text-white truncate w-full">{v.origen}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Navigation size={14} className="text-blue-400" />
                                <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors truncate w-full">{v.destino}</span>
                              </div>
                           </button>
                       ))}
                    </div>
                 </div>
               )}
            </div>
          )}

          {/* TAB: RESERVAS */}
          {activeTab === 'reservas' && (
             <div className="space-y-6">
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-6">
                   <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                     <Calendar className="text-emerald-400" /> Programar Futuro Viaje
                   </h2>
                   
                   <form onSubmit={(e) => { e.preventDefault(); handleReservarViaje(); }} className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-zinc-400 text-sm mb-1">Origen</label>
                         <input required type="text" value={origen} onChange={e => setOrigen(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Ej: San Juan 332" />
                       </div>
                       <div>
                         <label className="block text-zinc-400 text-sm mb-1">Destino</label>
                         <input required type="text" value={destino} onChange={e => setDestino(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Ej: Aeropuerto" />
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-zinc-400 text-sm mb-1">Fecha</label>
                         <input required type="date" value={resFecha} onChange={e => setResFecha(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]" />
                       </div>
                       <div>
                         <label className="block text-zinc-400 text-sm mb-1">Hora</label>
                         <input required type="time" value={resHora} onChange={e => setResHora(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]" />
                       </div>
                     </div>

                     <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] mt-6">
                        Agendar Reserva
                     </button>
                   </form>
                </div>

                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
                   <h3 className="text-white font-bold mb-4 flex items-center gap-2">⏱️ Mis Reservas Aprobadas</h3>
                   {reservas.length === 0 ? (
                     <p className="text-zinc-500 text-sm">No tienes viajes programados a futuro.</p>
                   ) : (
                     <div className="space-y-4">
                        {reservas.map(r => (
                           <div key={r.id} className="bg-black/30 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                              <div>
                                 <p className="text-white font-medium">{new Date(`${r.fecha_viaje}T${r.hora_viaje}`).toLocaleString()}</p>
                                 <p className="text-zinc-400 text-sm">{r.origen} ➝ <span className="text-zinc-300">{r.destino}</span></p>
                              </div>
                              <div>
                                 <span className="px-3 py-1 bg-white/10 text-zinc-300 rounded-full text-xs font-bold uppercase">{r.estado}</span>
                              </div>
                           </div>
                        ))}
                     </div>
                   )}
                </div>
             </div>
          )}

          {/* TAB: HISTORIAL */}
          {activeTab === 'historial' && (
             <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
                <h2 className="text-xl font-bold text-white mb-6">Historial de tus Viajes</h2>
                {historial.length === 0 ? (
                  <p className="text-zinc-500">Aún no tienes un historial para mostrar.</p>
                ) : (
                  <div className="space-y-4">
                    {historial.map(v => (
                       <div key={v.id} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center mb-2">
                             <div className="flex items-center gap-3">
                                <Car size={16} className={v.estado === 'FINISHED' ? 'text-emerald-400' : 'text-zinc-500'} />
                                <span className="text-white font-medium">{v.destino?.direccion}</span>
                             </div>
                             <span className="font-bold text-white">${Number(v.precio).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs text-zinc-500 pl-7 w-full pr-1">
                             <span>Desde: {v.origen?.direccion}</span>
                             <span>{new Date(v.creado_en).toLocaleDateString()}</span>
                          </div>
                       </div>
                    ))}
                  </div>
                )}
             </div>
          )}

          {/* TAB: PERFIL */}
          {activeTab === 'perfil' && (
             <div className="space-y-6">
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
                   <div className="flex items-center gap-4 mb-8">
                      <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/50 rounded-full flex items-center justify-center">
                         <User size={28} className="text-blue-400" />
                      </div>
                      <div>
                         <h2 className="text-2xl font-bold text-white">{user?.user_metadata?.nombre || 'Pasajero Ejecutivo'}</h2>
                         <p className="text-zinc-400">{user?.email}</p>
                      </div>
                   </div>

                   <hr className="border-white/5 mb-8" />
                   
                   <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                     <Lock size={18} className="text-zinc-400" /> Cambiar Contraseña
                   </h3>
                   <form onSubmit={handleChangePassword} className="space-y-4">
                      <div>
                        <label className="block text-zinc-400 text-sm mb-1">Nueva Contraseña</label>
                        <input 
                           type="password" 
                           value={newPassword}
                           onChange={e => setNewPassword(e.target.value)}
                           className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500" 
                           placeholder="********" 
                        />
                      </div>
                      <button disabled={loading} type="submit" className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl transition-all border border-white/5">
                        Actualizar Credenciales
                      </button>
                      {passMessage && <p className="text-sm font-medium text-emerald-400 mt-2">{passMessage}</p>}
                   </form>
                </div>
             </div>
          )}

        </div>

        {/* TAB: EMPRESA */}
        {activeTab === 'empresa' && empresaAsignada && (
           <div className="bg-zinc-900/50 backdrop-blur-xl border border-blue-500/20 shadow-xl shadow-blue-500/5 p-6 rounded-3xl animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
                 <div className="bg-blue-600/20 p-4 rounded-2xl">
                    <Building size={32} className="text-blue-400" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-white">{empresaAsignada.nombre_empresa}</h2>
                    <p className="text-zinc-400 text-sm">Portal Corporativo Activo</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                 <div className="bg-zinc-950/50 p-5 rounded-2xl border border-zinc-800">
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2">Descuento Asignado</p>
                    {empresaAsignada.beneficios?.activo ? (
                       <div className="flex items-center gap-2">
                          <span className="text-3xl font-black text-emerald-400">
                             {empresaAsignada.beneficios.tipo_descuento === 'PORCENTAJE' ? `${empresaAsignada.beneficios.valor}%` : `$${empresaAsignada.beneficios.valor}`}
                          </span>
                          <span className="text-emerald-500/50 text-sm">OFF</span>
                       </div>
                    ) : (
                       <p className="text-zinc-400">Sin descuentos activos.</p>
                    )}
                 </div>
                 <div className="bg-zinc-950/50 p-5 rounded-2xl border border-zinc-800">
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2">Horario Autorizado</p>
                    {empresaAsignada.beneficios?.horario_inicio ? (
                        <div className="flex items-center gap-2 text-white font-bold text-lg">
                           <span>{empresaAsignada.beneficios.horario_inicio.substring(0,5)}</span>
                           <span className="text-zinc-600">-</span>
                           <span>{empresaAsignada.beneficios.horario_fin.substring(0,5)} hs</span>
                        </div>
                    ) : (
                        <p className="text-blue-400 font-bold">24 Horas Libre</p>
                    )}
                 </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3 text-sm text-blue-200">
                 <CheckCircle2 className="text-blue-400 flex-shrink-0" />
                 <p>
                    Para utilizar tu beneficio corporativo, selecciona el botón circular <b>Modo de Viaje: Empresa</b> en la pestaña Inicio antes de solicitar tu móvil. El descuento se aplicará directamente sobre el tarifario.
                 </p>
              </div>
           </div>
        )}

        {/* TAB: CARNET DIGITAL SOCIO */}
        {activeTab === 'carnet' && (
           <div className="bg-zinc-900/50 backdrop-blur-xl border border-blue-500/20 shadow-xl shadow-blue-500/5 p-6 md:p-8 rounded-3xl animate-in fade-in duration-300 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
              
              <div className="flex flex-col items-center max-w-sm mx-auto">
                  <div className="text-center mb-8">
                      <h2 className="text-3xl font-black text-white flex justify-center items-center gap-3">
                        <Star className="text-amber-400 fill-amber-400" size={32} /> Carnet Socio
                      </h2>
                      <p className="text-zinc-400 mt-2 text-sm">Presentá tu código QR en comercios adheridos para acceder a descuentos.</p>
                  </div>

                  {/* Tarjeta Tipo Premium */}
                  <div className="relative w-full aspect-[1.586/1] bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 p-6 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 group">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/10 opacity-30 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl mix-blend-overlay"></div>
                      <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>

                      <div className="relative z-10 flex flex-col h-full justify-between">
                         <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] font-black uppercase text-amber-500/80 tracking-widest mb-1">MIEMBRO CLUB NEA</p>
                              <div className="h-1 w-8 bg-amber-500 rounded-full mb-1"></div>
                            </div>
                            <div className="p-2 bg-white/5 backdrop-blur-sm rounded-xl">
                               <Car size={20} className="text-white/80" />
                            </div>
                         </div>
                         
                         <div className="flex justify-between items-end mt-4">
                            <div>
                               <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Titular</p>
                               <p className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider">{user?.user_metadata?.nombre || 'Socio Activo'}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">SOCIO N°</p>
                               <p className="text-sm font-mono text-zinc-300 tracking-widest">{user?.id.substring(0,8).toUpperCase()}</p>
                            </div>
                         </div>
                      </div>
                  </div>

                  {/* Zona QR Dinámico */}
                  <div className="relative mt-10 w-full flex flex-col items-center">
                     <div className="absolute inset-0 bg-blue-500/5 rounded-3xl blur-xl"></div>
                     <div className="relative bg-white p-6 sm:p-8 rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.05)] flex flex-col items-center justify-center min-h-[250px] min-w-[250px] w-full max-w-[280px]">
                        {qrToken ? (
                           <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
                             <div className="p-2 border-4 border-zinc-100 rounded-xl bg-white shadow-inner">
                               <QRCode value={qrToken} size={180} bgColor="#ffffff" fgColor="#09090b" level="Q" />
                             </div>
                             <div className="mt-6 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-widest">
                                <Lock size={14} /> Token Seguro
                             </div>
                           </div>
                        ) : (
                           <div className="flex flex-col items-center justify-center text-zinc-400 gap-4">
                             <Loader2 size={36} className="animate-spin text-blue-500" />
                             <span className="text-sm font-bold uppercase tracking-widest text-center">Encriptando<br/>credencial...</span>
                           </div>
                        )}
                     </div>
                  </div>
              </div>
           </div>
        )}

        {/* COLUMNA DERECHA PERMANENTE */}
        <div className="space-y-6 lg:self-start lg:sticky lg:top-4">
          
          {/* SECCIÓN MIS PUNTOS */}
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-6 overflow-hidden relative">
             <div className="absolute -right-2 -top-2 opacity-5 pointer-events-none">
                <Calculator size={100} />
             </div>
             
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                   🎯 Mis Puntos
                </h3>
              {puntosStatus?.viajes_gratis > 0 && (
                 <span className="bg-amber-500 text-black px-3 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                    VIAJE GRATIS LISTO
                 </span>
              )}
           </div>

             <div className="space-y-4">
                <div>
                   <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-zinc-400">Progreso para viaje gratis</span>
                      <span className="text-blue-400 font-bold">{puntosStatus?.puntos_actuales || 0}/100</span>
                   </div>
                   <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, puntosStatus?.puntos_actuales || 0)}%` }}
                      ></div>
                   </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                   <div className="flex items-center gap-3">
                      <div className="bg-blue-500/10 p-2 rounded-xl">
                         <History className="text-blue-400" size={20} />
                      </div>
                      <div>
                         <p className="text-xs text-zinc-500">Puntos actuales</p>
                         <p className="text-xl font-black text-white">{puntosStatus?.puntos_actuales || 0}</p>
                      </div>
                   </div>
                   <div className="h-10 w-px bg-white/5"></div>
                   <div className="flex items-center gap-3">
                      <div className="bg-amber-500/10 p-2 rounded-xl">
                         <Car className="text-amber-500" size={20} />
                      </div>
                      <div>
                         <p className="text-xs text-zinc-500">Viajes Gratis</p>
                         <p className="text-xl font-black text-white">{puntosStatus?.viajes_gratis || 0}</p>
                      </div>
                   </div>
                </div>

                {puntosStatus?.puntos_actuales < 100 && (
                  <p className="text-xs text-zinc-500 text-center italic">
                    ¡Te faltan {100 - (puntosStatus?.puntos_actuales || 0)} puntos para tu próximo viaje gratis!
                  </p>
                )}
             </div>
          </div>

          <div className="bg-zinc-900/50 backdrop-blur-xl border border-rose-500/20 rounded-3xl p-6">
             <h3 className="text-rose-400 font-bold mb-4 flex items-center gap-2">
               🌟 Promociones Activas
             </h3>
             {promociones.length === 0 ? (
               <p className="text-zinc-500 text-sm">No hay promociones activas en este momento.</p>
             ) : (
               <div className="space-y-3">
                 {promociones.map(promo => (
                   <div key={promo.id} className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-start gap-3">
                      <div className="mt-1">🎁</div>
                      <div>
                        <p className="text-rose-200 font-bold text-sm mb-1">{promo.titulo}</p>
                        <p className="text-rose-400/70 text-xs">Aplica a todos los pedidos solicitados durante este período promocional.</p>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
          
          <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 backdrop-blur-xl border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden">
             <div className="absolute -right-4 -bottom-4 opacity-20">
                <Car size={100} />
             </div>
             <h3 className="text-white font-bold mb-2 relative z-10">Viaja Protegido</h3>
             <p className="text-zinc-300 text-sm mb-4 relative z-10">Tus viajes están monitoreados satelitalmente por la administración local.</p>
             <button onClick={handleSupportWhatsApp} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 relative z-10">
                Contactar Soporte <ChevronRight size={14} />
             </button>
          </div>
        </div>

      </div>
    </div>

    {/* OVERLAY MODAL CALIFICACIÓN */}
    {viajeACompletar && !viajeActivo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
         <div className="bg-zinc-900 border border-blue-500/30 rounded-3xl p-6 shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-500">
            <div className="text-center mb-4">
               <div className="inline-flex justify-center items-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 mb-3">
                   <Star className="fill-current" />
               </div>
               <h3 className="text-xl font-bold text-white mb-1">Calificá tu viaje</h3>
               <p className="text-sm text-zinc-400">Tu opinión nos ayuda a mejorar el servicio.</p>
            </div>
            
            <div className="flex justify-center gap-2 mb-6">
               {[1,2,3,4,5].map(star => (
                  <button 
                    key={star} 
                    onClick={() => setRatingVal(star)}
                    className={`transition-all hover:scale-110 ${star <= ratingVal ? 'text-amber-400' : 'text-zinc-600'}`}
                  >
                     <Star size={32} className={star <= ratingVal ? 'fill-amber-400' : ''} />
                  </button>
               ))}
            </div>

            <div className="mb-4">
               <div className="flex px-4 py-3 bg-black/40 border border-white/5 rounded-xl gap-3">
                  <MessageSquare className="text-zinc-500 flex-shrink-0" size={18} />
                  <textarea 
                     value={ratingComentario}
                     onChange={e => setRatingComentario(e.target.value)}
                     placeholder="Dejá un comentario (opcional)"
                     className="w-full bg-transparent text-white text-sm outline-none resize-none h-16 placeholder-zinc-500"
                  />
               </div>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => setViajeACompletar(null)} 
                 className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition"
               >
                 Saltar
               </button>
               <button 
                 onClick={handleCalificar}
                 disabled={ratingLoading} 
                 className="flex-[2] px-4 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition flex justify-center items-center gap-2"
               >
                 {ratingLoading ? <Loader2 size={18} className="animate-spin" /> : "Enviar Calificación"}
               </button>
            </div>
         </div>
      </div>
    )}

  </>
  );
}
