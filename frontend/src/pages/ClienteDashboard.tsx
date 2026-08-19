import { API_BASE_URL } from '../config';
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Car, MapPin, Calculator, Loader2, Navigation, History, CreditCard, Calendar, User, Phone, XCircle, ChevronRight, Lock, Building, CheckCircle2, Star, MessageSquare, ArrowLeft, Shield, Plus, Trash2, Map, Truck, Eye, EyeOff, Gift, Edit2, ThumbsUp, Clock, Route } from "lucide-react";
import { formatEstado, normalizeEstado } from "../utils/estadoUtils";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import WeatherWidget from "../components/WeatherWidget";
import ControlParental from "../components/cliente/ControlParental";
import MiNegocioTab from "../components/cliente/MiNegocioTab";
import MiFlotaTab from "../components/cliente/MiFlotaTab";
import { calculateDistance, isValidCoordinate } from "../utils/geo";
import AddressSelector from "../components/cliente/AddressSelector";
import TripMap from "../components/cliente/TripMap";
import { useJsApiLoader } from "@react-google-maps/api";
import { getCurrentUserLocation, reverseGeocode } from "../services/geolocation";
import BeneficiosModal from "../components/chofer/BeneficiosModal";
import ubiLogo from "../../assets/splash.png";
import carnetIcon from "../../assets/icon.png";
import logoUbi from "../assets/login/logoUbi.png";
import QRCode from "react-qr-code";

export default function ClienteDashboard() {
  const { user, role, roles } = useAuthStore();
  // Bug fix: chequear AMBOS — el rol primario (usuarios.rol) Y el array multi-rol (user_roles)
  const esTitular = role === 'titular' || roles.includes('titular');
  const [activeTab, setActiveTab] = useState<'pedir' | 'mis_viajes' | 'perfil' | 'empresa' | 'carnet' | 'familia' | 'negocio' | 'flota'>('pedir');
  const [filtroViajes, setFiltroViajes] = useState<'todos' | 'pendientes' | 'activos' | 'finalizados'>('todos');
  const [showBeneficiosModal, setShowBeneficiosModal] = useState(false);
  
  // States
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [origenCoords, setOrigenCoords] = useState<{lat: number, lng: number, source?: string} | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{lat: number, lng: number, source?: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [cotizacion, setCotizacion] = useState<any>(null);
  const [observaciones, setObservaciones] = useState("");
  const [referencia, setReferencia] = useState("");

  const [isEditingViaje, setIsEditingViaje] = useState(false);
  const [editOrigen, setEditOrigen] = useState("");
  const [editDestino, setEditDestino] = useState("");
  const [editOrigenCoords, setEditOrigenCoords] = useState<{lat: number, lng: number} | null>(null);
  const [editDestinoCoords, setEditDestinoCoords] = useState<{lat: number, lng: number} | null>(null);
  const [editObservaciones, setEditObservaciones] = useState("");
  const [editReferencia, setEditReferencia] = useState("");

  const [mapCenter, setMapCenter] = useState({ lat: -27.4692, lng: -58.8306 });
  const [isLocating, setIsLocating] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: ['places'] as any,
  });

  // Autocomplete Sugerencias
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [activeSugField, setActiveSugField] = useState<'origen' | 'destino' | null>(null);
  
  const [viajeActivo, setViajeActivo] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [destinosRecomendados, setDestinosRecomendados] = useState<any[]>([]);
  const [choferesFavoritos, setChoferesFavoritos] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  
  // Reservas Form
  const [resFecha, setResFecha] = useState("");
  const [resHora, setResHora] = useState("");
  const [viajeMinimizado, setViajeMinimizado] = useState(false);
  
  // Soporte
  const [orgSoporteMoto, setOrgSoporteMoto] = useState<any>(null);
  
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
  const [ratingRecomendado, setRatingRecomendado] = useState(false);

  // Resumen Viaje Finalizado
  const [mostrarResumenViaje, setMostrarResumenViaje] = useState(false);
  
  // Carnet Digital
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [recomendacionPromo, setRecomendacionPromo] = useState<any>(null);
  const [qrTimeLeft, setQrTimeLeft] = useState(60);
  const [numeroSocio, setNumeroSocio] = useState<string | null>(null);
  const [socioActivo, setSocioActivo] = useState(true);
  
  // Foto Perfil
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Regla de Negocio: Mínimo de Viajes para Carnet VIP
  const MINIMO_VIAJES_VIP = 5;
  const viajesFinalizados = historial.filter(h => normalizeEstado(h.estado) === 'FINALIZADO').length;
  
  // BYPASS QA TEMPORAL
  const qaEnabled = import.meta.env.VITE_ENABLE_QA_BENEFICIOS === 'true';
  const cumpleMinimoViajes = qaEnabled ? true : viajesFinalizados >= MINIMO_VIAJES_VIP;
  
  // Reglas PRO
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (!user) return;
    cargarDatosIniciales();
    
    const subscription = supabase.channel('viajes_cliente')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes', filter: `cliente_id=eq.${user.id}` }, () => {
          cargarViajeActivo();
          verificarRatings();
      })
      .subscribe();
      
    const sub_tutor = supabase.channel('viajes_tutor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes', filter: `tutor_responsable_id=eq.${user?.id}` }, () => {
          cargarViajeActivo();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(sub_tutor);
    }
  }, [user]);

  // Tracking del chofer en vivo
  useEffect(() => {
    if (!viajeActivo || !viajeActivo.chofer_id) {
       setDriverLocation(null);
       return;
    }

    // Inicializar
    supabase.from('choferes').select('lat, lng').eq('id', viajeActivo.chofer_id).single().then(({data}) => {
        if (data && data.lat && data.lng) setDriverLocation({lat: data.lat, lng: data.lng});
    });

    const sub = supabase.channel('driver_location')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'choferes', filter: `id=eq.${viajeActivo.chofer_id}` }, (payload) => {
         const newData = payload.new as any;
         if (newData.lat && newData.lng) {
            setDriverLocation({ lat: newData.lat, lng: newData.lng });
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [viajeActivo?.chofer_id]);

  // Hook para inicializar GPS al cargar la página
  useEffect(() => {
     if (user) {
         useMyLocation();
     }
  }, [user]);


  const cargarDatosIniciales = async () => {
    if(!user) return;
    await cargarViajeActivo();
    await verificarRatings();
    
    // Cargar organizacion support & PRO plan
    const { data: orgInfo } = await supabase.from('organizaciones').select('whatsapp_numero, nombre, plan').limit(1);
    if(orgInfo && orgInfo.length > 0) {
        setOrgSoporteMoto(orgInfo[0]);
        const tp = (orgInfo[0].plan || '').toLowerCase();
        setIsPro(tp === 'pro' || tp === 'premium' || tp === 'enterprise');
    }

    // Cargar foto perfil
    const { data: uData } = await supabase.from('usuarios').select('foto_perfil').eq('id', user.id).single();
    if(uData?.foto_perfil) setFotoPerfil(uData.foto_perfil);

    // Fetch API Historial (usamos el endpoint pero supabase es directo aca tmb)
    const { data: hist } = await supabase.from('viajes').select('*, promocion_id(titulo)').eq('cliente_id', user.id).order('creado_en', { ascending: false }).limit(50);
    if(hist) setHistorial(hist);
    
    // Fetch Recomendaciones Predictivas
    try {
      const respRec = await fetch(`${API_BASE_URL}/cliente/viajes/recomendaciones`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if(respRec.ok) {
        const dRec = await respRec.json();
        setDestinosRecomendados(dRec);
      }
    } catch(e) { console.error("Error cargando recomendaciones", e); }
    
    // Fetch Choferes Favoritos
    try {
      const respChof = await fetch(`${API_BASE_URL}/cliente/choferes/favoritos`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
      });
      if(respChof.ok) {
        const dChof = await respChof.json();
        setChoferesFavoritos(dChof);
      }
    } catch(e) { console.error("Error cargando choferes favoritos", e); }
    
    // Fetch Puntos
    cargarPuntosStatus();
    
    // Fetch Empresa Info
    cargarEmpresaStatus();
    
    cargarReservas();
  };

  const cargarEmpresaStatus = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/cliente/empresa`, {
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
      const resp = await fetch(`${API_BASE_URL}/cliente/puntos/status`, {
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
       const resp = await fetch(`${API_BASE_URL}/cliente/reservas`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
       });
        if(resp.ok) {
           const d = await resp.json();
           setReservas(d);
       }
     } catch (e) {}
  };


  // Recarga aprobaciones pendientes del Control Parental (llamada desde handleTripAction)
  const cargarAprobacionesPro = () => {
    // No-op: Control Parental es un componente auto-contenido que maneja su propio state.
    // Esta función existe para evitar ReferenceError al confirmar/rechazar viajes de menores.
  };

  const handleTripAction = async (tripId: string, action: 'approve' | 'reject') => {
      try {
          const resp = await fetch(`${API_BASE_URL}/family/${action}-trip/${tripId}`, {
              method: 'POST',
              headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
          });
          if(resp.ok) {
              alert(`Viaje ${action === 'approve'? 'Aprobado' : 'Rechazado'}`);
              cargarAprobacionesPro();
          }
      } catch(e) {}
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !user) return;
     
     setUploadingAvatar(true);
     try {
       // Eliminar foto anterior si existe para ahorrar espacio
       if (user.foto_perfil) {
         try {
           const oldPath = user.foto_perfil.split('/').pop();
           if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
         } catch (e) {
           console.error("Error al eliminar la foto anterior", e);
         }
       }

       const fileExt = file.name.split('.').pop();
       const filePath = `${user.id}_${Date.now()}.${fileExt}`;
       
       const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
       if (uploadError) throw uploadError;

       const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

       await supabase.from('usuarios').update({ foto_perfil: publicUrl }).eq('id', user.id);
       setFotoPerfil(publicUrl);
     } catch (err: any) {
        console.error(err);
        alert(`Error subiendo la imagen: ${err.message || 'Verifique que exista el bucket "avatars"'}`);
     } finally {
        setUploadingAvatar(false);
     }
  };

  const cargarViajeActivo = async () => {
    const { data } = await supabase.from('viajes')
       .select('*, chofer:choferes(vehiculo, patente, lat, lng, usuarios(nombre, apellido, foto_perfil))')
       .or(`cliente_id.eq.${user?.id},tutor_responsable_id.eq.${user?.id}`)
       .in('estado', ['SOLICITADO', 'ACEPTADO', 'EN_PUERTA', 'INICIADO'])
       .order('creado_en', { ascending: false })
       .limit(1);
    if(data && data.length > 0) {
      setViajeActivo(data[0]);
    } else {
      setViajeActivo(null);
      setViajeMinimizado(false);
    }
  }

  const cargarQrSocio = async () => {
     try {
       const resp = await fetch(`${API_BASE_URL}/socios/qr_token`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
       });
       if(resp.ok) {
           const d = await resp.json();
           setQrToken(d.qr_token);
           // Also fetch user details just in case it's not in user object
           const { data: udata } = await supabase.from('usuarios').select('numero_socio, activo').eq('id', user?.id).single();
           if (udata) {
               setNumeroSocio(udata.numero_socio);
               setSocioActivo(udata.activo);
           }
       }
     } catch (e) {
        console.error("Error cargando QR:", e);
     }
  };

  useEffect(() => {
     if(activeTab === 'carnet') {
         cargarQrSocio();
         setQrTimeLeft(60);
         const interval = setInterval(() => {
             setQrTimeLeft((prev) => {
                 if (prev <= 1) {
                     cargarQrSocio();
                     return 60;
                 }
                 return prev - 1;
             });
         }, 1000);
         return () => clearInterval(interval);
     }
  }, [activeTab, user?.id]);

  const verificarRatings = async () => {
     if(!user) return;
     try {
       // Intentar con datos completos del chofer
       let viaje: any = null;
       const { data, error } = await supabase.from('viajes')
          .select('*, chofer:choferes(vehiculo, patente, usuarios(nombre, apellido, foto_perfil))')
          .eq('cliente_id', user.id)
          .eq('estado', 'FINALIZADO')
          .order('creado_en', { ascending: false })
          .limit(1);
       if(data && data.length > 0) {
         viaje = data[0];
       } else if(error) {
         // Fallback: query simple sin JOIN si falla
         const { data: fallback } = await supabase.from('viajes')
            .select('*')
            .eq('cliente_id', user.id)
            .eq('estado', 'FINALIZADO')
            .order('creado_en', { ascending: false })
            .limit(1);
         if(fallback && fallback.length > 0) viaje = fallback[0];
       }

       if(viaje) {
         const { data: califs } = await supabase.from('calificaciones').select('id').eq('viaje_id', viaje.id);
         if(!califs || califs.length === 0) {
            setViajeACompletar(viaje);
            setMostrarResumenViaje(true);
         } else {
            setViajeACompletar(null);
            setMostrarResumenViaje(false);
         }
       } else {
         setViajeACompletar(null);
         setMostrarResumenViaje(false);
       }
     } catch(e) {
       console.error("Error verificando ratings:", e);
       // En caso de error total, no bloquear — intentar query mínima
       try {
         const { data: fallback } = await supabase.from('viajes')
            .select('id, estado, precio, final_price')
            .eq('cliente_id', user!.id)
            .eq('estado', 'FINALIZADO')
            .order('creado_en', { ascending: false })
            .limit(1);
         if(fallback && fallback.length > 0) {
           const { data: califs } = await supabase.from('calificaciones').select('id').eq('viaje_id', fallback[0].id);
           if(!califs || califs.length === 0) {
             setViajeACompletar(fallback[0]);
             setMostrarResumenViaje(true);
           }
         }
       } catch(_) { /* silenciar — no bloquear flujo */ }
     }
  };

  const handleCalificar = async () => {
     if(!viajeACompletar) return;
     setRatingLoading(true);
     try {
        const resp = await fetch(`${API_BASE_URL}/cliente/viaje/${viajeACompletar.id}/calificar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` },
            body: JSON.stringify({ puntuacion: ratingVal, comentario: ratingComentario, recomendado: ratingRecomendado })
        });
        if(resp.ok) {
           setViajeACompletar(null);
           setRatingRecomendado(false);
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

  // formatEstadoViaje ahora usa la utilidad centralizada
  const formatEstadoViaje = (estado: string) => formatEstado(estado);

  // ---- Funciones Viaje Activo ---- //
  const handleCotizar = async () => {
    if (!origen || !destino) return;
    
    if (!origenCoords || !destinoCoords) {
        alert("Faltan coordenadas precisas. Por favor selecciona tu origen y destino de las sugerencias del mapa, o activa el GPS.");
        return;
    }
    
    if (!isValidCoordinate(origenCoords.lat, origenCoords.lng) || !isValidCoordinate(destinoCoords.lat, destinoCoords.lng)) {
        alert("Las coordenadas del viaje no son válidas. Por favor selecciona nuevamente.");
        return;
    }
    
    setLoading(true);
    
    const oLat = origenCoords.lat;
    const oLng = origenCoords.lng;
    const dLat = destinoCoords.lat;
    const dLng = destinoCoords.lng;
    
    // Calculo Dinámico por Haversine
    const distanciaKmCalculada = parseFloat(calculateDistance(oLat, oLng, dLat, dLng));

    try {
      const response = await fetch(`${API_BASE_URL}/cliente/viaje/cotizar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
        },
        body: JSON.stringify({
          origen: { direccion: origen, lat: oLat, lng: oLng, observaciones, referencia, source: origenCoords.source || 'manual' },
          destino: { direccion: destino, lat: dLat, lng: dLng, source: destinoCoords.source || 'manual' },
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
    
    if (!origenCoords || !destinoCoords) {
        alert("Por favor asegúrate de seleccionar una dirección válida para origen y destino.");
        return;
    }
    
    if (!isValidCoordinate(origenCoords.lat, origenCoords.lng) || !isValidCoordinate(destinoCoords.lat, destinoCoords.lng)) {
        alert("Las coordenadas no son válidas. Revisa tu ubicación o destino.");
        return;
    }
    
    setLoading(true);
    
    const oLat = origenCoords.lat;
    const oLng = origenCoords.lng;
    const dLat = destinoCoords.lat;
    const dLng = destinoCoords.lng;

    try {
      const response = await fetch(`${API_BASE_URL}/cliente/viaje`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
        },
        body: JSON.stringify({
          origen: { direccion: origen, lat: oLat, lng: oLng, observaciones, referencia, source: origenCoords.source || 'manual' },
          destino: { direccion: destino, lat: dLat, lng: dLng, source: destinoCoords.source || 'manual' },
          precio_estimado: cotizacion.precio_original,
          distancia_km: cotizacion.distancia_km || 2.5,
          usar_viaje_gratis: usarViajeGratis,
          tipo_viaje: tipoViaje
        })
      });

      if(response.ok) {
        const d = await response.json();
        if(d.estado === 'ESPERANDO_TUTOR') {
           alert("🛡️ Tu viaje ha quedado pendiente de aprobación. Le hemos avisado a tu tutor.");
        }
        await cargarViajeActivo();
        await cargarPuntosStatus();
        setOrigen(''); setDestino(''); setCotizacion(null); setUsarViajeGratis(false);
        setObservaciones(''); setReferencia('');
      } else {
        const err = await response.json();
        alert(`No se pudo solicitar: ${err.detail || 'Error desconocido'}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarEdicion = async () => {
    if (!viajeActivo) return;
    
    if (!editOrigenCoords || !editDestinoCoords) {
        alert("Por favor selecciona una dirección válida para continuar con la edición.");
        return;
    }
    
    setLoading(true);
    try {
      const oLat = editOrigenCoords.lat;
      const oLng = editOrigenCoords.lng;
      const dLat = editDestinoCoords.lat;
      const dLng = editDestinoCoords.lng;

      // Calcular nueva distancia
      const R = 6371; // km
      const dLatRad = (dLat - oLat) * Math.PI / 180;
      const dLonRad = (dLng - oLng) * Math.PI / 180;
      const a = Math.sin(dLatRad/2) * Math.sin(dLatRad/2) +
                Math.cos(oLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) *
                Math.sin(dLonRad/2) * Math.sin(dLonRad/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      let distanciaKmCalculada = (R * c) * 1.3; // Factor de ruta urbana
      if(distanciaKmCalculada < 1) distanciaKmCalculada = 1;

      const response = await fetch(`${API_BASE_URL}/cliente/viaje/${viajeActivo.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
        },
        body: JSON.stringify({
          origen: { direccion: editOrigen, lat: oLat, lng: oLng, observaciones: editObservaciones, referencia: editReferencia },
          destino: { direccion: editDestino, lat: dLat, lng: dLng },
          distancia_km: distanciaKmCalculada
        })
      });

      if(response.ok) {
         setIsEditingViaje(false);
         await cargarViajeActivo();
      } else {
         const err = await response.json();
         alert(`No se pudo editar el viaje: ${err.detail || 'Error desconocido'}`);
      }
    } catch(e) {
      console.error(e);
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarViaje = async () => {
    if(!viajeActivo) return;
    if(!confirm("¿Estás seguro que deseas cancelar este viaje?")) return;
    setLoading(true);
    try {
       const resp = await fetch(`${API_BASE_URL}/cliente/viaje/${viajeActivo.id}/cancelar`, {
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
      const resp = await fetch(`${API_BASE_URL}/payments/create_trip_preference`, {
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
          setOrigenCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), source: 'manual' });
      } else if (activeSugField === 'destino') {
          setDestino(item.display_name);
          setDestinoCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), source: 'manual' });
      }
      setSugerencias([]);
      setActiveSugField(null);
  };

  const useMyLocation = async () => {
      setIsLocating(true);
      const loc = await getCurrentUserLocation();
      if (loc.error) {
         alert(loc.error);
         setIsLocating(false);
         return; // Evita inicializar el mapa en default si falla el GPS
      }
      
      if (loc.accuracy && loc.accuracy > 100) {
         alert(`La precisión actual de tu GPS es baja (margen de ${Math.round(loc.accuracy)} metros). Por favor, ajusta el pin en el mapa si es necesario.`);
      }
      
      if (loc.lat !== undefined && loc.lng !== undefined) {
         setMapCenter({ lat: loc.lat, lng: loc.lng });
         setOrigenCoords({ lat: loc.lat, lng: loc.lng, source: 'gps' });
         
         const address = await reverseGeocode(loc.lat, loc.lng);
         setOrigen(address);
      }
      setIsLocating(false);
  };

  const handleMapCenterChanged = async (lat: number, lng: number) => {
     setMapCenter({ lat, lng });
     setOrigenCoords({ lat, lng, source: 'manual' });
     const address = await reverseGeocode(lat, lng);
     setOrigen(address);
  };
  // ---- Reservas ---- //
  const handleReservarViaje = async () => {
     if(!origen || !destino || !resFecha || !resHora) return;
     setLoading(true);
     try {
       const resp = await fetch(`${API_BASE_URL}/cliente/reservas`, {
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-6 relative">
      {/* HEADER PERFIL Y TABS */}
      <header className="glass-panel p-6 rounded-3xl mb-6">
        <div className="flex flex-col gap-4">
           <div className="flex flex-col gap-3 w-full">
             <div>
               <h1 className="text-2xl font-black text-white flex items-center gap-2">
                 ¡Hola, {user?.user_metadata?.nombre || user?.email?.split('@')[0]}! 👋
               </h1>
               <p className="text-zinc-400 text-sm mt-1">Tu panel de movilidad inteligente</p>
               {qaEnabled && (role === 'admin' || (roles && roles.includes('admin'))) && (
                 <span className="mt-2 inline-block bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                   QA BENEFICIOS ACTIVO
                 </span>
               )}
             </div>
             <div className="w-full animate-in fade-in slide-in-from-left-4 duration-700">
               <WeatherWidget />
             </div>
           </div>
        </div>

        {/* Navigation Tabs (Scrollable) */}
        <div className="mt-6 overflow-x-auto whitespace-nowrap scrollbar-hide snap-x snap-mandatory flex-nowrap pb-2 flex gap-3 w-full touch-pan-x">
           {[
             { id: 'pedir', label: 'Inicio', icon: Car },
             { id: 'mis_viajes', label: 'Mis Viajes', icon: History },
             { id: 'beneficios', label: 'Beneficios', icon: Gift },
             { id: 'carnet', label: 'Carnet Socio', icon: Star },
             { id: 'negocio', label: 'Mi Negocio', icon: Building },
             { id: 'familia', label: 'Seguridad', icon: Shield },
             { id: 'perfil', label: 'Cuenta', icon: User },
             ...(empresaAsignada ? [{ id: 'empresa', label: 'Viaje Empresa', icon: Building }] : []),
              ...(esTitular ? [{ id: 'flota', label: 'Mi Flota', icon: Truck }] : [])
           ].map(tab => (
             <button 
               key={tab.id}
               onClick={() => {
                 if(tab.id === 'beneficios') {
                   setShowBeneficiosModal(true);
                 } else {
                   setActiveTab(tab.id as any);
                 }
               }}
               className={`relative flex items-center gap-2 px-5 py-3.5 font-black text-[13px] uppercase tracking-wide transition-all duration-300 rounded-2xl snap-start flex-shrink-0 backdrop-blur-md overflow-hidden group ${
                  (activeTab === tab.id && tab.id !== 'beneficios')
                   ? 'bg-blue-600/30 border border-blue-400/50 text-blue-300 shadow-[0_0_30px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/50' 
                   : 'bg-zinc-900/60 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 hover:border-white/10'
               }`}
             >
               {(activeTab === tab.id && tab.id !== 'beneficios') && (
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-transparent opacity-50" />
               )}
               <tab.icon size={18} className={`relative z-10 transition-colors ${(activeTab === tab.id && tab.id !== 'beneficios') ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'text-zinc-500 group-hover:text-zinc-300'}`} /> 
               <span className="relative z-10">{tab.label}</span>
             </button>
          ))}
        </div>
      </header>

      {/* RENDERIZADO CONDICIONAL SEGUN EL TAB */}
      <div className={`grid grid-cols-1 ${activeTab === 'pedir' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
        
        {/* COLUMNA PRINCIPAL */}
        <div className={activeTab === 'pedir' ? 'lg:col-span-2' : ''}>
          
          {/* TAB: PEDIR AHORA */}
          {activeTab === 'pedir' && (
            <div className="space-y-6">
               {/* Promociones migradas a pestaña Beneficios */}

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
                 <div className="glass-panel rounded-[2rem] p-6 shadow-[0_0_40px_rgba(13,110,253,0.15)] relative overflow-hidden">
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
                      </div>
                      <div className="text-right">
                         <p className="text-sm text-zinc-400">Total a pagar</p>
                         <p className="text-2xl font-bold text-emerald-400">${Number(viajeActivo.precio).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Driver Card */}
                    {viajeActivo.chofer && (
                      <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center gap-4 relative z-10">
                         {/* Driver Photo */}
                         <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-blue-500/50 bg-zinc-800 flex-shrink-0">
                           {viajeActivo.chofer.usuarios?.foto_perfil ? (
                              <img src={viajeActivo.chofer.usuarios.foto_perfil} alt="Chofer" className="w-full h-full object-cover" />
                           ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-500"><User size={28} /></div>
                           )}
                         </div>
                         {/* Driver Details */}
                         <div className="flex-1 text-center sm:text-left">
                           <p className="text-white font-bold text-lg">
                             {viajeActivo.chofer.usuarios?.nombre} {viajeActivo.chofer.usuarios?.apellido}
                           </p>
                           <div className="flex items-center justify-center sm:justify-start gap-2 text-zinc-400 text-sm mt-1">
                             <Car size={14} className="text-blue-400" />
                             <span>{viajeActivo.chofer.vehiculo || "Vehículo Asignado"}</span>
                           </div>
                         </div>
                         {/* License Plate */}
                         {viajeActivo.chofer.patente && (
                           <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 flex flex-col items-center flex-shrink-0">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Patente</span>
                              <span className="text-white font-mono font-bold">{viajeActivo.chofer.patente}</span>
                           </div>
                         )}
                      </div>
                    )}

                    {/* Permanent Map */}
                    {isMapLoaded && (
                      <div className="h-48 mb-6 rounded-2xl overflow-hidden border border-zinc-800 relative shadow-xl z-10">
                         <TripMap 
                           center={{ lat: viajeActivo.origen.lat, lng: viajeActivo.origen.lng }}
                           onCenterChanged={() => {}}
                           destination={{ lat: viajeActivo.destino.lat, lng: viajeActivo.destino.lng }}
                           driverLocation={viajeActivo.chofer ? { lat: viajeActivo.chofer.lat, lng: viajeActivo.chofer.lng } : undefined}
                           isLoaded={isMapLoaded}
                           isLocating={false}
                         />
                      </div>
                    )}

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
                        <MapPin size={18} /> Seguimiento Full
                      </a>
                      {normalizeEstado(viajeActivo.estado) !== 'EN_PUERTA' && normalizeEstado(viajeActivo.estado) !== 'INICIADO' && (
                         <div className="flex gap-2 w-full">
                           {normalizeEstado(viajeActivo.estado) === 'SOLICITADO' && (
                             <button 
                               onClick={() => {
                                 setEditOrigen(viajeActivo.origen.direccion || "");
                                 setEditDestino(viajeActivo.destino.direccion || "");
                                 setEditOrigenCoords({ lat: viajeActivo.origen.lat, lng: viajeActivo.origen.lng });
                                 setEditDestinoCoords({ lat: viajeActivo.destino.lat, lng: viajeActivo.destino.lng });
                                 setEditObservaciones(viajeActivo.origen.observaciones || "");
                                 setEditReferencia(viajeActivo.origen.referencia || "");
                                 setIsEditingViaje(true);
                               }}
                               disabled={loading}
                               className="flex-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 font-medium py-3 rounded-xl transition-all border border-amber-500/20 flex items-center justify-center gap-2"
                             >
                               <Edit2 size={18} /> Editar Viaje
                             </button>
                           )}
                           <button 
                             onClick={handleCancelarViaje}
                             disabled={loading}
                             className="flex-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-medium py-3 rounded-xl transition-all border border-rose-500/20 flex items-center justify-center gap-2"
                           >
                             <XCircle size={18} /> Cancelar Viaje
                           </button>
                         </div>
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
                 <div className="glass-panel rounded-[2rem] p-6 shadow-[0_0_40px_rgba(0,0,0,0.3)] relative overflow-hidden">
                   
                   {/* BANNER PROMOCIÓN (SISTEMA PREDICTIVO) */}
                   {recomendacionPromo && (
                     <div className={`mb-6 p-4 rounded-2xl border flex items-start gap-4 relative overflow-hidden ${
                       recomendacionPromo.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30' :
                       recomendacionPromo.color === 'violet' ? 'bg-violet-500/10 border-violet-500/30' :
                       recomendacionPromo.color === 'amber' ? 'bg-amber-500/10 border-amber-500/30' :
                       'bg-blue-500/10 border-blue-500/30'
                     }`}>
                        <div className={`absolute -right-4 -top-4 opacity-10 ${
                          recomendacionPromo.color === 'emerald' ? 'text-emerald-500' :
                          recomendacionPromo.color === 'violet' ? 'text-violet-500' :
                          recomendacionPromo.color === 'amber' ? 'text-amber-500' : 'text-blue-500'
                        }`}>
                          <Gift size={100} />
                        </div>
                        <div className={`p-2 rounded-xl ${
                          recomendacionPromo.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                          recomendacionPromo.color === 'violet' ? 'bg-violet-500/20 text-violet-400' :
                          recomendacionPromo.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          <Gift size={24} />
                        </div>
                        <div className="flex-1 relative z-10">
                           <h4 className={`font-bold mb-1 ${
                              recomendacionPromo.color === 'emerald' ? 'text-emerald-400' :
                              recomendacionPromo.color === 'violet' ? 'text-violet-400' :
                              recomendacionPromo.color === 'amber' ? 'text-amber-400' : 'text-blue-400'
                           }`}>{recomendacionPromo.titulo}</h4>
                           <p className="text-zinc-300 text-sm leading-relaxed">{recomendacionPromo.descripcion}</p>
                        </div>
                     </div>
                   )}

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

                      {isMapLoaded ? (
                        <>
                           <div className="h-64 mb-6 rounded-2xl overflow-hidden border border-zinc-800 relative shadow-xl">
                              <TripMap 
                                center={mapCenter}
                                onCenterChanged={handleMapCenterChanged}
                                destination={destinoCoords}
                                driverLocation={driverLocation}
                                isLoaded={isMapLoaded}
                                isLocating={isLocating}
                              />
                           </div>
                           <AddressSelector
                              originAddress={origen}
                              onOriginSelect={(lat, lng, address) => {
                                setOrigen(address);
                                setOrigenCoords({ lat, lng, source: 'manual' });
                                setMapCenter({ lat, lng });
                              }}
                              onDestinationSelect={(lat, lng, address) => {
                                setDestino(address);
                                setDestinoCoords({ lat, lng, source: 'manual' });
                              }}
                              onRequestCurrentLocation={useMyLocation}
                           />
                           <div className="grid grid-cols-2 gap-4 mt-4 mb-2">
                             <div>
                               <label className="block text-zinc-400 text-xs mb-1 font-medium">Observaciones (Opcional)</label>
                               <input type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm" placeholder="Ej: Llevo mascota" />
                             </div>
                             <div>
                               <label className="block text-zinc-400 text-xs mb-1 font-medium">Referencia (Opcional)</label>
                               <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm" placeholder="Ej: Portón verde" />
                             </div>
                           </div>
                        </>
                      ) : (
                         <div className="h-64 mb-6 rounded-2xl overflow-hidden border border-zinc-800 relative flex items-center justify-center bg-zinc-900">
                             <Loader2 className="animate-spin text-blue-500" size={32} />
                         </div>
                      )}

                   {!cotizacion ? (
                     <button 
                       onClick={handleCotizar}
                       disabled={loading || !origen || !destino}
                       className="w-full mt-6 bg-[#0D6EFD] hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(13,110,253,0.3)]"
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

               {/* DESTINOS RECOMENDADOS (SISTEMA PREDICTIVO) */}
               {!viajeActivo && destinosRecomendados.length > 0 && (
                 <div className="bg-zinc-900/50 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-6 shadow-lg shadow-blue-500/5 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 opacity-10 pointer-events-none rotate-12">
                      <Star size={150} className="text-blue-500" />
                    </div>
                    <h3 className="text-white font-black text-lg mb-1 flex items-center gap-2 relative z-10">
                       <Star size={20} className="text-blue-400 fill-blue-400" /> Destinos Recomendados
                    </h3>
                    <p className="text-xs text-zinc-400 mb-4 relative z-10">Basado en tus horarios y viajes anteriores</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
                       {destinosRecomendados.map((v, i) => (
                           <button 
                             key={i}
                             onClick={() => seleccionarRutinario(v.origen, v.destino)}
                             className="flex flex-col text-left bg-black/40 hover:bg-blue-600/20 hover:border-blue-500/50 border border-white/5 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] p-4 rounded-2xl transition-all duration-300 group hover:-translate-y-1"
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

               {/* CHOFERES FAVORITOS */}
               {!viajeActivo && choferesFavoritos.length > 0 && (
                 <div className="bg-zinc-900/50 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-6 shadow-lg shadow-amber-500/5">
                    <h3 className="text-white font-black text-lg mb-1 flex items-center gap-2">
                       <Star size={20} className="text-amber-400 fill-amber-400" /> Tus Choferes Favoritos
                    </h3>
                    <p className="text-xs text-zinc-400 mb-4">Tus conductores estrella con los que más has viajado.</p>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                       {choferesFavoritos.map((ch, i) => (
                           <div key={i} className="flex-shrink-0 w-56 bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col items-center text-center snap-center hover:border-amber-500/30 transition-all duration-300">
                              <div className="relative mb-3">
                                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-amber-500/50 bg-zinc-800">
                                   {ch.foto_perfil ? (
                                      <img src={ch.foto_perfil} alt={ch.nombre} className="w-full h-full object-cover" />
                                   ) : (
                                      <div className="w-full h-full flex items-center justify-center text-zinc-500"><User size={28} /></div>
                                   )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-zinc-900 border border-amber-500/50 text-amber-400 text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg">
                                   {ch.promedio_calificaciones} <Star size={8} className="fill-amber-400" />
                                </div>
                              </div>
                              
                              <p className="text-sm font-bold text-white w-full truncate">{ch.nombre} {ch.apellido}</p>
                              
                              <div className="w-full bg-zinc-900/50 rounded-lg p-2 mt-2 space-y-1.5 border border-white/5">
                                <p className="text-[11px] text-zinc-300 flex items-center justify-between gap-1 w-full truncate">
                                   <span className="flex items-center gap-1"><Car size={12} className="text-blue-400" /> Vehículo</span>
                                   <span className="font-medium">{ch.vehiculo}</span>
                                </p>
                                <p className="text-[11px] text-zinc-300 flex items-center justify-between gap-1 w-full truncate">
                                   <span className="text-zinc-500 font-mono tracking-wider">[{ch.patente}]</span>
                                </p>
                              </div>
                              
                              <div className="mt-3 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-wider">
                                {ch.cantidad_viajes_con_cliente} Viajes contigo
                              </div>
                           </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>
          )}

          {/* TAB: MIS VIAJES */}
          {activeTab === 'mis_viajes' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* BLOQUE SUPERIOR: Agendar */}
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-6 shadow-lg shadow-emerald-500/5">
                   <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                     <Calendar className="text-emerald-400" /> Programar Nuevo Viaje
                   </h2>
                   
                   <form onSubmit={(e) => { e.preventDefault(); handleReservarViaje(); }} className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-zinc-400 text-sm mb-1">Origen</label>
                         <input required type="text" value={origen} onChange={e => setOrigen(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="Ej: San Juan 332" />
                       </div>
                       <div>
                         <label className="block text-zinc-400 text-sm mb-1">Destino</label>
                         <input required type="text" value={destino} onChange={e => setDestino(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="Ej: Aeropuerto" />
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-zinc-400 text-sm mb-1">Fecha</label>
                         <input required type="date" value={resFecha} onChange={e => setResFecha(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark] transition-all" />
                       </div>
                       <div>
                         <label className="block text-zinc-400 text-sm mb-1">Hora</label>
                         <input required type="time" value={resHora} onChange={e => setResHora(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark] transition-all" />
                       </div>
                     </div>

                     <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] mt-6 active:scale-[0.98]">
                        Agendar Reserva
                     </button>
                   </form>
                </div>

                {/* BLOQUE INFERIOR: Historial / Actividad */}
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                         <History className="text-blue-400" size={20} /> Actividad de Viajes
                      </h3>
                      
                      {/* Subtabs/Filtros */}
                      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto scrollbar-hide snap-x touch-pan-x">
                         {[
                           { id: 'todos', label: 'Todos' },
                           { id: 'pendientes', label: 'Pendientes' },
                           { id: 'activos', label: 'Activos' },
                           { id: 'finalizados', label: 'Finalizados' }
                         ].map(f => (
                           <button
                              key={f.id}
                              onClick={() => setFiltroViajes(f.id as any)}
                              className={`snap-start whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all ${filtroViajes === f.id ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                           >
                              {f.label}
                           </button>
                         ))}
                      </div>
                   </div>

                   {/* Lista de Viajes Generada */}
                   <div className="space-y-4">
                      {(() => {
                         const resMapped = reservas.map(r => ({
                            id: `res-${r.id}`,
                            esReserva: true,
                            origen_dir: r.origen,
                            destino_dir: r.destino,
                            fecha_display: new Date(`${r.fecha_viaje}T${r.hora_viaje}`),
                            estado_display: r.estado,
                            precio_display: null
                         }));
                         
                         const histMapped = historial.map(h => ({
                            id: `hist-${h.id}`,
                            esReserva: false,
                            origen_dir: h.origen?.direccion,
                            destino_dir: h.destino?.direccion,
                            fecha_display: new Date(h.creado_en),
                            estado_display: h.estado,
                            precio_display: h.precio
                         }));

                         let combinados = [];
                         if (filtroViajes === 'todos') {
                             combinados = [...resMapped, ...histMapped];
                         } else if (filtroViajes === 'pendientes') {
                             combinados = [...resMapped, ...histMapped.filter(h => ['SOLICITADO', 'ESPERANDO_TUTOR'].includes(normalizeEstado(h.estado_display)))];
                         } else if (filtroViajes === 'activos') {
                             combinados = histMapped.filter(h => ['ACEPTADO', 'EN_PUERTA', 'INICIADO'].includes(normalizeEstado(h.estado_display)));
                         } else if (filtroViajes === 'finalizados') {
                             combinados = histMapped.filter(h => ['FINALIZADO', 'CANCELADO', 'RECHAZADO'].includes(normalizeEstado(h.estado_display)));
                         }

                         combinados.sort((a, b) => b.fecha_display.getTime() - a.fecha_display.getTime());

                         if (combinados.length === 0) {
                            return <p className="text-zinc-500 text-center py-6">No hay viajes para mostrar en esta categoría.</p>;
                         }

                         return combinados.map(v => (
                            <div key={v.id} className="bg-black/30 hover:bg-black/40 transition-colors border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                               <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                     {v.esReserva ? <Calendar size={16} className="text-emerald-400" /> : <Car size={16} className={normalizeEstado(v.estado_display) === 'FINALIZADO' ? 'text-emerald-400' : 'text-blue-400'} />}
                                     <span className="text-white font-bold truncate max-w-[200px] md:max-w-xs">{v.destino_dir || 'Destino Desconocido'}</span>
                                     {v.esReserva && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase rounded-full border border-emerald-500/20">Reserva</span>}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-zinc-500 pl-7">
                                     <span className="truncate max-w-[200px]">Desde: {v.origen_dir || 'Origen'}</span>
                                     <span>•</span>
                                     <span>{v.fecha_display.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                  </div>
                               </div>
                               
                               <div className="flex items-center justify-between md:justify-end gap-4 md:w-auto w-full border-t border-white/5 md:border-0 pt-3 md:pt-0">
                                  <div className="text-left md:text-right flex flex-col items-start md:items-end">
                                     <span className="inline-block px-3 py-1 bg-white/5 text-zinc-300 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10">
                                        {formatEstadoViaje(v.estado_display)}
                                     </span>
                                     {v.precio_display && (
                                        <p className="font-black text-white text-sm mt-1">${Number(v.precio_display).toLocaleString()}</p>
                                     )}
                                  </div>
                               </div>
                            </div>
                         ));
                      })()}
                   </div>
                </div>
             </div>
          )}

          {/* TAB: PERFIL */}
          {activeTab === 'perfil' && (
             <div className="space-y-6">
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
                   <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
                      <div className="relative group w-24 h-24 sm:w-20 sm:h-20 flex-shrink-0">
                          <div className="w-full h-full bg-blue-600/20 border border-blue-500/50 rounded-full flex items-center justify-center overflow-hidden">
                             {fotoPerfil ? (
                                <img src={fotoPerfil} alt="Avatar" className="w-full h-full object-cover" />
                             ) : (
                                <User size={36} className="text-blue-400" />
                             )}
                          </div>
                          
                          <label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                             {uploadingAvatar ? <Loader2 size={24} className="animate-spin text-white" /> : <p className="text-xs text-white font-bold text-center">Cambiar</p>}
                             <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} disabled={uploadingAvatar} />
                          </label>
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
                        <div className="relative">
                           <input 
                              type={showPassword ? "text" : "password"} 
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              className="w-full bg-black/30 border border-white/5 rounded-xl px-4 pr-11 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500" 
                              placeholder="********" 
                           />
                           <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-white transition-colors"
                              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                           >
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                           </button>
                        </div>
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

        {/* TAB: FAMILIA */}
        {activeTab === 'familia' && (
           <ControlParental user={user} isPro={isPro} />
        )}

        {/* TAB: NEGOCIO */}
        {activeTab === 'negocio' && (
           <MiNegocioTab />
        )}

        {/* TAB: MI FLOTA (Titular) */}
        {activeTab === 'flota' && esTitular && (
           <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
             <MiFlotaTab />
           </div>
        )}

        {/* TAB: CARNET DIGITAL SOCIO */}
        {activeTab === 'carnet' && (
           <div className="bg-zinc-950/80 backdrop-blur-2xl border border-amber-500/20 shadow-2xl shadow-amber-500/5 p-6 md:p-8 rounded-3xl animate-in fade-in duration-500 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none"></div>
              
              <div className="flex flex-col items-center w-full max-w-sm sm:max-w-md mx-auto relative z-10">
                  <div className="text-center mb-8 flex flex-col items-center">
                      <img src={logoUbi} alt="UBI Logo" className="w-32 mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                      <h2 className="text-3xl font-black text-white flex justify-center items-center gap-3 tracking-wide">
                        <img src={carnetIcon} alt="Club Icon" className="w-8 h-8 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" /> MIEMBRO VIP
                      </h2>
                      <p className="text-amber-400/80 mt-2 text-sm uppercase tracking-[0.2em] font-bold">Club Traslados UBI</p>
                  </div>

                  {/* Tarjeta Premium - Luxury Black & Gold Design */}
                  <div className={`relative w-full aspect-[1.58/1] bg-gradient-to-tr from-black via-zinc-900 to-black p-6 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border ${cumpleMinimoViajes ? 'border-amber-500/50' : 'border-zinc-700'} group flex-shrink-0 transition-all duration-500`}>
                      {/* Efectos de Brillo/Metal */}
                      {cumpleMinimoViajes && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-br from-amber-200/10 via-transparent to-amber-600/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
                          <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 to-transparent rounded-full mix-blend-screen transform translate-x-1/3 -translate-y-1/3"></div>
                          <div className="absolute bottom-0 left-0 w-40 h-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/20 to-transparent rounded-full mix-blend-overlay"></div>
                        </>
                      )}

                      {/* Patrón de fondo (opcional) */}
                      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                      
                      {/* Marca de agua UBI */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                         <img src={logoUbi} alt="UBI" className="w-48 grayscale" />
                      </div>

                      <div className={`relative z-10 flex flex-col h-full justify-between ${!cumpleMinimoViajes ? 'opacity-50 grayscale' : ''}`}>
                         <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <img src={carnetIcon} alt="Club" className="w-5 h-5 opacity-80" />
                                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.3em]">CLUB VIP UBI</p>
                              </div>
                              {/* Badge de Estado Dinámico */}
                              <div className={`mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase w-fit tracking-wider shadow-lg ${
                                  !cumpleMinimoViajes ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' :
                                  socioActivo === true ? 'bg-gradient-to-r from-amber-600 to-amber-400 text-black shadow-amber-500/20' : 
                                  socioActivo === false && numeroSocio ? 'bg-zinc-800 text-red-400 border border-red-500/30' : 
                                  'bg-zinc-800 text-zinc-500 border border-zinc-700'
                              }`}>
                                  {!cumpleMinimoViajes ? 'NIVEL BLOQUEADO' : socioActivo === true ? 'MEMBRESÍA ACTIVA' : socioActivo === false && numeroSocio ? 'SUSPENDIDO' : 'VENCIDO'}
                              </div>
                            </div>
                            <div className={`p-0.5 rounded-full shadow-xl ${cumpleMinimoViajes ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-zinc-700'}`}>
                               <div className="p-1 bg-black rounded-full">
                                   {fotoPerfil ? (
                                     <img src={fotoPerfil} alt="Perfil" className="w-14 h-14 rounded-full object-cover border border-zinc-800" />
                                   ) : (
                                     <div className="w-14 h-14 rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center p-2">
                                         <User className={`${cumpleMinimoViajes ? 'text-amber-500/50' : 'text-zinc-600'} w-8 h-8`} />
                                     </div>
                                   )}
                               </div>
                            </div>
                         </div>
                         
                         <div className="flex justify-between items-end mt-4 gap-4">
                            <div className="flex-1 min-w-0">
                               <p className="text-[9px] font-bold uppercase text-zinc-500 tracking-[0.2em] mb-1">TITULAR DE LA CUENTA</p>
                               <div className="flex gap-1.5 flex-wrap">
                                   <p className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 uppercase tracking-widest truncate">{user?.user_metadata?.nombre || 'Socio'}</p>
                                   {user?.user_metadata?.apellido && <p className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 uppercase tracking-widest truncate">{user.user_metadata.apellido}</p>}
                               </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                               <p className="text-[9px] font-bold uppercase text-zinc-500 tracking-[0.2em] mb-1">ID DE SOCIO</p>
                               <p className={`text-lg sm:text-xl font-mono font-light tracking-[0.2em] ${cumpleMinimoViajes ? 'text-amber-400' : 'text-zinc-500'}`}>{numeroSocio ? String(numeroSocio).padStart(8, '0') : '--------'}</p>
                            </div>
                         </div>
                      </div>

                      {/* Overlay si no cumple el mínimo */}
                      {!cumpleMinimoViajes && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
                          <Lock className="text-zinc-400 mb-2" size={32} />
                          <p className="text-white font-bold tracking-widest uppercase text-sm">Nivel VIP Bloqueado</p>
                          <p className="text-amber-400 font-bold mt-1 bg-amber-500/10 px-3 py-1 rounded-full text-xs">
                             {viajesFinalizados} / {MINIMO_VIAJES_VIP} Viajes
                          </p>
                        </div>
                      )}
                  </div>

                  {/* Zona QR Dinámico V2 - Oculta si no cumple mínimo */}
                  <div className="relative mt-8 w-full flex flex-col items-center">
                     {cumpleMinimoViajes ? (
                       <>
                         <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent rounded-3xl opacity-50"></div>
                         <div className="relative bg-zinc-900/50 backdrop-blur-md border border-amber-500/10 p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center min-h-[300px] w-full max-w-[300px]">
                            {qrToken ? (
                               <div className={`animate-in zoom-in-95 duration-500 flex flex-col items-center transition-all ${qrTimeLeft === 60 ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
                                 {/* Timer Inteligente */}
                                 <div className={`mb-5 flex items-center gap-2 px-4 py-1.5 rounded-full border bg-black/50 ${qrTimeLeft < 10 ? 'border-red-500/50 text-red-400' : 'border-amber-500/20 text-amber-400'}`}>
                                     <Lock size={12} className={qrTimeLeft < 10 ? 'animate-pulse' : ''} />
                                     <span className="font-mono font-bold text-sm tracking-widest">00:{String(qrTimeLeft).padStart(2, '0')}</span>
                                 </div>
                                 
                                 <div className="p-3 border-[3px] border-amber-500/30 rounded-2xl bg-white shadow-[0_0_30px_rgba(245,158,11,0.15)] flex justify-center items-center overflow-hidden w-[200px] h-[200px] relative transition-transform hover:scale-105 duration-300">
                                    {/* QR generado localmente — sin enviar token a servicios externos */}
                                    <QRCode
                                      value={`https://viajesnea.agentech.ar/validar?scan=${qrToken}`}
                                      size={180}
                                      level="M"
                                      fgColor="#18181b"
                                      bgColor="#ffffff"
                                    />
                                   {qrTimeLeft === 60 && <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm"><Loader2 size={32} className="animate-spin text-amber-500" /></div>}
                                 </div>
                                 
                                 <div className="mt-6 flex flex-col items-center gap-1">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Código de Seguridad Variable</span>
                                    <div className="h-1 w-12 bg-amber-500/20 rounded-full mt-1">
                                      <div className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(qrTimeLeft / 60) * 100}%` }}></div>
                                    </div>
                                 </div>
                               </div>
                            ) : (
                               <div className="flex flex-col items-center justify-center text-amber-500/50 gap-4">
                                 <Loader2 size={40} className="animate-spin" />
                                 <p className="text-xs font-bold tracking-[0.2em] uppercase animate-pulse">Generando Credencial...</p>
                               </div>
                            )}
                         </div>
                       </>
                     ) : (
                       <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center min-h-[300px] w-full max-w-[300px] text-center">
                          <History size={48} className="text-zinc-600 mb-4" />
                          <h3 className="text-white font-bold text-lg mb-2">Viajá más con UBI</h3>
                          <p className="text-zinc-400 text-sm">Completá {MINIMO_VIAJES_VIP} viajes para habilitar tu código QR y acceder a beneficios VIP en comercios adheridos.</p>
                          <div className="mt-6 w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/5">
                             <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min((viajesFinalizados / MINIMO_VIAJES_VIP) * 100, 100)}%` }}></div>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2">{viajesFinalizados} de {MINIMO_VIAJES_VIP} viajes completados</p>
                       </div>
                     )}
                  </div>
                  
                  <div className="mt-8 flex items-start gap-3 bg-zinc-900/50 border border-white/5 p-4 rounded-xl text-left w-full">
                      <Star size={20} className={cumpleMinimoViajes ? "text-amber-500 flex-shrink-0 mt-0.5" : "text-zinc-500 flex-shrink-0 mt-0.5"} />
                      <p className="text-zinc-400 text-xs leading-relaxed">
                          {cumpleMinimoViajes 
                            ? "Mostrá este código QR en comercios adheridos para acceder a promociones, descuentos y beneficios exclusivos del Club VIP UBI."
                            : `Necesitás completar ${MINIMO_VIAJES_VIP} viajes para acceder a los descuentos exclusivos en comercios adheridos.`
                          }
                      </p>
                  </div>
              </div>
           </div>
        )}
        {/* COLUMNA DERECHA PERMANENTE */}
        {activeTab === 'pedir' && (
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
        )}

      </div>
    </div>

    {/* OVERLAY RESUMEN VIAJE FINALIZADO */}
    {viajeACompletar && !viajeActivo && mostrarResumenViaje && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
         <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-500">
            <div className="text-center mb-5">
               <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mb-4">
                   <CheckCircle2 size={36} />
               </div>
               <h3 className="text-2xl font-black text-white mb-1">¡Viaje Finalizado!</h3>
               <p className="text-sm text-zinc-400">Gracias por viajar con nosotros.</p>
            </div>

            {/* Info del chofer */}
            {viajeACompletar.chofer && (
              <div className="bg-black/30 border border-white/5 rounded-2xl p-4 mb-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {viajeACompletar.chofer.usuarios?.foto_perfil ? (
                    <img src={viajeACompletar.chofer.usuarios.foto_perfil} alt="Chofer" className="w-full h-full object-cover" />
                  ) : (
                    <User size={22} className="text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">
                    {viajeACompletar.chofer.usuarios?.nombre || 'Chofer'} {viajeACompletar.chofer.usuarios?.apellido || ''}
                  </p>
                  <p className="text-zinc-400 text-xs truncate">
                    {viajeACompletar.chofer.vehiculo || 'Vehículo'}
                  </p>
                  {viajeACompletar.chofer.patente && (
                    <span className="text-[10px] text-zinc-500 font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 mt-1 inline-block uppercase tracking-tighter">
                      {viajeACompletar.chofer.patente}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Detalles del viaje */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3 border border-white/5">
                <span className="text-zinc-400 text-sm flex items-center gap-2"><CreditCard size={14} /> Importe final</span>
                <span className="text-emerald-400 font-black text-lg">${Number(viajeACompletar.final_price || viajeACompletar.precio || 0).toLocaleString()}</span>
              </div>

              {(viajeACompletar.distancia_recorrida || viajeACompletar.distancia_km) && (
                <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3 border border-white/5">
                  <span className="text-zinc-400 text-sm flex items-center gap-2"><Route size={14} /> Distancia</span>
                  <span className="text-white font-bold">{Number(viajeACompletar.distancia_recorrida || viajeACompletar.distancia_km || 0).toFixed(1)} km</span>
                </div>
              )}

              {viajeACompletar.wait_minutes != null && viajeACompletar.wait_minutes > 0 && (
                <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3 border border-white/5">
                  <span className="text-zinc-400 text-sm flex items-center gap-2"><Clock size={14} /> Tiempo de espera</span>
                  <span className="text-white font-bold">{viajeACompletar.wait_minutes} min</span>
                </div>
              )}

              {viajeACompletar.puntos_generados != null && viajeACompletar.puntos_generados > 0 && (
                <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3 border border-amber-500/10">
                  <span className="text-zinc-400 text-sm flex items-center gap-2"><Star size={14} className="text-amber-400" /> Puntos obtenidos</span>
                  <span className="text-amber-400 font-bold">+{viajeACompletar.puntos_generados}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setMostrarResumenViaje(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98]"
            >
              Continuar
            </button>
         </div>
      </div>
    )}

    {/* OVERLAY MODAL CALIFICACIÓN */}
    {viajeACompletar && !viajeActivo && !mostrarResumenViaje && (
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

            {/* Toggle Recomendación */}
            <div className="mb-4">
               <button
                 onClick={() => setRatingRecomendado(!ratingRecomendado)}
                 className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                   ratingRecomendado
                     ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                     : 'bg-black/20 border-white/5 text-zinc-500 hover:border-white/10'
                 }`}
               >
                 <span className="flex items-center gap-2 text-sm font-medium">
                   <ThumbsUp size={16} className={ratingRecomendado ? 'fill-emerald-400' : ''} />
                   Recomiendo a este chofer
                 </span>
                 <div className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${
                   ratingRecomendado ? 'bg-emerald-500 justify-end' : 'bg-zinc-700 justify-start'
                 }`}>
                   <div className="w-5 h-5 bg-white rounded-full shadow-md transition-all" />
                 </div>
               </button>
            </div>

            <div className="flex gap-3">
               <button 
                 onClick={() => { setViajeACompletar(null); setRatingRecomendado(false); }} 
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


    {/* MODAL BENEFICIOS */}
    <BeneficiosModal 
      isOpen={showBeneficiosModal} 
      onClose={() => setShowBeneficiosModal(false)} 
    />

    {/* MODAL EDICIÓN VIAJE */}
    {isEditingViaje && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
         <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setIsEditingViaje(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <XCircle size={20} />
            </button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
               <Edit2 className="text-amber-400" /> Editar Viaje
            </h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-zinc-400 text-sm mb-1">Nuevo Origen</label>
                  <input type="text" value={editOrigen} onChange={e => setEditOrigen(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-amber-500 transition-all" />
               </div>
               <div>
                  <label className="block text-zinc-400 text-sm mb-1">Nuevo Destino</label>
                  <input type="text" value={editDestino} onChange={e => setEditDestino(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-amber-500 transition-all" />
               </div>
               <div>
                  <label className="block text-zinc-400 text-sm mb-1">Observaciones</label>
                  <input type="text" value={editObservaciones} onChange={e => setEditObservaciones(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-amber-500 transition-all" />
               </div>
               <div>
                  <label className="block text-zinc-400 text-sm mb-1">Referencia</label>
                  <input type="text" value={editReferencia} onChange={e => setEditReferencia(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-amber-500 transition-all" />
               </div>
               <button 
                 onClick={handleGuardarEdicion}
                 disabled={loading}
                 className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
               >
                 {loading ? <Loader2 size={18} className="animate-spin text-black" /> : "Guardar Cambios"}
               </button>
            </div>
         </div>
      </div>
    )}
  </>
  );
}
