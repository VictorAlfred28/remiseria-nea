import { useState, useEffect } from "react";
import { getMisRecaudaciones } from "../../services/api";
import { Loader2, TrendingUp, DollarSign, Calendar, MapPin, Inbox, AlertCircle } from "lucide-react";

export default function RecaudacionesChofer() {
  const [loading, setLoading] = useState(true);
  const [rango, setRango] = useState("30_dias");
  const [data, setData] = useState<any>({
    totales: { 
      recaudacion_bruta_total: 0, 
      comisiones_registradas: 0, 
      recaudacion_con_comision_registrada: 0, 
      ganancia_neta_verificable: 0,
      viajes_total: 0,
      viajes_con_comision_registrada: 0,
      viajes_sin_comision_historica: 0
    },
    viajes: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getMisRecaudaciones(rango);
      setData(res);
    } catch (err) {
      console.error("Error fetching recaudaciones:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [rango]);

  const hasMissingHistory = data.totales.viajes_sin_comision_historica > 0;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      
      {/* HEADER Y FILTRO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#12121A] border border-white/10 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <TrendingUp className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Mis Ganancias</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Resumen Financiero</p>
          </div>
        </div>
        
        <select 
          value={rango}
          onChange={(e) => setRango(e.target.value)}
          className="bg-black/50 border border-white/10 text-white text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all cursor-pointer w-full sm:w-auto uppercase tracking-widest"
        >
          <option value="hoy">Hoy</option>
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mes</option>
          <option value="30_dias">Últimos 30 Días</option>
          <option value="todo">Histórico Completo</option>
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="animate-spin text-blue-500" size={48} />
          <p className="text-zinc-500 font-bold animate-pulse tracking-widest text-xs uppercase">Calculando Totales...</p>
        </div>
      ) : (
        <>
          {hasMissingHistory && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-bold text-yellow-500">Atención: Historial Parcial</p>
                <p className="text-xs text-yellow-500/80 mt-1">
                  En este período hay {data.totales.viajes_sin_comision_historica} viaje(s) antiguo(s) que no tienen registro del importe de la comisión deducida. 
                  La <strong>Ganancia Neta Verificable</strong> se calcula únicamente sobre los {data.totales.viajes_con_comision_registrada} viajes que sí tienen comisión registrada.
                </p>
              </div>
            </div>
          )}

          {/* TARJETAS DE TOTALES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Bruto */}
            <div className="bg-[#12121A] border border-white/5 p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[140px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none" />
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">
                Total Cobrado (Todos los {data.totales.viajes_total} viajes)
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 text-xl font-light">$</span>
                <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter">
                  {Number(data.totales.recaudacion_bruta_total).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Comisiones */}
            <div className="bg-[#1A0A0A] border border-red-500/10 p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-center min-h-[140px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none" />
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-black text-red-500/70 uppercase tracking-widest">
                  Comisiones Registradas ({data.totales.viajes_con_comision_registrada} viajes)
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-red-500/50 text-xl font-light">-$</span>
                <span className="text-3xl sm:text-4xl font-black text-red-400 tracking-tighter">
                  {Number(data.totales.comisiones_registradas).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Neta */}
            <div className="bg-[#0A1915] border border-emerald-500/20 p-6 rounded-3xl shadow-[0_10px_30px_-10px_rgba(16,185,129,0.15)] relative overflow-hidden flex flex-col justify-center min-h-[140px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full pointer-events-none" />
              <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">
                Ganancia Neta Verificable
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-500/70 text-2xl font-light">$</span>
                <span className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tighter">
                  {Number(data.totales.ganancia_neta_verificable).toLocaleString('es-AR')}
                </span>
              </div>
              {hasMissingHistory && (
                <p className="text-[10px] text-emerald-500/60 font-bold mt-2 uppercase tracking-wide">
                  *Excluye {data.totales.viajes_sin_comision_historica} viajes sin comisión disp.
                </p>
              )}
            </div>
            
          </div>

          {/* LISTA DE VIAJES */}
          <div className="bg-[#12121A] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col">
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-widest mb-5 pb-4 border-b border-white/5">
              Historial de Viajes
            </h3>
            
            <div className="flex flex-col gap-4">
              {data.viajes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-60 text-center">
                  <Inbox size={48} className="mb-4 text-zinc-600" />
                  <p className="text-sm font-bold tracking-widest uppercase text-zinc-500">No hay viajes en este período</p>
                </div>
              ) : (
                data.viajes.map((viaje: any) => {
                  const isHistorial = viaje.comision_aplicada === null;
                  const gananciaViaje = isHistorial ? viaje.precio : Number(viaje.precio) - Number(viaje.comision_aplicada);
                  
                  return (
                    <div key={viaje.id} className="bg-[#1A1A24] border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#20202C] transition-all">
                      
                      {/* Fechas y Rutas */}
                      <div className="flex-1 min-w-0 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-bold uppercase tracking-wider">
                          <Calendar size={14} className="text-blue-400" />
                          {new Date(viaje.creado_en).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start gap-2">
                            <MapPin size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-zinc-300 font-medium truncate">{viaje.origen?.direccion || 'Origen'}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin size={16} className="text-red-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-zinc-300 font-medium truncate">{viaje.destino?.direccion || 'Destino'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Importes */}
                      <div className="shrink-0 flex flex-col md:items-end gap-2 bg-black/20 p-3 rounded-xl border border-white/5">
                        
                        <div className="flex justify-between md:justify-end gap-4 w-full text-sm">
                          <span className="text-zinc-500 uppercase font-black text-[10px]">Bruto</span>
                          <span className="text-white font-bold">${Number(viaje.precio).toLocaleString('es-AR')}</span>
                        </div>
                        
                        {isHistorial ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-yellow-500/80 bg-yellow-500/10 px-2 py-1 rounded font-bold uppercase tracking-wide">
                            <AlertCircle size={12} />
                            Comisión Histórica No Disp.
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between md:justify-end gap-4 w-full text-sm">
                              <span className="text-red-500/50 uppercase font-black text-[10px]">Comisión</span>
                              <span className="text-red-400 font-bold">-${Number(viaje.comision_aplicada).toLocaleString('es-AR')}</span>
                            </div>
                            <div className="flex justify-between md:justify-end gap-4 w-full text-base border-t border-white/5 pt-2 mt-1">
                              <span className="text-emerald-500/70 uppercase font-black text-[10px] pt-1">Neta</span>
                              <span className="text-emerald-400 font-black">${gananciaViaje.toLocaleString('es-AR')}</span>
                            </div>
                          </>
                        )}

                      </div>
                      
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
