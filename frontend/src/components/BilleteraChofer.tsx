import { useState, useEffect } from "react";
import { getPagosChofer, uploadPagoChofer, getMyBalance } from "../services/api";
import { Loader2, Wallet, Upload, CheckCircle2, AlertCircle, Clock, Copy, Check, Inbox } from "lucide-react";
import logoUbi from "../../assets/icon.png";
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export default function BilleteraChofer() {
  const [balance, setBalance] = useState<number>(0);
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [monto, setMonto] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const bData = await getMyBalance();
      setBalance(Number(bData.saldo));
      const pData = await getPagosChofer();
      setPagos(pData || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenMercadoPago = async () => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (Capacitor.isNativePlatform()) {
      try {
        await Browser.open({ url: 'mercadopago://' });
      } catch (error) {
        console.warn("Error abriendo scheme nativo:", error);
        try {
          await Browser.open({ url: 'market://details?id=com.mercadopago.wallet' });
        } catch (marketError) {
          try {
            window.open('https://play.google.com/store/apps/details?id=com.mercadopago.wallet', '_blank');
          } catch (e) {
            alert("No se pudo abrir Mercado Pago. Instala la aplicación manualmente.");
          }
        }
      }
    } else if (isMobileDevice) {
      // Navegador móvil o PWA: Forzamos el deep link
      window.location.href = 'mercadopago://';
      // Fallback a Google Play si no tiene la app de Mercado Pago instalada
      setTimeout(() => {
        window.location.href = 'https://play.google.com/store/apps/details?id=com.mercadopago.wallet';
      }, 2500);
    } else {
      // Entorno Desktop Web
      window.open('https://www.mercadopago.com.ar/', '_blank');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Debes seleccionar una imagen del comprobante de transferencia.");
      return;
    }
    const finalAmount = Number(monto);
    if (finalAmount <= 0) {
      alert("Monto inválido.");
      return;
    }

    setPayLoading(true);
    try {
      const formData = new FormData();
      formData.append("monto", finalAmount.toString());
      formData.append("comprobante", file);

      await uploadPagoChofer(formData);
      
      alert("Comprobante enviado exitosamente y pendiente de validación.");
      setMonto("");
      setFile(null);
      fetchData();
    } catch (err: any) {
      alert("Error al subir comprobante: " + (err.response?.data?.detail || err.message));
    }
    setPayLoading(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-zinc-500 font-bold animate-pulse tracking-widest text-xs uppercase">Sincronizando Billetera...</p>
    </div>
  );

  const isDebt = balance < 0;
  const absBalance = Math.abs(balance);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        
        {/* COLUMNA IZQUIERDA */}
        <div className="xl:col-span-7 flex flex-col gap-6">
            
            <div className={`relative overflow-hidden p-6 sm:p-8 rounded-3xl border transition-all duration-500 ${isDebt ? 'bg-red-500/5 border-red-500/20 shadow-[0_10px_30px_-10px_rgba(239,68,68,0.15)]' : 'bg-blue-600/10 border-blue-500/30 shadow-[0_10px_30px_-10px_rgba(37,99,235,0.15)]'}`}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-white/10 to-transparent rounded-tr-3xl pointer-events-none" />
                
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Estado Corriente</h2>
                        <p className={`text-xs sm:text-sm font-bold ${isDebt ? 'text-red-400' : 'text-cyan-400'}`}>
                            {isDebt ? "⚠️ REQUERIDO: REGULARIZAR SALDO" : "✓ AL DÍA"}
                        </p>
                    </div>
                    <Wallet className={isDebt ? 'text-red-500/50' : 'text-blue-500/50'} size={32} />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-3xl font-light">$</span>
                    <h1 className={`text-5xl sm:text-7xl font-black tracking-tighter ${isDebt ? 'text-red-500' : 'text-white'}`}>
                        {absBalance.toLocaleString('es-AR')}
                    </h1>
                </div>
            </div>

            <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-3xl p-4 sm:p-7 shadow-xl w-full">
                <div className="flex items-center gap-3 mb-6">
                   <img src={logoUbi} alt="Traslados UBI" className="w-10 h-10 object-contain rounded-xl bg-white/5 p-1 border border-white/10" />
                   <h3 className="text-lg sm:text-xl font-black text-white">
                       Pagar a Administración
                   </h3>
                </div>
                
                <div className="bg-zinc-950/80 p-3 sm:p-5 rounded-2xl border border-blue-500/20 mb-6 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <p className="text-[10px] sm:text-xs text-blue-400 font-bold uppercase tracking-widest">Datos para Transferir</p>
                        <button 
                            type="button"
                            onClick={handleOpenMercadoPago}
                            className="bg-[#009EE3]/15 hover:bg-[#009EE3]/25 text-[#009EE3] text-[10px] sm:text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2 border border-[#009EE3]/30 transition-all active:scale-95 w-full sm:w-auto justify-center whitespace-nowrap"
                        >
                            <img src="/mercadopago_icon.png" alt="MP" className="w-4 h-4 object-contain rounded-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
                            ABRIR MERCADO PAGO
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-zinc-300 w-full">
                        <div className="bg-zinc-900/70 p-3 rounded-xl border border-white/5 flex flex-col justify-center min-w-0">
                            <span className="block text-[9px] sm:text-[10px] uppercase text-zinc-500 font-black mb-0.5">Banco</span>
                            <span className="font-bold text-white text-xs sm:text-sm truncate">Banco Provincia del Chaco</span>
                        </div>
                        <div className="bg-zinc-900/70 p-3 rounded-xl border border-white/5 flex flex-col justify-center min-w-0">
                            <span className="block text-[9px] sm:text-[10px] uppercase text-zinc-500 font-black mb-0.5">Titular</span>
                            <span className="font-bold text-white text-xs sm:text-sm truncate">TRASLADOS UBI S.R.L.</span>
                        </div>
                        
                        <div className="bg-zinc-900/70 p-3 rounded-xl border border-white/5 flex justify-between items-center group min-w-0 sm:col-span-1">
                            <div className="min-w-0 pr-2">
                                <span className="block text-[9px] sm:text-[10px] uppercase text-zinc-500 font-black mb-0.5">CBU</span>
                                <span className="font-bold text-white text-[11px] sm:text-sm tracking-tight break-all block">3110030211000012345678</span>
                            </div>
                            <button 
                                type="button"
                                onClick={() => copyToClipboard("3110030211000012345678", "cbu")}
                                className={`shrink-0 flex items-center justify-center p-2 rounded-lg transition-all active:scale-95 ${copiedField === 'cbu' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                                title="Copiar CBU"
                            >
                                {copiedField === 'cbu' ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                        
                        <div className="bg-zinc-900/70 p-3 rounded-xl border border-white/5 flex justify-between items-center group min-w-0 sm:col-span-1">
                            <div className="min-w-0 pr-2">
                                <span className="block text-[9px] sm:text-[10px] uppercase text-zinc-500 font-black mb-0.5">Alias</span>
                                <span className="font-bold text-white text-[11px] sm:text-sm tracking-tight break-all block">UBI.TRASLADOS.OFICIAL</span>
                            </div>
                            <button 
                                type="button"
                                onClick={() => copyToClipboard("UBI.TRASLADOS.OFICIAL", "alias")}
                                className={`shrink-0 flex items-center justify-center p-2 rounded-lg transition-all active:scale-95 ${copiedField === 'alias' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                                title="Copiar Alias"
                            >
                                {copiedField === 'alias' ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleUploadPago} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 mb-1.5 ml-1">Monto ($)</label>
                            <input 
                                type="number"
                                min="1"
                                step="any"
                                value={monto}
                                onChange={(e) => setMonto(e.target.value)}
                                required
                                placeholder={isDebt ? `${absBalance}` : "Ej: 5000"}
                                className="w-full bg-zinc-950/50 border border-zinc-700/50 p-3.5 rounded-xl text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 mb-1.5 ml-1">Comprobante</label>
                            <input 
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFileChange}
                                required
                                className="w-full bg-zinc-950/50 border border-zinc-700/50 p-2.5 rounded-xl text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 transition-all cursor-pointer h-[52px]"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={payLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 transition-all mt-2 text-sm uppercase tracking-wider"
                    >
                        {payLoading ? <Loader2 className="animate-spin" size={18} /> : <><Upload size={18}/> ENVIAR PAGO Y COMPROBANTE</>}
                    </button>
                </form>
            </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="xl:col-span-5 flex h-[400px] xl:h-auto">
            <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-3xl p-6 shadow-xl w-full flex flex-col">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                    <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-widest">Mis Pagos Enviados</h3>
                    <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-full border border-blue-500/20">{pagos.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                    {pagos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-60 text-center">
                            <Inbox size={48} className="mb-3 text-blue-500/50" />
                            <p className="text-xs font-bold tracking-widest uppercase text-zinc-400">Sin Movimientos</p>
                        </div>
                    ) : pagos.map((p) => {
                        const isPendiente = p.estado === 'PENDIENTE';
                        const isAprobado = p.estado === 'APROBADO';
                        const isRechazado = p.estado === 'RECHAZADO';
                        
                        return (
                            <div key={p.id} className="group bg-zinc-950/50 border border-white/5 p-4 rounded-2xl flex flex-col gap-2 hover:bg-zinc-800/50 transition-all">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl bg-zinc-900 border border-white/5`}>
                                            {isPendiente && <Clock className="text-yellow-500" size={16}/>}
                                            {isAprobado && <CheckCircle2 className="text-cyan-500" size={16}/>}
                                            {isRechazado && <AlertCircle className="text-red-500" size={16}/>}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm">${Number(p.monto).toLocaleString('es-AR')}</p>
                                            <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">
                                                {new Date(p.creado_en).toLocaleDateString('es-AR')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-[9px] uppercase font-black px-2 py-1 rounded-lg border ${isPendiente ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : isAprobado ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                        {p.estado}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-1 pt-2 border-t border-white/5">
                                    <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-blue-400 text-[10px] font-bold hover:underline uppercase tracking-wide">Ver Comprobante</a>
                                    {isRechazado && p.observaciones && <span className="text-[10px] text-red-400 italic truncate ml-2" title={p.observaciones}>{p.observaciones}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    </div>
  );
}
