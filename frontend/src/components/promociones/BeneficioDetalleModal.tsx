import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Star, Share2, Heart, MapPin, Clock,
  CheckCircle, AlertCircle, Tag, ChevronRight,
  Fuel, Droplets, Utensils, Wrench, ShieldCheck,
  Zap, ExternalLink,
} from 'lucide-react';
import type { Beneficio } from '../../types/beneficios';
import { PLACEHOLDER_BANNER } from '../../types/beneficios';
import { registrarActivacionBeneficio } from '../../services/beneficiosService';
import { useAuthStore } from '../../store/useAuthStore';

/* ── Mapa de íconos ──────────────────────────────────── */
const ICONS_MAP: Record<string, React.ComponentType<any>> = {
  Fuel, Droplets, Utensils, Wrench, ShieldCheck, Tag, Zap, Star,
};

interface BeneficioDetalleModalProps {
  /** La promoción a mostrar. null = modal cerrado. */
  promo: Beneficio | null;
  onClose: () => void;
}

export default function BeneficioDetalleModal({
  promo,
  onClose,
}: BeneficioDetalleModalProps) {
  const { user } = useAuthStore();

  const [isRendered, setIsRendered]       = useState(false);
  const [isVisible, setIsVisible]         = useState(false);
  const [isFav, setIsFav]                 = useState(false);
  const [activandoOferta, setActivando]   = useState(false);
  const [ofertaActivada, setActivada]     = useState(false);
  const [imgError, setImgError]           = useState(false);
  const scrollRef                         = useRef<HTMLDivElement>(null);

  const isOpen = !!promo;

  /* ── Ciclo de vida del modal ──────────────────────── */
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      setIsRendered(true);
      // Resetear estado al abrir nueva promo
      setIsFav(false);
      setActivada(false);
      setActivando(false);
      setImgError(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      const t = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(t);
    } else {
      setIsVisible(false);
      const t = setTimeout(() => {
        setIsRendered(false);
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }, 380);
      return () => clearTimeout(t);
    }
  }, [isOpen, promo?.id]);

  /* ── Cleanup en desmonte ──────────────────────────── */
  useEffect(() => () => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }, []);

  /* ── Activar oferta ───────────────────────────────── */
  const handleActivarOferta = async () => {
    if (ofertaActivada || !promo) return;
    setActivando(true);

    // Registrar en historial si hay usuario autenticado
    if (user?.id && promo.organizacionId !== 'demo') {
      await registrarActivacionBeneficio(promo.id, user.id, promo.organizacionId);
    }

    // Simular pequeño delay UX (en prod sería la respuesta del backend)
    await new Promise(r => setTimeout(r, 1000));

    setActivando(false);
    setActivada(true);
  };

  if (!isRendered || !promo) return null;

  const Icon    = ICONS_MAP[promo.iconName] ?? Tag;
  const accent  = promo.accentColorHex;
  const imgSrc  = imgError ? PLACEHOLDER_BANNER : (promo.imagenBanner || PLACEHOLDER_BANNER);

  return createPortal(
    /* ── Overlay ──────────────────────────────────────────── */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle: ${promo.titulo}`}
      className={`
        fixed inset-0 z-[10000]
        overflow-hidden
        flex items-end sm:items-center justify-center
        transition-all duration-380
        ${isVisible
          ? 'opacity-100 bg-black/80 backdrop-blur-md'
          : 'opacity-0 bg-transparent backdrop-blur-none pointer-events-none'
        }
      `}
      style={{ touchAction: 'none' }}
      onClick={onClose}
    >
      {/* ── Modal container ─────────────────────────────────── */}
      <div
        className={`
          relative w-full max-w-lg
          h-[95vh] sm:h-[90vh]
          flex flex-col bg-[#07090f]
          sm:rounded-[2.5rem] rounded-t-[2.5rem]
          overflow-hidden
          shadow-[0_-20px_80px_-8px_rgba(0,0,0,0.95)]
          transition-all duration-400
          ${isVisible
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-full sm:translate-y-8 sm:scale-[0.97] opacity-0'
          }
        `}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ══════════════════════════════════════════════════
            HERO — imagen + gradients + badges
        ══════════════════════════════════════════════════ */}
        <div className="relative flex-shrink-0 h-[38%] sm:h-[40%] overflow-hidden">
          <img
            src={imgSrc}
            alt={promo.titulo}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'brightness(0.65) saturate(1.2)' }}
          />

          {/* Gradientes de overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, ${promo.gradientFromHex}cc 0%, transparent 40%, #07090f 100%)`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090f] via-transparent to-transparent" />

          {/* Glow ambiental */}
          <div
            className="absolute -top-12 -right-12 w-64 h-64 rounded-full blur-[80px] pointer-events-none opacity-50"
            style={{ backgroundColor: accent }}
          />

          {/* Barra superior */}
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-5 pb-2 z-20">
            <button
              onClick={onClose}
              aria-label="Volver"
              className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl text-white text-sm font-bold transition-all hover:bg-black/60 active:scale-90"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Volver</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFav(f => !f)}
                aria-label="Guardar en favoritos"
                className={`p-2.5 rounded-2xl border backdrop-blur-xl transition-all active:scale-90 ${
                  isFav
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-black/40 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <Heart size={17} fill={isFav ? 'currentColor' : 'none'} />
              </button>
              <button
                aria-label="Compartir oferta"
                className="p-2.5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl text-zinc-400 hover:text-white transition-all active:scale-90"
              >
                <Share2 size={17} />
              </button>
            </div>
          </div>

          {/* Badges sobre la imagen */}
          <div className="absolute bottom-6 left-4 flex flex-wrap gap-2 z-10">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border backdrop-blur-xl"
              style={{ color: accent, borderColor: `${accent}50`, backgroundColor: `${accent}20` }}
            >
              <Icon size={11} />
              {promo.categoria}
            </span>
            {promo.destacado && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-amber-400/20 border border-amber-400/40 text-amber-300 backdrop-blur-xl">
                <Star size={10} fill="currentColor" />
                Destacado
              </span>
            )}
            {promo.esExclusivo && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-blue-500/20 border border-blue-500/40 text-blue-300 backdrop-blur-xl">
                <Zap size={10} fill="currentColor" />
                Exclusivo UBI
              </span>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            BODY SCROLLABLE
        ══════════════════════════════════════════════════ */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            WebkitOverflowScrolling: 'touch' as any,
            touchAction: 'pan-y',
            scrollBehavior: 'smooth',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 sm:px-7 pt-3 pb-8 space-y-5">

            {/* Comercio + título */}
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">
                {promo.comercioNombre}
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {promo.titulo}
              </h2>
            </div>

            {/* ── DESCUENTO — muy visual ─────────────────────── */}
            <div
              className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border"
              style={{
                background: `linear-gradient(135deg, ${promo.gradientFromHex}80 0%, #0d1020 100%)`,
                borderColor: `${accent}40`,
                boxShadow: `0 0 40px ${accent}25, inset 0 1px 0 ${accent}20`,
              }}
            >
              <div
                className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-[60px] opacity-40 pointer-events-none"
                style={{ backgroundColor: accent }}
              />
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: accent }}>
                    Tu beneficio
                  </p>
                  <div
                    className="text-5xl sm:text-6xl font-black leading-none tracking-tighter"
                    style={{ color: accent, textShadow: `0 0 30px ${accent}80` }}
                  >
                    {promo.descuentoLabel}
                  </div>
                  {promo.descuentoSublabel && (
                    <p className="text-sm text-zinc-400 font-medium mt-1.5">
                      {promo.descuentoSublabel}
                    </p>
                  )}
                </div>
                <div
                  className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center border"
                  style={{
                    backgroundColor: `${accent}15`,
                    borderColor: `${accent}30`,
                    boxShadow: `0 0 20px ${accent}20`,
                  }}
                >
                  <Icon size={32} style={{ color: accent }} />
                </div>
              </div>

              {/* Vigencia */}
              <div
                className="relative z-10 flex items-center gap-2 mt-4 pt-4 border-t"
                style={{ borderColor: `${accent}20` }}
              >
                <Clock size={13} className="text-zinc-500" />
                <span className="text-xs text-zinc-500 font-medium">{promo.vigencia}</span>
              </div>
            </div>

            {/* Descripción */}
            {promo.descripcion && (
              <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                {promo.descripcion}
              </p>
            )}

            {/* ── Productos / Servicios incluidos ───────────── */}
            {promo.productos.length > 0 && (
              <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 sm:p-5">
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Tag size={12} />
                  Incluye
                </h4>
                <div className="flex flex-wrap gap-2">
                  {promo.productos.map((prod, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border"
                      style={{
                        backgroundColor: `${accent}10`,
                        borderColor: `${accent}25`,
                        color: 'rgba(255,255,255,0.85)',
                      }}
                    >
                      <CheckCircle size={11} style={{ color: accent }} />
                      {prod}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Condiciones ──────────────────────────────── */}
            {promo.condiciones.length > 0 && (
              <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 sm:p-5">
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <AlertCircle size={12} />
                  Condiciones
                </h4>
                <ul className="space-y-2">
                  {promo.condiciones.map((cond, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs text-zinc-400 leading-relaxed">
                      <ChevronRight size={12} className="mt-0.5 flex-shrink-0 text-zinc-600" />
                      {cond}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Sucursales ───────────────────────────────── */}
            {promo.sucursales.length > 0 && (
              <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 sm:p-5">
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MapPin size={12} />
                  Sucursales válidas
                </h4>
                <ul className="space-y-2.5">
                  {promo.sucursales.map((suc, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }}
                      />
                      <span className="text-xs text-zinc-300 font-medium">{suc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Imagen promocional inferior ───────────────── */}
            <div className="relative rounded-3xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <img
                src={imgError ? PLACEHOLDER_BANNER : (promo.imagenProducto || PLACEHOLDER_BANNER)}
                alt={`Imagen de ${promo.titulo}`}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
                style={{ filter: 'brightness(0.85) saturate(1.15)' }}
              />
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  boxShadow: `inset 0 0 60px ${accent}30`,
                  border: `1px solid ${accent}25`,
                }}
              />
              <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#07090f]/80 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <Icon size={14} style={{ color: accent }} />
                <span className="text-xs font-black text-white tracking-wide">{promo.comercioNombre}</span>
              </div>
            </div>

            {/* Spacer para que el CTA flotante no tape contenido */}
            <div className="h-20" />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            CTA FLOTANTE — Activar Oferta
        ══════════════════════════════════════════════════ */}
        <div
          className="flex-shrink-0 absolute bottom-0 inset-x-0 px-5 pb-6 pt-4"
          style={{ background: 'linear-gradient(to top, #07090f 60%, transparent)' }}
        >
          <button
            onClick={handleActivarOferta}
            disabled={activandoOferta || ofertaActivada}
            className={`
              relative w-full py-4 rounded-2xl font-black text-sm tracking-widest
              transition-all duration-300 active:scale-95 overflow-hidden
              flex items-center justify-center gap-3
              ${ofertaActivada
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 cursor-default'
                : activandoOferta
                  ? 'opacity-80 cursor-wait text-white'
                  : 'text-white border border-white/10'
              }
            `}
            style={!ofertaActivada && !activandoOferta ? {
              background: `linear-gradient(135deg, ${accent} 0%, ${promo.gradientFromHex} 100%)`,
              boxShadow: `0 8px 32px ${accent}40, 0 0 0 1px ${accent}30`,
            } : undefined}
          >
            {/* Shimmer */}
            {!ofertaActivada && !activandoOferta && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-[shimmer_2.5s_infinite]" />
            )}

            {activandoOferta ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Activando oferta...
              </>
            ) : ofertaActivada ? (
              <>
                <CheckCircle size={18} />
                ¡Oferta activada! Mostrá tu app
              </>
            ) : (
              <>
                <ExternalLink size={16} />
                Activar Oferta
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
