import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Zap } from 'lucide-react';
import PromoCard from './PromoCard';
import type { Beneficio } from '../../types/beneficios';

interface PromoCarouselProps {
  promociones: Beneficio[];
  onVerOferta: (promo: Beneficio) => void;
}

export default function PromoCarousel({ promociones, onVerOferta }: PromoCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', skipSnaps: false },
    [Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  if (!promociones || promociones.length === 0) return null;

  return (
    <div className="relative mb-8 w-full group/carousel animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header del carrusel */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
          <Zap size={22} className="text-amber-400 animate-pulse" />
          Promociones Activas
        </h3>

        {/* Indicadores de paginación */}
        <div className="flex gap-1.5 items-center">
          {promociones.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === selectedIndex ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Ir a la promoción ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Viewport del carrusel */}
      <div className="overflow-hidden rounded-3xl" ref={emblaRef}>
        <div className="flex touch-pan-y -ml-4">
          {promociones.map((promo) => (
            <div
              key={promo.id}
              className="flex-[0_0_100%] min-w-0 pl-4 sm:flex-[0_0_85%] md:flex-[0_0_60%] lg:flex-[0_0_45%] xl:flex-[0_0_40%]"
            >
              <div className="h-full">
                <PromoCard promo={promo} onVerOferta={onVerOferta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
