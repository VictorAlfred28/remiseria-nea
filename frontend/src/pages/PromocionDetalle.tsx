import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, 
  ExternalLink, 
  Store, 
  Calendar, 
  Clock, 
  Loader2, 
  Tag, 
  Info,
  MapPin,
  Phone,
  Mail,
  Zap
} from "lucide-react";

export default function PromocionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [promo, setPromo] = useState<any>(null);
  const [comercio, setComercio] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch promo
      const { data: promoData, error: promoError } = await supabase
        .from('promociones')
        .select('*')
        .eq('id', id)
        .single();

      if (promoError) throw promoError;
      setPromo(promoData);

      // Fetch comercio if linked
      if (promoData.comercio_id) {
        const { data: comercioData } = await supabase
          .from('comercios')
          .select('*')
          .eq('id', promoData.comercio_id)
          .single();
        setComercio(comercioData);
      }
    } catch (err) {
      console.error("Error fetching promotion details:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-zinc-500 font-medium animate-pulse">Cargando detalles de la promoción...</p>
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
        <div className="bg-red-500/10 p-4 rounded-full">
           <Info className="text-red-500" size={48} />
        </div>
        <h2 className="text-2xl font-bold text-white">Promoción no encontrada</h2>
        <button 
          onClick={() => navigate(-1)}
          className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl transition-all"
        >
          Volver atrás
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-500">
      {/* Botón Volver */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 group"
      >
        <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </div>
        <span className="font-medium text-sm">Volver al Dashboard</span>
      </button>

      {/* Header Card */}
      <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {/* Banner Image o Background decorativo */}
        <div className="h-48 md:h-64 relative bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent">
          {promo.imagen_url ? (
            <img 
              src={promo.imagen_url} 
              alt={promo.titulo} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
               <Tag className="text-blue-500/10 absolute -right-10 -bottom-10 rotate-12" size={300} />
               <Zap className="text-blue-500/20" size={120} />
            </div>
          )}
          
          {/* Badge de Descuento */}
          {promo.valor_descuento > 0 && (
            <div className="absolute top-6 right-6 bg-blue-600 text-white px-4 py-2 rounded-2xl font-black text-xl shadow-xl shadow-blue-500/20 border border-white/20 animate-in zoom-in-95 duration-700 delay-300">
              {promo.tipo_descuento === 'porcentaje' ? `${promo.valor_descuento}%` : `$${promo.valor_descuento}`} <span className="text-xs font-light opacity-80 uppercase tracking-widest ml-1">OFF</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 relative">
          <div className="flex flex-col md:flex-row gap-12">
            
            {/* Main Info */}
            <div className="flex-1 space-y-8">
              <div>
                <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4 tracking-tight">
                  {promo.titulo}
                </h1>
                <p className="text-zinc-400 text-lg leading-relaxed whitespace-pre-wrap">
                  {promo.descripcion}
                </p>
              </div>

              {/* Grid de Detalles Técnicos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {promo.puntos_requeridos > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-3xl flex items-center gap-4">
                    <div className="bg-amber-500/20 p-2.5 rounded-2xl">
                      <Zap className="text-amber-500" size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Requisito</p>
                      <p className="text-lg font-bold text-white">{promo.puntos_requeridos} Puntos</p>
                    </div>
                  </div>
                )}
                
                <div className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-4">
                  <div className="bg-blue-500/20 p-2.5 rounded-2xl">
                    <Calendar className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Vigencia</p>
                    <p className="text-white font-bold">
                      {promo.fecha_inicio && promo.fecha_fin 
                        ? `${new Date(promo.fecha_inicio).toLocaleDateString()} - ${new Date(promo.fecha_fin).toLocaleDateString()}`
                        : "Promoción activa por tiempo limitado"
                      }
                    </p>
                  </div>
                </div>

                {promo.horario_inicio && (
                  <div className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-4">
                    <div className="bg-purple-500/20 p-2.5 rounded-2xl">
                      <Clock className="text-purple-400" size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Horario</p>
                      <p className="text-white font-bold">{promo.horario_inicio.substring(0,5)} a {promo.horario_fin?.substring(0,5)} hs</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar: Comercio & Social */}
            <div className="md:w-72 flex flex-col gap-6">
              {(comercio || promo.comercio_id) && (
                <div className="bg-zinc-950/50 border border-white/5 p-6 rounded-[2rem] space-y-6">
                  <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Store size={14} /> Comercio Adherido
                  </h3>
                  
                  {comercio ? (
                    <>
                      <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                        <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0">
                          {comercio.logo_url ? (
                            <img src={comercio.logo_url} alt={comercio.nombre_comercio} className="w-full h-full object-cover" />
                          ) : (
                            <Store className="text-blue-400" size={32} />
                          )}
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white leading-tight">{comercio.nombre_comercio}</p>
                          <p className="text-blue-400 text-xs font-medium uppercase tracking-wider mt-0.5">{comercio.rubro}</p>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm text-zinc-400">
                        {comercio.direccion && (
                          <div className="flex gap-3">
                            <MapPin className="text-zinc-500 shrink-0" size={16} />
                            <span>{comercio.direccion}</span>
                          </div>
                        )}
                        {comercio.telefono && (
                          <div className="flex gap-3">
                            <Phone className="text-zinc-500 shrink-0" size={16} />
                            <span>{comercio.telefono}</span>
                          </div>
                        )}
                        {comercio.email && (
                          <div className="flex gap-3">
                            <Mail className="text-zinc-500 shrink-0" size={16} />
                            <span className="truncate">{comercio.email}</span>
                          </div>
                        )}
                      </div>

                      {/* Botones Sociales */}
                      <div className="pt-2 flex flex-col gap-3">
                        {(comercio.instagram_url || promo.instagram_url) && (
                          <a 
                            href={comercio.instagram_url || promo.instagram_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-[1.02] active:scale-95 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                          >
                            <ExternalLink size={18} /> Instagram
                          </a>
                        )}
                        {(comercio.facebook_url || promo.facebook_url) && (
                          <a 
                            href={comercio.facebook_url || promo.facebook_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full bg-[#1877F2] hover:scale-[1.02] active:scale-95 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                          >
                            <ExternalLink size={18} /> Facebook
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-zinc-900 rounded-2xl text-center">
                       <p className="text-zinc-500 text-xs italic">Cargando datos del comercio...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Info Extra para Socios */}
              <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-[2rem]">
                 <p className="text-xs text-blue-300/70 font-medium leading-relaxed">
                   Presentá tu Carnet Digital Socio en el local para acceder a este beneficio exclusivo. Club Viajes NEA.
                 </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
