import React from 'react';
import { Fuel, Droplets, Utensils, Wrench, ShieldCheck, Tag, Zap, Star } from 'lucide-react';
import type { Beneficio } from '../../types/beneficios';

const ICONS_MAP: Record<string, React.ComponentType<any>> = {
  Fuel, Droplets, Utensils, Wrench, ShieldCheck, Tag, Zap, Star,
};

interface PromoCardProps {
  promo: Beneficio;
  onVerOferta: (promo: Beneficio) => void;
}

export default function PromoCard({ promo, onVerOferta }: PromoCardProps) {
  const Icon = ICONS_MAP[promo.iconName] ?? Tag;
  const accent = promo.accentColorHex;

  return (
    <div
      className="relative h-full overflow-hidden rounded-3xl border bg-black/40 p-6 sm:p-8 shadow-xl transition-all group flex flex-col justify-between"
      style={{ borderColor: `${accent}40` }}
    >
      {/* Background Gradient & Glow — dinámicos desde DB */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100"
        style={{ background: `linear-gradient(135deg, ${accent}20 0%, transparent 70%)` }}
      />
      <div
        className="absolute -top-20 -right-20 w-48 h-48 blur-[60px] pointer-events-none rounded-full transition-all duration-700 opacity-40 group-hover:opacity-70"
        style={{ backgroundColor: accent }}
      />

      {/* Encabezado: ícono + categoría + título */}
      <div className="relative z-10 flex items-start gap-4 mb-6">
        <div
          className="p-4 rounded-2xl bg-black/50 border border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-500"
          style={{ color: accent }}
        >
          <Icon size={28} />
        </div>
        <div>
          {/* Badge categoría */}
          <span
            className="inline-block px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 shadow-sm"
            style={{ color: accent }}
          >
            {promo.categoria}
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
            {promo.titulo}
          </h3>
        </div>
      </div>

      {/* Footer: comercio + CTA */}
      <div className="relative z-10 mt-auto">
        <p className="text-sm text-zinc-300 font-medium leading-relaxed mb-6 line-clamp-2">
          {promo.descripcion}
        </p>
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider truncate pr-2">
            {promo.comercioNombre}
          </span>
          <button
            onClick={() => onVerOferta(promo)}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-white/5 border border-white/10 transition-all shadow-sm hover:scale-105 active:scale-95"
            style={{ color: accent }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = `${accent}20`;
              (e.currentTarget as HTMLElement).style.borderColor = `${accent}40`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            Ver Oferta
          </button>
        </div>
      </div>
    </div>
  );
}
