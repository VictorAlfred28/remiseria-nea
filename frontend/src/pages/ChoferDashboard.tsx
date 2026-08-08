import { API_BASE_URL } from '../config';
import React, { useState, useEffect, useRef } from "react";
import { Link, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Users, Gift, MapPin, Navigation, Power, CheckCircle2, Navigation2, Settings, Lock, Loader2, Eye, EyeOff, Wallet, BellRing, XCircle, AlertTriangle, Zap, Calendar, Store, ExternalLink, Briefcase, Truck, ArrowLeft } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import MiFlotaTab from "../components/cliente/MiFlotaTab";
import SolicitudesPage from "./chofer/SolicitudesPage";
import ReservasPage from "./chofer/ReservasPage";
import CajaPage from "./chofer/CajaPage";
import TarifarioPage from "./chofer/TarifarioPage";
import ComerciosPage from "./chofer/ComerciosPage";
import BolsaPage from "./chofer/BolsaPage";
import PremiosPage from "./chofer/PremiosPage";
import AjustesChoferPage from "./chofer/AjustesChoferPage";
import FlotaPage from "./chofer/FlotaPage";
import { Geolocation } from '@capacitor/geolocation';
import { registerPlugin } from '@capacitor/core';
const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation');
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
import BeneficiosModal from "../components/chofer/BeneficiosModal";

export default function ChoferDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMainPage = location.pathname === '/chofer' || location.pathname === '/chofer/';
  const { user, roles, orgId } = useAuthStore();
  const esTitular = roles.includes('titular');
  const [isOnline, setIsOnline] = useState(false);
  const [viajeActivo, setViajeActivo] = useState<any>(null);
  const [viajesDisponibles, setViajesDisponibles] = useState<any[]>([]);
  const [locationError, setLocationError] = useState("");
  const [acceptError, setAcceptError] = useState("");
  const [choferCoords, setChoferCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [choferIdReal, setChoferIdReal] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [activeTariff, setActiveTariff] = useState<any>(null);
  const [fixedDestinations, setFixedDestinations] = useState<any[]>([]);
  const [choferReservas, setChoferReservas] = useState<any[]>([]);
  const [loadingChoferData, setLoadingChoferData] = useState(false);
  const [promocionesComercio, setPromocionesComercio] = useState<any[]>([]);
  const [loadingComercios, setLoadingComercios] = useState(false);
  const [showBeneficiosModal, setShowBeneficiosModal] = useState(false);
  
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
  
  const watchIdRef = useRef<any>(null);
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
            // La tabla 'beneficios' no existe en prod — usar 'promociones' con columnas reales
            if (orgId) {
                const { data: b, error: bErr } = await supabase
                    .from('promociones')
                    .select('id, titulo, descripcion, puntos_requeridos, tipo_descuento, valor_descuento, activa, creado_en')
                    .eq('organizacion_id', orgId)
                    .eq('activa', true)
                    .order('creado_en', { ascending: false });
                if (bErr) {
                    console.error('[ChoferDashboard] Error cargando premios:', bErr.message);
                } else if (b) {
                    setBeneficios(b);
                }
            }

            const { data: vActivo } = await supabase.from('viajes').select('*').eq('chofer_id', choferIdReal).in('estado', ['ACEPTADO', 'EN_PUERTA', 'INICIADO']).maybeSingle();
            if (vActivo) setViajeActivo(vActivo);
        };
        fetchDatosGenerales();

        return () => {
            if (watchIdRef.current) Geolocation.clearWatch({ id: watchIdRef.current });
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
      if (location.pathname.includes("tarifas") || location.pathname.includes("reservas")) {
          fetchChoferDataConfig();
      }
      if (location.pathname.includes("comercios")) {
          fetchPromocionesComercio();
      }
  }, [location.pathname]);

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
          getReservations('SOLICITADO').then((r: any) => {
            setChoferReservas(r);
          }).catch(() => {});
          getFixedDestinations().then((d: any) => {
            if (d) setFixedDestinations(d);
          }).catch(() => {});
      } catch (err: any) {}
      setLoadingChoferData(false);
  };

  const toggleService = async () => {
      if (isOnline) {
          setIsOnline(false);
          if (watchIdRef.current) {
              BackgroundGeolocation.removeWatcher({ id: watchIdRef.current });
              watchIdRef.current = null;
          }
          channelRef.current?.untrack();
          setIsOnline(false);
          setChoferCoords(null);
      } else {
          setLocationError("");
          setAcceptError("");

          try {
              const check = await Geolocation.checkPermissions();
              if (check.location !== 'granted') {
                  const req = await Geolocation.requestPermissions();
                  if (req.location !== 'granted') {
                      setLocationError("Debes permitir acceso a tu ubicación para comenzar tu turno.");
                      return;
                  }
              }
          } catch (e) {
              console.warn("Capacitor Geolocation error on permissions:", e);
          }

          setIsOnline(true);
          
          if (!channelRef.current && orgId) {
              channelRef.current = supabase.channel(`tracking:${orgId}`);
              channelRef.current.subscribe();
          }
          
          try {
              const watcherId = await BackgroundGeolocation.addWatcher(
                  { 
                      backgroundMessage: "Compartiendo ubicación con Ubi Integral", 
                      backgroundTitle: "Viajes activos", 
                      requestPermissions: true, 
                      stale: false, 
                      distanceFilter: 10
                  },
                  (pos: any, err: any) => {
                      if (err) {
                          if (err.message?.toLowerCase().includes("denied") || err.code === 1) {
                              setLocationError("Debes permitir acceso a tu ubicación para comenzar tu turno.");
                              setIsOnline(false);
                          } else {
                              console.warn("GPS Error:", err);
                          }
                          return;
                      }

                      if (pos) {
                          const lat = pos.latitude || pos.coords?.latitude;
                          const lng = pos.longitude || pos.coords?.longitude;
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
                      }
                  }
              );
              watchIdRef.current = watcherId;
          } catch (error) {
              setLocationError("Error al iniciar servicio GPS.");
              setIsOnline(false);
          }
      }
  };

  useEffect(() => {
    let logInterval: any;
    if (isOnline && choferIdReal && choferCoords && orgId) {
        const updateUbicacion = async () => {
            try {
                // 1. Actualizar la tabla choferes (para que titulares vean en tiempo real)
                const apiUrl = API_BASE_URL;
                const token = sessionStorage.getItem('sb-access-token');
                await fetch(`${apiUrl}/chofer/ubicacion/actualizar?lat=${choferCoords.lat}&lng=${choferCoords.lng}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                // 2. También guardar en ubicaciones_logs para histórico
                await supabase.from('ubicaciones_logs').insert({
                    chofer_id: choferIdReal,
                    organizacion_id: orgId,
                    lat: choferCoords.lat,
                    lng: choferCoords.lng
                });
            } catch (err: any) {}
        };
        updateUbicacion();
        // Actualizar cada 30 segundos en lugar de 60 para mayor precisión
        logInterval = setInterval(updateUbicacion, 30000);
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
            estado: 'ACEPTADO',
            accepted_at: new Date().toISOString()
          })
          .eq('id', viaje.id)
          .in('estado', ['SOLICITADO'])
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
        await api.put(`/reservations/${reservaId}/estado`, { estado: 'FINALIZADO' });
        setChoferReservas((prev: any[]) => prev.filter((r: any) => r.id !== reservaId));
        alert("Reserva finalizada correctamente.");
    } catch (err: any) {
        alert("Error al finalizar reserva: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleNotificarLlegada = async () => {
      if (!viajeActivo) return;
      const { error } = await supabase.from('viajes').update({ 
        estado: 'EN_PUERTA',
        arrived_at: new Date().toISOString()
      }).eq('id', viajeActivo.id);
      
      if (error) {
          alert("Error de conexión: " + error.message);
          return;
      }
      setViajeActivo({ ...viajeActivo, estado: 'EN_PUERTA' });
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
      const { error } = await supabase.from('viajes').update({ estado: 'CANCELADO' }).eq('id', viajeActivo.id);
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
    <div className={`relative p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border backdrop-blur-xl w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-700 transition-all glass-panel ${isOnline ? 'border-[#10B981]/50 ring-1 ring-[#10B981]/20' : 'border-[rgba(255,255,255,0.08)]'}`}>
      
      {/* DECORACIÓN FONDO (Brillo sutil) */}
      <div className={`absolute -top-24 -left-24 w-64 h-64 rounded-full pointer-events-none transition-opacity duration-1000 ${isOnline ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#10B981]/20 to-transparent' : 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0D6EFD]/20 to-transparent'}`} />
      
      {/* HEADER PREMIUM (Simplificado en subrutas) */}
      <div className={`relative flex flex-col sm:flex-row justify-between items-start sm:items-center ${isMainPage ? 'mb-10 pb-8' : 'mb-6 pb-6'} border-b border-white/5 gap-6`}>
          <div className="w-full sm:w-auto flex flex-col">
            <div className="flex items-center justify-between sm:justify-start w-full gap-3">
               <div className="flex items-center gap-3">
                   <div className={`p-2 rounded-xl ${isOnline ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'} transition-colors duration-500`}>
                      <Zap size={24} fill="currentColor" />
                   </div>
                   <div>
                      <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter leading-none">
                         Traslados <span className={isOnline ? "text-cyan-400" : "text-zinc-500"}>UBI</span>
                      </h1>
                      {!isMainPage && <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Panel Chofer</p>}
                   </div>
               </div>
            </div>
            {isMainPage && (
                <>
                  <p className="text-xs font-bold text-zinc-400 mt-3 tracking-[0.2em] max-w-[250px] truncate uppercase sm:ml-11">¡Hola, {choferNombre}!</p>
                  <div className="sm:ml-11 w-full animate-in fade-in slide-in-from-left-4 duration-700 mt-2">
                     <WeatherWidget />
                  </div>
                </>
            )}
          </div>
          
          {isMainPage && (
              <button 
                onClick={isBlocked ? () => alert("Tu cuenta está bloqueada por deuda. Debes saldar con administración para volver online.") : toggleService}
                className={`
                  relative group flex w-full sm:w-auto justify-center items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm tracking-widest transition-all duration-300 active:scale-95 overflow-hidden
                  ${isBlocked 
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                    : (isOnline 
                        ? 'bg-[#009EE3] text-white shadow-[0_0_25px_rgba(0,158,227,0.4)] hover:bg-blue-500 hover:shadow-blue-500/60' 
                        : 'bg-[#0D6EFD] text-white hover:bg-blue-600 shadow-[0_0_20px_rgba(13,110,253,0.3)]')}
                `}
              >
                  <Power size={20} className={isOnline ? "animate-pulse" : ""} /> 
                  {isOnline ? "FINALIZAR TURNO" : "COMENZAR TURNO"}
              </button>
          )}
      </div>

      {isMainPage && (
          <>
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
            <div className={`relative mb-10 p-5 flex items-center gap-4 rounded-3xl border transition-all duration-700 ${isOnline ? 'bg-blue-500/5 border-blue-500/20 text-blue-400 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]' : 'bg-zinc-950/30 border-white/5 text-zinc-500'}`}>
                <div className="relative flex h-5 w-5">
                  {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-40"></span>}
                  <span className={`relative inline-flex rounded-full h-5 w-5 border-2 ${isOnline ? 'bg-blue-500 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-zinc-700 border-zinc-600'}`}></span>
                </div>
                <p className="font-bold text-sm tracking-tight">{isOnline ? "CONECTADO: TRANSMITIENDO SEÑAL GPS EN VIVO" : "DESCONECTADO: SEÑAL DE RADAR INACTIVA"}</p>
            </div>

            {/* GRID DE NAVEGACIÓN PREMIUM */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
              {[
                { id: 'solicitudes', icon: Navigation, label: 'Solicitudes', badge: isOnline && viajesDisponibles.length > 0 ? viajesDisponibles.length : 0, color: 'text-blue-400' },
                { id: 'reservas', icon: Calendar, label: 'Reservas', color: 'text-blue-400' },
                { id: 'caja', icon: Wallet, label: 'Mi Caja', color: 'text-emerald-400' },
                { id: 'tarifas', icon: Zap, label: 'Tarifario', color: 'text-yellow-400' },
                { id: 'comercios', icon: Store, label: 'Beneficios', color: 'text-orange-400' },
                { id: 'bolsa', icon: Briefcase, label: 'Bolsa', color: 'text-blue-500' },
                { id: 'premios', icon: Gift, label: 'Premios', color: 'text-purple-400' },
                ...(esTitular ? [{ id: 'flota', icon: Truck, label: 'Mi Flota', color: 'text-orange-400' }] : []),
                { id: 'ajustes', icon: Settings, label: 'Ajustes', color: 'text-zinc-400' },
              ].map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'comercios') {
                      setShowBeneficiosModal(true);
                    } else {
                      navigate('/chofer/' + tab.id);
                    }
                  }}
                  className={`
                    relative flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 group overflow-hidden
                    bg-black/30 border-white/5 hover:bg-black/50 hover:border-white/10
                  `}
                >
                  <tab.icon size={26} className={`mb-2.5 transition-all duration-300 text-zinc-500 group-hover:text-zinc-300 group-hover:scale-110`} />
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors text-zinc-600 group-hover:text-zinc-400`}>{tab.label}</span>
                  
                  {tab.badge > 0 && (
                    <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20 animate-bounce border-2 border-zinc-900">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
      )}

      <div className={`relative bg-zinc-950/40 backdrop-blur-sm p-6 sm:p-8 rounded-[2rem] border border-white/5 shadow-inner transition-all duration-500 ${!isMainPage ? 'mt-0' : ''}`}>
        {/* LUZ DE FONDO PARA EL CONTENIDO */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-tr-[2rem] pointer-events-none" />
        
        <Routes>
          <Route path="solicitudes" element={
            <SolicitudesPage 
              viajeActivo={viajeActivo}
              isOnline={isOnline}
              isBlocked={isBlocked}
              radarLoading={radarLoading}
              viajesDisponibles={viajesDisponibles}
              choferCoords={choferCoords}
              handleAceptarViaje={handleAceptarViaje}
              handleNotificarLlegada={handleNotificarLlegada}
              handleIniciarViaje={handleIniciarViaje}
              handleCancelarViaje={handleCancelarViaje}
              handleFinalizarViaje={handleFinalizarViaje}
              user={user}
            />
          } />
          
          <Route path="reservas" element={
            <ReservasPage 
              loadingChoferData={loadingChoferData}
              choferReservas={choferReservas}
              handleFinalizarReserva={handleFinalizarReserva}
            />
          } />
          
          <Route path="caja" element={<CajaPage />} />
          
          <Route path="tarifas" element={
            <TarifarioPage 
              activeTariff={activeTariff}
              fixedDestinations={fixedDestinations}
              loadingChoferData={loadingChoferData}
            />
          } />
          
          <Route path="comercios" element={
            <ComerciosPage 
              loadingComercios={loadingComercios}
              promocionesComercio={promocionesComercio}
            />
          } />
          
          <Route path="bolsa" element={<BolsaPage />} />
          
          <Route path="premios" element={<PremiosPage beneficios={beneficios} />} />
          
          <Route path="ajustes" element={
            <AjustesChoferPage 
              choferNombre={choferNombre}
              configPago={configPago}
              updatePassMsg={updatePassMsg}
              handleUpdatePassword={handleUpdatePassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              updatePassLoading={updatePassLoading}
            />
          } />
          
          <Route path="flota" element={<FlotaPage />} />
        </Routes>
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

      {/* MODAL BENEFICIOS */}
      <BeneficiosModal 
        isOpen={showBeneficiosModal} 
        onClose={() => setShowBeneficiosModal(false)} 
      />
    </div>
  );
}
