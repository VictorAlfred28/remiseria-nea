import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Users, Gift, MapPin, Navigation, Power, CheckCircle2, Navigation2, Settings, Lock, Loader2, Eye, EyeOff, Wallet, BellRing, XCircle, AlertTriangle, Zap, Calendar, Store, ExternalLink, Briefcase, Truck } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import MiFlotaTab from "../components/cliente/MiFlotaTab";
import { supabase } from "../lib/supabase";
import { 
    api,
    notificarAceptacionViaje, 
    finalizarViaje, 
    notificarLlegadaViaje, 
    iniciarViaje,
    cancelarViajeChofer, 
    notificarEmergencia,
    getActiveTariff,
    getReservations,
    getViajesCercanosBackend,
    getFixedDestinations
} from "../services/api";
import BilleteraChofer from "../components/BilleteraChofer";
import WeatherWidget from "../components/WeatherWidget";
import BolsaChoferTab from "../components/bolsa/BolsaChoferTab";
import { calculateDistance } from "../utils/geo";

// Componente visual puro para el timer. Previene el renderizado del parent completo.
const LocalWaitTimer = ({ isActive }: { isActive: boolean }) => {
    const [waitTimer, setWaitTimer] = useState(0);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (isActive) {
            timerRef.current = setInterval(() => {
                setWaitTimer(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setWaitTimer(0);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isActive]);

    if (!isActive) return null;

    return (
        <div className="bg-blue-950/20 p-5 rounded-xl border border-blue-500/30 text-center animate-pulse">
            <p className="text-xs font-black text-blue-400 mb-2 uppercase tracking-[0.2em]">Tiempo de Espera</p>
            <div className="text-4xl font-black text-white font-mono">
                {Math.floor(waitTimer / 60)}:{(waitTimer % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-[10px] mt-2 font-bold uppercase tracking-widest text-zinc-500">
                {waitTimer < 300 ? `Quedan ${Math.ceil((300 - waitTimer)/60)} min gratis` : <span className="text-yellow-500">Generando cargos por espera</span>}
            </p>
        </div>
    );
};

export default function ChoferDashboard() {
  const { user, roles } = useAuthStore();
  const esTitular = roles.includes('titular');
  const orgId = user?.organizacion_id;
  const [isOnline, setIsOnline] = useState(false);
  const [viajeActivo, setViajeActivo] = useState<any>(null);
  const [viajesDisponibles, setViajesDisponibles] = useState<any[]>([]);
  const [locationError, setLocationError] = useState("");
  const [acceptError, setAcceptError] = useState("");
  const [choferCoords, setChoferCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTab, setActiveTab] = useState("rutas");
  const [choferIdReal, setChoferIdReal] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [activeTariff, setActiveTariff] = useState<any>(null);
  const [fixedDestinations, setFixedDestinations] = useState<any[]>([]);
  const [choferReservas, setChoferReservas] = useState<any[]>([]);
  const [loadingChoferData, setLoadingChoferData] = useState(false);
  const [promocionesComercio, setPromocionesComercio] = useState<any[]>([]);
  const [loadingComercios, setLoadingComercios] = useState(false);
  
  // Estados para Ajustes
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatePassLoading, setUpdatePassLoading] = useState(false);
  const [updatePassMsg, setUpdatePassMsg] = useState({ text: "", type: "" });
  const [sosLoading, setSosLoading] = useState(false);
  const [configPago, setConfigPago] = useState<{ tipo: string, valor: number, dni: string, saldo: number, limite_deuda: number } | null>(null);
  const [choferNombre, setChoferNombre] = useState<string | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [lastRadarUpdate, setLastRadarUpdate] = useState<Date | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (user?.id) {
        const loadChoferProfile = async () => {
            const { data } = await supabase
                .from('choferes')
                .select('*, usuarios(nombre)')
                .eq('usuario_id', user.id)
                .single();
            if (data) {
                setChoferIdReal(data.id);
                setChoferNombre(data.usuarios?.nombre || user.user_metadata?.nombre || user.email?.split('@')[0]);
                setConfigPago({
                    tipo: data.tipo_pago,
                    valor: data.valor_pago,
                    dni: data.dni,
                    saldo: data.saldo || 0,
                    limite_deuda: data.limite_deuda || -2000
                });
            }
        };
        loadChoferProfile();
    }
  }, [user]);

  // Se eliminó waitTimer y su setInterval del root para moverlo a un sub-componente aislado
  // Esto previene que toda la pantalla (y el iframe de Google Maps) se re-dibujen 
  // 60 veces por minuto destruyendo los FPS del móvil.

  useEffect(() => {
      if (configPago) {
          setIsBlocked(configPago.saldo < configPago.limite_deuda);
      }
  }, [configPago]);

  useEffect(() => {
    if (orgId && user) {
        supabase.channel(`chofer_perfil_${user.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'choferes', filter: `usuario_id=eq.${user.id}` },
                (payload: any) => {
                    setConfigPago({
                        tipo: payload.new.tipo_pago,
                        valor: payload.new.valor_pago,
                        dni: payload.new.dni,
                        saldo: payload.new.saldo || 0,
                        limite_deuda: payload.new.limite_deuda || -2000
                    });
                }
            )
            .subscribe();

        const fetchDatosGenerales = async () => {
            const { data: b } = await supabase.from('beneficios').select('*').eq('organizacion_id', orgId).eq('activo', true);
            if (b) setBeneficios(b);

            const { data: vActivo } = await supabase.from('viajes').select('*').eq('chofer_id', choferIdReal).in('estado', ['asignado', 'ACCEPTED', 'en_camino', 'en_puerta', 'ARRIVED', 'STARTED', 'IN_PROGRESS']).maybeSingle();
            if (vActivo) setViajeActivo(vActivo);
        };
        fetchDatosGenerales();

        return () => {
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }
  }, [orgId, user, choferIdReal]);

  // Nuevo mecanismo de RADAR INTELIGENTE por polling (Backend PostGIS) + WEB SOCKETS
  useEffect(() => {
      let radarInterval: any;
      let radarChannel: any;
      let radarTimeoutId: any;

      if (isOnline && !isBlocked && choferCoords) {
          const fetchRadarData = async () => {
              setRadarLoading(true);
              try {
                  const viajesAPI = await getViajesCercanosBackend(choferCoords.lat, choferCoords.lng, 50);
                  setViajesDisponibles(viajesAPI || []);
                  setLastRadarUpdate(new Date());
              } catch (e) {
                  console.error("Error consultando radar:", e);
              } finally {
                  setRadarLoading(false);
              }
          };
          
          fetchRadarData();
          
          // Actualización cada 10 segundos como fallback
          radarInterval = setInterval(fetchRadarData, 10000);

          // Suscripción WebSockets para inmediatez ("Tiempo Real")
          radarChannel = supabase.channel('radar_choferes')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes' }, (payload) => {
                  // Optimizacion: Debounce de 1 segundo para no saturar la API
                  // si caen 50 modificaciones de viajes al mismo tiempo en la provincia.
                  if (radarTimeoutId) clearTimeout(radarTimeoutId);
                  radarTimeoutId = setTimeout(() => {
                      fetchRadarData();
                  }, 1000);
              })
              .subscribe();

      } else {
          setViajesDisponibles([]); // Limpiar viajes si se desconecta
      }
      
      return () => { 
          if (radarInterval) clearInterval(radarInterval); 
          if (radarChannel) supabase.removeChannel(radarChannel);
          if (radarTimeoutId) clearTimeout(radarTimeoutId);
      };
  }, [isOnline, isBlocked, choferCoords]);

  useEffect(() => {
      if (activeTab === "tarifas" || activeTab === "reservas") {
          fetchChoferDataConfig();
      }
      if (activeTab === "comercios") {
          fetchPromocionesComercio();
      }
  }, [activeTab]);

  const fetchPromocionesComercio = async () => {
      setLoadingComercios(true);
      try {
          const { data, error } = await supabase
              .from('promociones')
              .select('*, comercios(*)')
              .eq('organizacion_id', orgId)
              .eq('activa', true)
              .not('comercio_id', 'is', null);
          
          if (error) throw error;
          setPromocionesComercio(data || []);
      } catch (err) {
          console.error("Error al cargar promociones de comercios:", err);
      } finally {
          setLoadingComercios(false);
      }
  };

  const fetchChoferDataConfig = async () => {
      setLoadingChoferData(true);
      try {
          getActiveTariff().then((v: any) => {
            if (v) setActiveTariff(v);
          }).catch(() => {});
          getReservations('solicitado').then((r: any) => {
            setChoferReservas(r);
          }).catch(() => {});
          getFixedDestinations().then((d: any) => {
            if (d) setFixedDestinations(d);
          }).catch(() => {});
      } catch (err: any) {}
      setLoadingChoferData(false);
  };

  const toggleService = () => {
      if (isOnline) {
          if (watchIdRef.current) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
          }
          channelRef.current?.untrack();
          setIsOnline(false);
          setChoferCoords(null);
      } else {
          setLocationError("");
          setAcceptError("");
          if (!navigator.geolocation) {
              setLocationError("Tu dispositivo no soporta GPS web.");
              return;
          }

          setIsOnline(true);
          const id = navigator.geolocation.watchPosition(
              (pos: GeolocationPosition) => {
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  setChoferCoords({ lat, lng });

                  const isBusy = !!viajeActivo;
                  const payload = {
                      chofer_id: user?.id,
                      nombre: user?.email, 
                      lat,
                      lng,
                      status: isBusy ? 'busy' : 'free',
                      timestamp: new Date().toISOString()
                  };
                  channelRef.current?.track(payload);
              },
              (err: GeolocationPositionError) => {
                  setLocationError("GPS denegado. Permite el acceso e intenta de nuevo.");
                  setIsOnline(false);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
          watchIdRef.current = id;
      }
  };

  useEffect(() => {
    let logInterval: any;
    if (isOnline && choferIdReal && choferCoords && orgId) {
        const logUbicacion = async () => {
            try {
                await supabase.from('ubicaciones_logs').insert({
                    chofer_id: choferIdReal,
                    organizacion_id: orgId,
                    lat: choferCoords.lat,
                    lng: choferCoords.lng
                });
            } catch (err: any) {}
        };
        logUbicacion();
        logInterval = setInterval(logUbicacion, 60000);
    }
    return () => { if (logInterval) clearInterval(logInterval); };
  }, [isOnline, choferIdReal, (choferCoords?.lat), (choferCoords?.lng), orgId]);

  const handleAceptarViaje = async (viaje: any) => {
      if (!user) return;
      setAcceptError("");

      let cId = choferIdReal;
      if (!cId) {
          const { data: choferInfo } = await supabase
              .from('choferes')
              .select('id')
              .eq('usuario_id', user.id)
              .single();
              
          if (choferInfo) {
              cId = choferInfo.id;
              setChoferIdReal(cId);
          } else {
              setAcceptError("No tienes un perfil de chofer activo asignado.");
              return;
          }
      }

      const { data, error } = await supabase
          .from('viajes')
          .update({ 
            chofer_id: cId, 
            estado: 'ACCEPTED',
            accepted_at: new Date().toISOString()
          })
          .eq('id', viaje.id)
          .in('estado', ['solicitado', 'REQUESTED'])
          .select();

      if (error) {
          setAcceptError("Error de base de datos al aceptar el viaje: " + error.message);
          return;
      }

      if (!data || data.length === 0) {
          setAcceptError("¡Ups! Este viaje acaba de ser tomado por otro compañero.");
          setViajesDisponibles((prev: any[]) => prev.filter(v => v.id !== viaje.id));
      } else {
          try {
              await notificarAceptacionViaje(viaje.id);
          } catch (err: any) {
              console.error("No se pudo notificar al cliente vía WhatsApp", err);
          }
          setViajeActivo(data[0]);
      }
  };

  const handleFinalizarViaje = async () => {
    if (!viajeActivo) return;
    
    try {
        await finalizarViaje(viajeActivo.id);
        if (configPago && configPago.tipo === 'comision') {
            const comision = (viajeActivo.precio || 0) * (configPago.valor / 100);
            setConfigPago({ ...configPago, saldo: configPago.saldo - comision });
        }
        setViajeActivo(null);
    } catch (err: any) {
        alert("Error al finalizar el viaje: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleFinalizarReserva = async (reservaId: string) => {
    try {
        // @ts-ignore
        await api.put(`/reservations/${reservaId}/estado`, { estado: 'finalizado' });
        setChoferReservas((prev: any[]) => prev.filter((r: any) => r.id !== reservaId));
        alert("Reserva finalizada correctamente.");
    } catch (err: any) {
        alert("Error al finalizar reserva: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleNotificarLlegada = async () => {
      if (!viajeActivo) return;
      const { error } = await supabase.from('viajes').update({ 
        estado: 'ARRIVED',
        arrived_at: new Date().toISOString()
      }).eq('id', viajeActivo.id);
      
      if (error) {
          alert("Error de conexión: " + error.message);
          return;
      }
      setViajeActivo({ ...viajeActivo, estado: 'ARRIVED' });
      try {
          await notificarLlegadaViaje(viajeActivo.id);
      } catch (err: any) {
          console.error("Error al notificar llegada por WhatsApp", err);
      }
  };

  const handleIniciarViaje = async () => {
    if (!viajeActivo) return;
    try {
        await iniciarViaje(viajeActivo.id);
        const { data } = await supabase.from('viajes').select('*').eq('id', viajeActivo.id).single();
        if (data) setViajeActivo(data);
    } catch (err: any) {
        alert("Error al iniciar viaje: " + err.message);
    }
  };

  const handleCancelarViaje = async () => {
      if (!viajeActivo) return;
      if (!window.confirm("¿Seguro que deseas reportar un problema y cancelar este viaje?")) return;
      const { error } = await supabase.from('viajes').update({ estado: 'cancelado' }).eq('id', viajeActivo.id);
      if (error) {
          alert("Error de conexión al cancelar: " + error.message);
          return;
      }
      try {
          await cancelarViajeChofer(viajeActivo.id);
      } catch (err: any) {}
      setViajeActivo(null);
  };

  const handleSOS = async () => {
      if (sosLoading || !choferCoords) {
          if (!choferCoords) alert("No tenemos tu GPS para enviar el SOS.");
          return;
      }
      if (!window.confirm("🚨 ¿Confirmas emitir la ALERTA SOS? Se le notificará a la central de forma inmediata tu ubicación.")) return;
      setSosLoading(true);
      try {
          channelRef.current?.send({
              type: 'broadcast',
              event: 'sos',
              payload: {
                  lat: choferCoords.lat,
                  lng: choferCoords.lng,
                  chofer_id: choferIdReal,
                  nombre: user?.email, 
                  timestamp: new Date().toISOString()
              }
          });
          await notificarEmergencia(choferCoords.lat, choferCoords.lng);
          alert("Alerta SOS enviada correctamente a la Central.");
      } catch (e: any) {
          alert("Sucedió un problema al emitir, intenta de nuevo o llama a la policía.");
      }
      setSosLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    setUpdatePassLoading(true);
      setUpdatePassMsg({ text: "", type: "" });
      
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
          setUpdatePassMsg({ text: error.message, type: "error" });
      } else {
          setUpdatePassMsg({ text: "Contraseña actualizada correctamente", type: "success" });
          setNewPassword("");
      }
      setUpdatePassLoading(false);
  };

  return (
    <div className={`relative p-6 sm:p-8 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border backdrop-blur-xl w-full max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-700 transition-all ${isOnline ? 'bg-zinc-900/90 border-green-500/30 ring-1 ring-green-500/10' : 'bg-neutral-900/90 border-white/5'}`}>
      
      {/* DECORACIÓN FONDO (Brillo sutil) */}
      <div className={`absolute -top-24 -left-24 w-64 h-64 blur-[120px] rounded-full pointer-events-none transition-opacity duration-1000 ${isOnline ? 'bg-green-500/10 opacity-100' : 'bg-white/5 opacity-0'}`} />
      
      {isBlocked && (
          <div className="relative mb-8 bg-red-600 text-white p-5 rounded-3xl flex items-center gap-4 animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.3)] border-2 border-red-400/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] animate-[shine_2s_infinite]" />
              <AlertTriangle size={40} className="flex-shrink-0" />
              <div>
                  <p className="font-black text-xl leading-tight tracking-tight uppercase">Cuenta Bloqueada</p>
                  <p className="text-sm opacity-90 font-medium">Límite de deuda superado (${configPago?.saldo.toFixed(0)}). Regulariza tu situación.</p>
              </div>
          </div>
      )}
      
      {/* HEADER PREMIUM */}
      <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 pb-8 border-b border-white/5 gap-6">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-3">
               <div className={`p-2 rounded-xl ${isOnline ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400'} transition-colors duration-500`}>
                  <Zap size={24} fill="currentColor" />
               </div>
               <h1 className="text-4xl font-black text-white tracking-tighter">
                  Viajes <span className={isOnline ? "text-green-500" : "text-zinc-500"}>NEA</span>
               </h1>
            </div>
            <p className="text-xs font-bold text-zinc-400 mt-2 tracking-[0.2em] max-w-[250px] truncate uppercase sm:ml-11">¡Hola, {choferNombre}!</p>
            <div className="sm:ml-10 w-full animate-in fade-in slide-in-from-left-4 duration-700">
               <WeatherWidget />
            </div>
          </div>
          
          <button 
            onClick={isBlocked ? () => alert("Tu cuenta está bloqueada por deuda. Debes saldar con administración para volver online.") : toggleService}
            className={`
              relative group flex w-full sm:w-auto justify-center items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm tracking-widest transition-all duration-300 active:scale-95 overflow-hidden
              ${isBlocked 
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                : (isOnline 
                    ? 'bg-green-500 text-black shadow-[0_0_25px_rgba(34,197,94,0.4)] hover:bg-green-400 hover:shadow-green-400/60' 
                    : 'bg-white text-black hover:bg-zinc-200 shadow-xl shadow-white/5')}
            `}
          >
              <Power size={20} className={isOnline ? "animate-pulse" : ""} /> 
              {isOnline ? "FINALIZAR TURNO" : "COMENZAR TURNO"}
          </button>
      </div>
      
      {locationError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-500 px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-2">
              <XCircle size={20} />
              {locationError}
          </div>
      )}

      {acceptError && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in zoom-in-95">
              <AlertTriangle size={20} />
              {acceptError}
          </div>
      )}

      {/* ESTADO VISUAL LIVE */}
      <div className={`relative mb-10 p-5 flex items-center gap-4 rounded-3xl border transition-all duration-700 ${isOnline ? 'bg-green-500/5 border-green-500/20 text-green-400 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]' : 'bg-zinc-950/30 border-white/5 text-zinc-500'}`}>
          <div className="relative flex h-5 w-5">
            {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40"></span>}
            <span className={`relative inline-flex rounded-full h-5 w-5 border-2 ${isOnline ? 'bg-green-500 border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-zinc-700 border-zinc-600'}`}></span>
          </div>
          <p className="font-bold text-sm tracking-tight">{isOnline ? "CONECTADO: TRANSMITIENDO SEÑAL GPS EN VIVO" : "DESCONECTADO: SEÑAL DE RADAR INACTIVA"}</p>
      </div>

      {/* GRID DE NAVEGACIÓN PREMIUM (Resolución de Ajustes Fuera del Marco) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
        {[
          { id: 'rutas', icon: Navigation, label: 'Solicitudes', badge: isOnline && viajesDisponibles.length > 0 ? viajesDisponibles.length : 0, color: 'text-green-400' },
          { id: 'reservas', icon: Calendar, label: 'Reservas', color: 'text-blue-400' },
          { id: 'caja', icon: Wallet, label: 'Mi Caja', color: 'text-emerald-400' },
          { id: 'tarifas', icon: Zap, label: 'Tarifario', color: 'text-yellow-400' },
          { id: 'comercios', icon: Store, label: 'Comercios', color: 'text-orange-400' },
          { id: 'bolsa', icon: Briefcase, label: 'Bolsa', color: 'text-blue-500' },
          { id: 'premios', icon: Gift, label: 'Premios', color: 'text-purple-400' },
          ...(esTitular ? [{ id: 'flota', icon: Truck, label: 'Mi Flota', color: 'text-orange-400' }] : []),
          { id: 'ajustes', icon: Settings, label: 'Ajustes', color: 'text-zinc-400' },
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 group overflow-hidden
              ${activeTab === tab.id 
                ? 'bg-zinc-800/80 border-green-500/50 shadow-[0_15px_30px_-10px_rgba(34,197,94,0.15)] ring-1 ring-green-500/20 transform scale-[1.02]' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-800/40 hover:border-white/10'}
            `}
          >
            <tab.icon size={26} className={`mb-2.5 transition-all duration-300 ${activeTab === tab.id ? tab.color : 'text-zinc-500 group-hover:text-zinc-300 group-hover:scale-110'}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === tab.id ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`}>{tab.label}</span>
            
            {tab.badge > 0 && (
              <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20 animate-bounce border-2 border-zinc-900">
                {tab.badge}
              </span>
            )}
            
            {activeTab === tab.id && (
              <div className="absolute inset-x-4 bottom-2 h-1 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            )}
          </button>
        ))}
      </div>

      <div className="relative bg-zinc-950/40 backdrop-blur-sm p-6 sm:p-8 rounded-[2rem] border border-white/5 shadow-inner transition-all duration-500">
        {/* LUZ DE FONDO PARA EL CONTENIDO */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-tr-[2rem] pointer-events-none" />
        {activeTab === "tarifas" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-xl font-bold mb-4 text-blue-400 flex items-center gap-2"><Zap size={20}/> Tarifario Oficial IA</h2>
                <p className="text-zinc-400 mb-6 text-sm">Estos son los valores oficiales que nuestra Inteligencia Artificial le cotiza a los clientes.</p>
                {loadingChoferData ? <Loader2 className="animate-spin text-zinc-500 mx-auto"/> : (activeTariff || fixedDestinations.length > 0) ? (
                    <div className="flex flex-col gap-6">
                        {(activeTariff || fixedDestinations.length > 0) && (
                            <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl flex flex-col gap-6 shadow-xl">
                               <h3 className="font-bold text-white text-lg border-b border-zinc-800 pb-2 flex items-center gap-2"><Zap className="text-yellow-500"/> VALORES DE REFERENCIA</h3>
                               
                               {/* Tarjetas de Métricas de Valores */}
                               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                                   <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center hover:border-green-500/30 transition-colors">
                                       <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">Tarifa Mínima</p>
                                       <p className="text-green-400 font-black text-xl sm:text-2xl">${(activeTariff?.base_fare || 2500).toLocaleString('es-AR')}</p>
                                   </div>
                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center hover:border-green-500/30 transition-colors">
                                       <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">Fracción {activeTariff?.fraction_km || 0.1} KM</p>
                                       <p className="text-green-400 font-black text-xl sm:text-2xl">${(activeTariff?.per_fraction_price || 175).toLocaleString('es-AR')}</p>
                                   </div>
                                   <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center hover:border-green-500/30 transition-colors">
                                       <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">Espera 10 Min.</p>
                                       <p className="text-green-400 font-black text-xl sm:text-2xl">${(activeTariff?.wait_block_price || 2500).toLocaleString('es-AR')}</p>
                                   </div>
                                   <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center hover:border-green-500/30 transition-colors">
                                       <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-1">Costo de Baúl</p>
                                       <p className="text-green-400 font-black text-xl sm:text-2xl">${(activeTariff?.trunk_price || 2500).toLocaleString('es-AR')}</p>
                                   </div>
                               </div>

                               {/* Tabla Dinámica (Grid Card) */}
                               <div className="mt-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800">
                                  <h4 className="text-white font-bold uppercase text-xs tracking-widest mb-4 flex items-center justify-between border-b border-zinc-800 pb-2">
                                      <span>TABLA COMPLETA POR KM RATE</span>
                                      <span className="text-[10px] text-zinc-500 font-normal px-2 py-0.5 rounded-full bg-zinc-900">Distancia Exacta</span>
                                  </h4>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[500px] overflow-y-auto scroll-smooth pr-1">
                                      {(() => {
                                          const table = [];
                                          const fraction = activeTariff?.fraction_km || 0.1;
                                          const base_fare = activeTariff?.base_fare || 2500;
                                          const fraction_price = activeTariff?.per_fraction_price || 175;

                                          for (let d = 1.0; d <= 20.0; d += fraction) {
                                              const fractions = Math.round((d - 1.0) / fraction);
                                              const price = base_fare + (fractions * fraction_price);
                                              table.push(
                                                  <div key={d.toFixed(1)} className="flex items-center justify-between bg-zinc-900 px-3 py-2.5 rounded-lg border border-zinc-800 hover:border-green-500/50 hover:bg-green-500/5 transition-all group">
                                                      <span className="text-zinc-400 font-bold text-xs uppercase group-hover:text-white transition-colors">{d.toFixed(1).replace('.', ',')} KM</span>
                                                      <span className="text-green-400 font-black text-sm">${price.toLocaleString('es-AR')}</span>
                                                  </div>
                                              );
                                          }
                                          return table;
                                      })()}
                                  </div>
                               </div>
                            </div>
                        )}

                        {fixedDestinations.length > 0 && (
                            <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
                               <h3 className="font-bold text-white text-lg border-b border-zinc-800 pb-2 flex items-center gap-2"><MapPin className="text-red-400"/> ZONAS DE PRECIO FIJO</h3>
                               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto scroll-smooth pr-1">
                                  {fixedDestinations.map((dest: any) => (
                                     <div key={dest.id} className="flex justify-between items-center bg-zinc-950 p-4 rounded-xl border border-zinc-700/50 hover:border-zinc-500 transition-colors">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">{dest.name} {dest.peaje && <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-1 text-[10px]">C/PEAJE</span>}</span>
                                        <span className="text-white font-black text-sm">${dest.price?.toLocaleString('es-AR')}</span>
                                     </div>
                                  ))}
                               </div>
                            </div>
                        )}
                    </div>
                ) : <p className="text-zinc-500 italic text-center py-6">Tarifario no configurado por la administración.</p>}
            </div>
        )}

        {activeTab === "reservas" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Calendar size={20} className="text-blue-500"/> Reservas Programadas</h2>
                <p className="text-zinc-400 mb-6 text-sm">Viajes futuros que el sistema pronto despachará. Estate atento para tomarlos.</p>
                
                <div className="space-y-4">
                    {loadingChoferData ? <Loader2 className="animate-spin tracking-widest text-zinc-500 mx-auto"/> : choferReservas.length === 0 ? (
                        <p className="text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-xl">No hay reservas pendientes de despachar.</p>
                    ) : choferReservas.map((r: any) => (
                        <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                            <div className="flex justify-between items-start mb-2 border-b border-zinc-800 pb-2">
                                <span className="font-bold text-white text-lg">{new Date(r.fecha_viaje).toLocaleDateString()} a las <span className="text-blue-400">{r.hora_viaje.substring(0,5)}hs</span></span>
                                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-blue-500/30">Próximamente</span>
                            </div>
                            <p className="text-sm font-medium text-white flex items-center gap-2 mt-3"><MapPin size={14} className="text-red-400"/> {r.origen}</p>
                            <p className="text-sm font-medium text-zinc-400 flex items-center gap-2 mt-1"><Navigation size={14} className="text-green-500"/> {r.destino}</p>
                            <div className="bg-zinc-950 p-2 rounded flex flex-col gap-2 mt-3 text-center">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Pasajero: {r.nombre_cliente}</span>
                                <button 
                                    onClick={() => handleFinalizarReserva(r.id)}
                                    className="text-[10px] font-black bg-blue-600/20 text-blue-400 border border-blue-500/30 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all uppercase tracking-tighter"
                                >
                                    Confirmar Despacho
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === "rutas" && (
          <div className="space-y-6">
            {viajeActivo && (
                // PANTALLA DE VIAJE EN CURSO 
                <div className="bg-gradient-to-b from-green-950/40 to-zinc-900 border-2 border-green-500/40 p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="text-center mb-6">
                        <span className="bg-green-500/20 text-green-400 font-bold px-4 py-1.5 rounded-full text-sm uppercase tracking-wide border border-green-500/30 inline-block mb-3 animate-pulse">
                            Viaje en Curso
                        </span>
                        <h2 className="text-2xl font-black text-white">Navegando al Destino</h2>
                        <p className="text-zinc-400 mt-1">
                            El pasajero te está esperando.
                            {viajeActivo.origen?.cliente_telefono && ` (📱 ${viajeActivo.origen.cliente_telefono})`}
                        </p>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                            <p className="text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-widest">Punto de Origen</p>
                            <p className="text-lg text-white font-medium flex items-center gap-2">
                                <MapPin className="text-red-400" size={20} />
                                {viajeActivo.origen?.direccion || "Origen"}
                            </p>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                            <p className="text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-widest">Punto de Destino</p>
                            <p className="text-lg text-white font-medium flex items-center gap-2">
                                <Navigation className="text-green-400" size={20} />
                                {viajeActivo.destino?.direccion || "Destino"}
                            </p>
                        </div>
                        
                        {/* CRONOMETRO DE ESPERA v2.0 - Aisaldo de render principal */}
                        <LocalWaitTimer isActive={viajeActivo.estado === 'ARRIVED'} />

                        <div className="bg-green-950/20 p-4 rounded-xl border border-green-500/20 text-center">
                            <p className="text-sm font-semibold text-green-500 mb-1 uppercase tracking-widest">Cotización Estimada</p>
                            <p className="text-2xl text-green-400 font-black">
                                ${viajeActivo.precio}
                            </p>
                            {viajeActivo.estado === 'STARTED' && (
                                <p className="text-[10px] text-zinc-500 uppercase font-bold mt-1">El precio se ajustará al finalizar</p>
                            )}
                        </div>

                        {viajeActivo.usado_viaje_gratis && (
                            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-center shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse">
                                <p className="text-amber-500 font-black text-lg tracking-tighter flex items-center justify-center gap-2">
                                    🎁 VIAJE GRATIS (COSTO $0)
                                </p>
                                <p className="text-amber-500/70 text-[10px] font-bold uppercase mt-1">Beneficio por fidelidad del pasajero</p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        {viajeActivo.origen?.lat && viajeActivo.destino?.lat && (
                            <>
                                <div className="w-full h-48 rounded-xl overflow-hidden border border-zinc-800 shadow-inner my-2">
                                    <iframe 
                                        width="100%" 
                                        height="100%" 
                                        frameBorder="0" 
                                        style={{ border: 0 }} 
                                        allowFullScreen 
                                        loading="lazy"
                                        src={`https://maps.google.com/maps?saddr=${viajeActivo.origen.lat},${viajeActivo.origen.lng}&daddr=${viajeActivo.destino.lat},${viajeActivo.destino.lng}&output=embed`}
                                    ></iframe>
                                </div>
                                <a 
                                    href={`https://www.google.com/maps/dir/?api=1&origin=${viajeActivo.origen.lat},${viajeActivo.origen.lng}&destination=${viajeActivo.destino.lat},${viajeActivo.destino.lng}&travelmode=driving`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full bg-blue-600 hover:bg-blue-500 flex justify-center items-center gap-2 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                                >
                                    <Navigation2 size={20} /> ABRIR EN APP MAPS
                                </a>
                            </>
                        )}
                        
                        <div className="grid grid-cols-2 gap-3 mt-2">
                           {viajeActivo.estado === 'ACCEPTED' || viajeActivo.estado === 'asignado' || viajeActivo.estado === 'en_camino' ? (
                               <button 
                                   onClick={handleNotificarLlegada}
                                   className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 flex justify-center items-center gap-2 text-white font-bold py-4 rounded-xl transition-all shadow-lg"
                               >
                                   <BellRing size={18} /> AVISAR LLEGADA
                               </button>
                           ) : viajeActivo.estado === 'ARRIVED' ? (
                               <button 
                                   onClick={handleIniciarViaje}
                                   className="w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 flex justify-center items-center gap-2 text-black font-black py-4 rounded-xl transition-all shadow-lg shadow-yellow-500/20"
                               >
                                   <Navigation size={18} /> INICIAR VIAJE
                               </button>
                           ) : (
                               <button 
                                   disabled
                                   className="w-full bg-green-900/50 text-green-300 opacity-60 flex justify-center items-center gap-2 font-bold py-4 rounded-xl cursor-default"
                                >
                                   <CheckCircle2 size={18} /> EN TRAMO (VIAJANDO)
                               </button>
                           )}
                           
                           <button 
                               onClick={handleCancelarViaje}
                               className="w-full bg-red-950/40 hover:bg-red-900 border border-red-900/50 active:scale-95 flex justify-center items-center gap-2 text-red-400 font-bold py-4 rounded-xl transition-all"
                           >
                               <XCircle size={18} /> CANCELAR
                           </button>
                        </div>
                        
                        <button 
                            disabled={viajeActivo.estado === 'ACCEPTED' || viajeActivo.estado === 'ARRIVED'}
                            onClick={handleFinalizarViaje}
                            className={`w-full mt-2 flex justify-center items-center gap-2 font-black py-5 rounded-xl transition-all shadow-xl text-lg uppercase ${
                                (viajeActivo.estado === 'ACCEPTED' || viajeActivo.estado === 'ARRIVED')
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                                : 'bg-green-500 hover:bg-green-400 text-black shadow-green-500/30'
                            }`}
                        >
                            <CheckCircle2 size={24} /> FINALIZAR VIAJE Y CALCULAR
                        </button>
                    </div>
                </div>
            )}

            {/* PANTALLA DE RADAR DE VIAJES PENDIENTES */}
            <div className="pt-4 border-t border-white/5">
                <h2 className="text-xl font-bold mb-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span>Radar de Solicitudes</span>
                        {isOnline && (
                             <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                {radarLoading ? (
                                    <Loader2 size={10} className="animate-spin text-blue-400" />
                                ) : (
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                )}
                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                                    {radarLoading ? 'Buscando...' : 'Activo'}
                                </span>
                             </div>
                        )}
                    </div>
                    {viajeActivo && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-lg uppercase tracking-widest font-black ring-1 ring-yellow-500/30">Ocupado</span>}
                </h2>
                
                {isBlocked ? (
                    <div className="bg-zinc-900/50 border-2 border-dashed border-red-900/30 p-12 rounded-3xl text-center space-y-4">
                        <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/20">
                            <Lock size={40} className="text-red-500" />
                        </div>
                        <h3 className="text-2xl font-black text-white">Radar Deshabilitado</h3>
                        <p className="text-zinc-400 max-w-md mx-auto">
                            No puedes recibir solicitudes de viajes mientras tu cuenta esté bloqueada por deuda. Regulariza tu situación en la oficina para volver a trabajar.
                        </p>
                    </div>
                ) : !isOnline ? (
                    <p className="text-zinc-500 py-6 text-center text-sm border border-dashed border-zinc-800 rounded-xl">Inicia tu turno para buscar viajes locales.</p>
                ) : (
                <div className="space-y-4">
                    {viajesDisponibles.length === 0 ? (
                        <p className="text-zinc-500 py-6 text-center text-sm border border-dashed border-zinc-800 rounded-xl">No hay viajes disponibles por ahora.</p>
                    ) : (
                        viajesDisponibles.map((viaje: any) => {
                            const distancia = (choferCoords && viaje.origen?.lat) ? 
                                calculateDistance(choferCoords.lat, choferCoords.lng, viaje.origen.lat, viaje.origen.lng) 
                                : "N/A ";
                            
                            // Lógica de cercanía al destino si está ocupado
                            let distancia_destino = null;
                            if (viajeActivo && viajeActivo.destino?.lat && viaje.origen?.lat) {
                                distancia_destino = calculateDistance(viajeActivo.destino.lat, viajeActivo.destino.lng, viaje.origen.lat, viaje.origen.lng);
                            }

                            return (
                                <div key={viaje.id} className={`bg-zinc-900 border ${distancia_destino !== null && parseFloat(distancia_destino) < 2 ? 'border-blue-500/40' : 'border-zinc-800'} p-5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-zinc-700 animate-in slide-in-from-top-4 fade-in duration-300`}>
                                    <div className="w-full">
                                        <div className="flex justify-between w-full items-start">
                                            <p className="font-bold text-lg text-white flex items-center gap-2">
                                                <MapPin size={18} className="text-red-400"/> {viaje.origen?.direccion || "Origen Desconocido"}
                                            </p>
                                            <div className="flex flex-col items-end">
                                                <p className={`font-bold px-3 py-1 rounded-full text-sm flex-shrink-0 ${viaje.usado_viaje_gratis ? 'bg-amber-500 text-black' : 'bg-green-950/40 text-green-400'}`}>
                                                    {viaje.usado_viaje_gratis ? '🎁 GRATIS' : `$${viaje.precio}`}
                                                </p>
                                                {viaje.usado_viaje_gratis && <span className="text-[9px] text-amber-500 font-bold mt-1 uppercase">Puntos Cliente</span>}
                                            </div>
                                        </div>
                                        <p className="text-zinc-400 text-sm mt-2 flex items-center gap-2">
                                            <Navigation size={14}/> Destino: {viaje.destino?.direccion || "A confirmar"}
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <p className="text-yellow-500/90 text-[10px] font-bold bg-yellow-950/30 inline-block px-2 py-1 rounded-md uppercase tracking-wider">
                                                📍 A {distancia} Km de ti
                                            </p>
                                            {distancia_destino !== null && (
                                                <p className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${parseFloat(distancia_destino) < 2 ? 'bg-blue-900/40 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                    🏁 A {distancia_destino} Km de tu destino
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (viajeActivo) {
                                                if (!window.confirm("Ya tienes un viaje activo. ¿Deseas aceptar este como tu próximo viaje? Se notificará al pasajero.")) return;
                                            }
                                            handleAceptarViaje(viaje);
                                        }}
                                        className="w-full sm:w-auto mt-2 sm:mt-0 bg-white hover:bg-zinc-200 text-black font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-white/10 active:scale-95 whitespace-nowrap"
                                    >
                                        Aceptar Viaje
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
            </div>
          </div>
        )}

        {activeTab === "caja" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
             <BilleteraChofer />
          </div>
        )}
        
        {activeTab === "comercios" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold mb-4 text-orange-400 flex items-center gap-2"><Store size={20}/> Comercios Adheridos</h2>
            <p className="text-zinc-400 mb-6 text-sm">Descuentos y beneficios exclusivos para choferes en el centro comercial de la ciudad.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 {loadingComercios ? (
                     <div className="col-span-full py-12 flex justify-center">
                        <Loader2 className="animate-spin text-orange-500" size={40} />
                     </div>
                 ) : promocionesComercio.length === 0 ? (
                     <div className="col-span-1 sm:col-span-2 text-center opacity-40 p-12 border border-dashed border-zinc-700 rounded-3xl my-4 bg-zinc-900/40">
                        <Store size={64} className="mx-auto mb-4 text-zinc-600" />
                        <p className="text-sm font-bold uppercase tracking-widest">No hay comercios con promociones activas.</p>
                     </div>
                 ) : (
                     promocionesComercio.map((promo: any) => (
                         <div key={promo.id} className="relative bg-zinc-900/80 border border-white/5 p-6 rounded-[2rem] shadow-2xl overflow-hidden group hover:border-orange-500/30 transition-all duration-500">
                             {/* Badge de Descuento */}
                             <div className="absolute top-4 right-4 bg-orange-500 text-black font-black text-xs px-3 py-1.5 rounded-full shadow-lg z-10">
                                 {promo.tipo_descuento === 'porcentaje' ? `${promo.valor_descuento}% OFF` : `$${promo.valor_descuento} OFF`}
                             </div>

                             {/* Logo del Comercio */}
                             <div className="flex items-center gap-4 mb-6">
                                 <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
                                     {promo.comercios?.logo_url ? (
                                         <img src={promo.comercios.logo_url} alt={promo.comercios.nombre_comercio} className="w-full h-full object-cover" />
                                     ) : (
                                         <Store size={28} className="text-zinc-500" />
                                     )}
                                 </div>
                                 <div>
                                     <h3 className="font-black text-white text-lg tracking-tight leading-tight">{promo.comercios?.nombre_comercio || 'Comercio'}</h3>
                                     <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em]">{promo.comercios?.rubro || 'General'}</p>
                                 </div>
                             </div>

                             <div className="space-y-3 mb-6">
                                 <h4 className="font-bold text-white text-md leading-snug">{promo.titulo}</h4>
                                 <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed">{promo.descripcion}</p>
                                 <Link to={`/promocion/${promo.id}`} className="text-orange-500 hover:text-orange-400 text-xs font-bold transition-all inline-flex items-center gap-1 group/btn">
                                     Ver más detalles <ChevronRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                 </Link>
                             </div>

                             <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                                 <div className="flex gap-2">
                                     {promo.instagram_url && (
                                         <a href={promo.instagram_url} target="_blank" rel="noreferrer" className="p-2 bg-zinc-800 rounded-xl hover:bg-orange-500/20 hover:text-orange-400 transition-all text-zinc-500">
                                             <ExternalLink size={18} />
                                         </a>
                                     )}
                                     {promo.facebook_url && (
                                         <a href={promo.facebook_url} target="_blank" rel="noreferrer" className="p-2 bg-zinc-800 rounded-xl hover:bg-orange-500/20 hover:text-orange-400 transition-all text-zinc-500">
                                             <ExternalLink size={18} />
                                         </a>
                                     )}
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <MapPin size={12} className="text-zinc-500" />
                                     <span className="text-[10px] font-bold text-zinc-500 uppercase truncate max-w-[120px]">
                                         {promo.comercios?.direccion || 'S/D'}
                                     </span>
                                 </div>
                             </div>

                             {/* Fondo decorativo hover */}
                             <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                         </div>
                     ))
                 )}
            </div>
          </div>
        )}

        {activeTab === "premios" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold mb-4 text-purple-400 flex items-center gap-2"><Gift size={20}/> Tus Beneficios</h2>
            <p className="text-zinc-400 mb-6 text-sm">Estas son las recompensas y acuerdos exclusivos habilitados por tu empresa en comercios adheridos.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {beneficios.length === 0 ? (
                     <div className="col-span-1 sm:col-span-2 text-center opacity-40 p-8 border border-dashed border-zinc-700 rounded-xl my-4">
                        <Gift size={48} className="mx-auto mb-4 text-zinc-600" />
                        <p className="text-sm">No hay beneficios disponibles en este momento.</p>
                     </div>
                 ) : (
                     beneficios.map((ben: any) => (
                         <div key={ben.id} className="bg-gradient-to-br from-purple-900/40 to-zinc-900 border border-purple-800/30 p-5 rounded-2xl shadow-xl hover:border-purple-500/40 transition-colors relative overflow-hidden group flex flex-col">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                             <h3 className="font-bold text-white mb-1 text-lg">{ben.titulo}</h3>
                             <p className="text-sm text-purple-200 leading-relaxed mb-6">{ben.descripcion}</p>
                             <div className="flex items-center justify-between mt-auto">
                                 <div className="text-xs font-bold text-purple-400 bg-purple-950/40 border border-purple-500/20 px-2 py-1.5 rounded">
                                     {ben.puntos_requeridos > 0 ? `${ben.puntos_requeridos} PUNTOS` : 'GRATUITO'}
                                 </div>
                                 <button className="text-xs font-bold uppercase disabled bg-purple-600/50 px-3 py-1.5 rounded-lg text-white flex items-center gap-1 shadow-lg shadow-purple-900/50"><CheckCircle2 size={14}/> Disponible</button>
                             </div>
                         </div>
                     ))
                 )}
            </div>
          </div>
        )}

        {activeTab === "bolsa" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <BolsaChoferTab />
          </div>
        )}

        {activeTab === "ajustes" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Settings size={20}/> Ajustes y Seguridad</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
               {/* Card Datos Personales */}
               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Users size={18} className="text-emerald-400" /> Perfil del Conductor
                  </h3>
                  <p className="text-zinc-400 text-sm mb-6">Información registrada en la flota.</p>
                  
                  <div className="space-y-4">
                      <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                          <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Nombre Completo</p>
                          <p className="text-white font-medium">{choferNombre || 'Cargando...'}</p>
                      </div>
                      <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                          <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Documento (DNI)</p>
                          <p className="text-blue-400 font-mono font-bold tracking-widest">{configPago?.dni || 'Sin registrar'}</p>
                      </div>
                  </div>
               </div>

               {/* Card Cambio de Clave */}
               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Lock size={18} className="text-blue-400" /> Cambiar Contraseña
                  </h3>
                  <p className="text-zinc-400 text-sm mb-4">Actualiza tu contraseña periódicamente por seguridad. Asegurate de usar al menos 6 caracteres.</p>

                  {updatePassMsg.text && (
                    <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${updatePassMsg.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-green-500/10 text-green-400 border border-green-500/30'}`}>
                       {updatePassMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                       <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Nueva Contraseña</label>
                       <div className="relative">
                         <input 
                            type={showPassword ? "text" : "password"}
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 pr-12 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
                         />
                         <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                         >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                         </button>
                       </div>
                    </div>
                    <button 
                       type="submit"
                       disabled={updatePassLoading || newPassword.length < 6}
                       className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2"
                    >
                       {updatePassLoading ? <Loader2 size={18} className="animate-spin" /> : "Actualizar Contraseña"}
                    </button>
                  </form>
               </div>
            </div>
        )}

        {/* TAB: MI FLOTA — Solo visible si el chofer también es titular */}
        {activeTab === "flota" && esTitular && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <MiFlotaTab />
          </div>
        )}
      </div>

      {/* BOTÓN DE PÁNICO SOS FLOTANTE */}
      {isOnline && (
          <button
              onClick={handleSOS}
              disabled={sosLoading}
              title="Emitir Alerta SOS a la Central"
              className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[999] group bg-red-600 text-white p-5 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:bg-red-500 hover:scale-110 active:scale-95 transition-all outline-none flex items-center justify-center disabled:opacity-50 border-2 border-red-400/50"
          >
              <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20 group-hover:opacity-40" />
              <AlertTriangle size={32} className="relative z-10" />
          </button>
      )}
    </div>
  );
}
