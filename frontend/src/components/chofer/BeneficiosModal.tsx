import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Store, Gift, Coffee, ShoppingBag, Wrench, Fuel, Zap, Ticket,
  RefreshCw, WifiOff,
} from 'lucide-react';
import PromoCarousel from '../promociones/PromoCarousel';
import BeneficioDetalleModal from '../promociones/BeneficioDetalleModal';
import { useBeneficios } from '../../hooks/useBeneficios';
import { useAuthStore } from '../../store/useAuthStore';
import type { Beneficio } from '../../types/beneficios';

interface BeneficiosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BeneficiosModal({ isOpen, onClose }: BeneficiosModalProps) {
  // orgId proviene de public.usuarios (leído en checkSession) — es el UUID correcto.
  // No usar user?.organizacion_id: user = auth.users y NO tiene ese campo.
  const { orgId } = useAuthStore();

  // ── Estado de animación del modal principal ─────────────
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible]   = useState(false);

  // ── Estado del modal de detalle ─────────────────────────
  const [selectedPromo, setSelectedPromo] = useState<Beneficio | null>(null);

  // ── Datos dinámicos desde Supabase ──────────────────────
  const { beneficios, comerciosAdheridos, loading, error, refetch, usingMock } = useBeneficios(orgId);

  // ── Ciclo de vida del modal principal ───────────────────
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      setIsRendered(true);
      const t = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      setIsVisible(false);
      // Si hay modal de detalle abierto, cerrarlo también
      setSelectedPromo(null);
      const t = setTimeout(() => setIsRendered(false), 400);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Cleanup en unmount ──────────────────────────────────
  useEffect(() => () => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }, []);

  // ── Comercios adheridos (reales desde backend) ──
  // Ya no se usan mocks aquí. La lista viene de comerciosAdheridos.

  if (!isRendered) return null;

  return (
    <>
      {/* ══════════════════════════════════════════════════════════
          MODAL PRINCIPAL BENEFICIOS
      ══════════════════════════════════════════════════════════ */}
      {createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Beneficios"
          className={`
            fixed inset-0 z-[9999]
            overflow-hidden
            flex items-center justify-center
            p-3 sm:p-5 md:p-8
            transition-all duration-400
            ${isVisible
              ? 'opacity-100 bg-black/75 backdrop-blur-md'
              : 'opacity-0 bg-transparent backdrop-blur-none pointer-events-none'
            }
          `}
          style={{ touchAction: 'none' }}
          onClick={onClose}
        >
          {/* ── Modal container ─────────────────────────────── */}
          <div
            className={`
              relative w-full max-w-5xl
              h-[92vh] max-h-[92vh]
              overflow-hidden flex flex-col
              bg-[#0A0D14]/98
              border border-white/10
              rounded-[2.5rem]
              shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)]
              transition-all duration-400
              ${isVisible
                ? 'scale-100 translate-y-0 opacity-100'
                : 'scale-[0.97] translate-y-6 opacity-0'
              }
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow ambiental */}
            <div className="absolute top-0 left-1/4 w-96 h-48 bg-orange-500/10 blur-[120px] pointer-events-none rounded-full" />
            <div className="absolute bottom-0 right-1/4 w-96 h-48 bg-cyan-500/10 blur-[120px] pointer-events-none rounded-full" />

            {/* ─────────── HEADER ESTÁTICO ─────────────────── */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 sm:px-9 sm:py-6 border-b border-white/5 bg-[#0A0D14]/90 backdrop-blur-xl rounded-t-[2.5rem] z-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                  <Gift className="text-orange-400" size={26} />
                  Beneficios
                </h2>
                <p className="text-zinc-500 text-xs sm:text-sm mt-0.5 font-medium tracking-wide">
                  Descuentos y promociones exclusivas
                  {usingMock && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-500/70 text-[10px]">
                      · MODO DEMO
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Botón refrescar (útil en modo error) */}
                {error && (
                  <button
                    onClick={refetch}
                    aria-label="Reintentar carga"
                    className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-zinc-400 hover:text-amber-400"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}

                <button
                  onClick={onClose}
                  aria-label="Cerrar modal de beneficios"
                  className="flex-shrink-0 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all duration-300 text-zinc-400 hover:text-white hover:scale-105 active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* ─────────── BODY SCROLLABLE INTERNO ────────── */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch' as any,
                touchAction: 'pan-y',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 sm:p-8 space-y-6 pb-10">

                {/* ── Estado: cargando ───────────────────── */}
                {loading && (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-6 bg-white/5 rounded-2xl w-48" />
                    <div className="h-48 bg-white/5 rounded-3xl" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-32 bg-white/5 rounded-3xl" />
                      <div className="h-32 bg-white/5 rounded-3xl" />
                    </div>
                  </div>
                )}

                {/* ── Estado: error de red ───────────────── */}
                {!loading && error && (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                    <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/20">
                      <WifiOff size={32} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Sin conexión</p>
                      <p className="text-zinc-500 text-xs mt-1">{error}</p>
                    </div>
                    <button
                      onClick={refetch}
                      className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                    >
                      <RefreshCw size={14} />
                      Reintentar
                    </button>
                  </div>
                )}

                {/* ── Contenido principal ────────────────── */}
                {!loading && (
                  <>
                    {/* Carrusel de Promociones dinámicas */}
                    {beneficios.length > 0 ? (
                      <PromoCarousel
                        promociones={beneficios}
                        onVerOferta={setSelectedPromo}
                      />
                    ) : (
                      /* Estado vacío */
                      <div className="flex flex-col items-center justify-center py-10 gap-3 border border-dashed border-white/10 rounded-3xl bg-black/20">
                        <Zap size={32} className="text-zinc-600 opacity-40" />
                        <p className="text-zinc-500 text-sm font-medium text-center">
                          No hay promociones activas en este momento.
                        </p>
                      </div>
                    )}

                    {/* Grid 2 columnas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                      {/* ── Comercios Adheridos ──────────── */}
                      <div className="bg-[#111520]/80 border border-white/5 rounded-[2rem] p-5 sm:p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 blur-[80px] pointer-events-none" />
                        <h4 className="text-base font-bold text-orange-400 mb-2 flex items-center gap-2.5">
                          <Store size={18} className="text-orange-500" />
                          Comercios Adheridos
                        </h4>
                        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                          Descuentos y beneficios exclusivos en el centro comercial de la ciudad.
                        </p>
                        <div className="space-y-2.5 relative z-10">
                          {comerciosAdheridos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-6 border border-dashed border-white/10 rounded-2xl bg-black/20">
                              <Store size={28} className="text-zinc-600 opacity-40 mb-2" />
                              <p className="text-zinc-500 text-xs font-medium text-center px-4">
                                No hay comercios adheridos disponibles.
                              </p>
                            </div>
                          ) : (
                            comerciosAdheridos.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group/item"
                              >
                                <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/5 group-hover/item:scale-110 transition-transform shadow-inner flex items-center justify-center overflow-hidden shrink-0">
                                  {c.logo_url ? (
                                    <img src={c.logo_url} alt={c.nombre_comercio} className="w-full h-full object-cover" />
                                  ) : (
                                    <Store size={20} className="text-orange-400" />
                                  )}
                                </div>
                                <div>
                                  <h5 className="font-bold text-white tracking-tight text-sm line-clamp-1">{c.nombre_comercio}</h5>
                                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                                    {c.rubro ? <span className="text-orange-400 font-medium">{c.rubro}</span> : "General"}
                                    {c.direccion && ` • ${c.direccion}`}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* ── Tus Beneficios ───────────────── */}
                      <div className="bg-[#111520]/80 border border-white/5 rounded-[2rem] p-5 sm:p-6 flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 blur-[80px] pointer-events-none" />
                        <h4 className="text-base font-bold text-purple-400 mb-2 flex items-center gap-2.5">
                          <Gift size={18} className="text-purple-500" />
                          Tus Beneficios
                        </h4>
                        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                          Recompensas exclusivas habilitadas por tu empresa en comercios adheridos.
                        </p>

                        <div className="flex flex-col items-center justify-center py-7 mb-4 border border-dashed border-white/10 rounded-3xl bg-black/20 relative z-10">
                          <Gift size={34} className="text-zinc-600 mb-3 opacity-40" />
                          <p className="text-zinc-500 text-xs font-medium text-center">
                            No hay beneficios disponibles en este momento.
                          </p>
                        </div>

                        <div className="space-y-2.5 relative z-10">
                          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-black/40 border border-white/5 cursor-pointer hover:border-purple-500/30 transition-all group/btn">
                            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl group-hover/btn:scale-110 transition-transform">
                              <Ticket size={17} />
                            </div>
                            <span className="font-bold text-sm text-white tracking-wide">Cupón de servicio</span>
                          </div>
                          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-black/40 border border-white/5 cursor-pointer hover:border-emerald-500/30 transition-all group/btn">
                            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover/btn:scale-110 transition-transform">
                              <Zap size={17} />
                            </div>
                            <span className="font-bold text-sm text-white tracking-wide">Descuento activo</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL DE DETALLE — se apila sobre el principal (z-[10000])
      ══════════════════════════════════════════════════════════ */}
      <BeneficioDetalleModal
        promo={selectedPromo}
        onClose={() => setSelectedPromo(null)}
      />
    </>
  );
}
