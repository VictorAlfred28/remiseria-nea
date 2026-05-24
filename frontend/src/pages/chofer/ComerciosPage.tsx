import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Store, Loader2, ChevronRight, ExternalLink, MapPin } from "lucide-react";

export default function ComerciosPage({ loadingComercios, promocionesComercio }: any) {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => navigate('/chofer')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 font-medium transition-colors text-sm w-fit">
                <ArrowLeft size={18} /> Volver al Panel
            </button>

            <h2 className="text-xl font-bold mb-4 text-orange-400 flex items-center gap-2"><Store size={20}/> Comercios Adheridos</h2>
            <p className="text-zinc-400 mb-6 text-sm">Descuentos y beneficios exclusivos para choferes en el centro comercial de la ciudad.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {loadingComercios ? (
                    <div className="col-span-full py-12 flex justify-center">
                        <Loader2 className="animate-spin text-orange-500" size={40} />
                    </div>
                ) : promocionesComercio?.length === 0 ? (
                    <div className="col-span-1 sm:col-span-2 text-center opacity-40 p-12 border border-dashed border-zinc-700 rounded-3xl my-4 bg-zinc-900/40">
                        <Store size={64} className="mx-auto mb-4 text-zinc-600" />
                        <p className="text-sm font-bold uppercase tracking-widest">No hay comercios con promociones activas.</p>
                    </div>
                ) : (
                    promocionesComercio?.map((promo: any) => (
                        <div key={promo.id} className="relative bg-zinc-900/80 border border-white/5 p-6 rounded-[2rem] shadow-2xl overflow-hidden group hover:border-orange-500/30 transition-all duration-500">
                            <div className="absolute top-4 right-4 bg-orange-500 text-black font-black text-xs px-3 py-1.5 rounded-full shadow-lg z-10">
                                {promo.tipo_descuento === 'porcentaje' ? `${promo.valor_descuento}% OFF` : `$${promo.valor_descuento} OFF`}
                            </div>

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

                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
