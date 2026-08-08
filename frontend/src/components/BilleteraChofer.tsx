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
    
    const webUrl = 'https://www.mercadopago.com.ar/';
    // Intent Android Oficial sugerido
    const intentUrl = 'intent://www.mercadopago.com.ar/#Intent;scheme=https;package=com.mercadopago.wallet;end;';
    const fallbackPlayStore = 'https://play.google.com/store/apps/details?id=com.mercadopago.wallet';
    

    if (Capacitor.isNativePlatform() || isMobileDevice) {
      
      let fallbackTimer: any;
      
      const handleVisibility = () => {
         if (document.hidden) {
             if (fallbackTimer) clearTimeout(fallbackTimer);
             document.removeEventListener("visibilitychange", handleVisibility);
         }
      };
      
      document.addEventListener("visibilitychange", handleVisibility);
      
      // Se utiliza location.href para delegar el Intent al Webview Nativo
      window.location.href = intentUrl;
      
      // El timeout se amplía a 3 segundos para dar tiempo suficiente al OS de resolver el intent
      fallbackTimer = setTimeout(() => {
        document.removeEventListener("visibilitychange", handleVisibility);
        
        if (Capacitor.isNativePlatform()) {
             // En capacitor nativo es seguro usar el scheme market:// para abrir la tienda nativa sin romper el DOM
             window.location.href = 'market://details?id=com.mercadopago.wallet';
        } else {
             window.open(fallbackPlayStore, '_blank');
        }
      }, 3000);
      
    } else {
      window.open(webUrl, '_blank');
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
        <div className="xl:col-span-7 flex flex-col gap-4 sm:gap-6">
            
            <div className={`relative overflow-hidden p-4 sm:p-6 rounded-3xl border transition-all duration-500 ${isDebt ? 'bg-[#2A0808] border-red-500/30 shadow-[0_10px_30px_-10px_rgba(239,68,68,0.2)]' : 'bg-[#0A1931] border-blue-500/40 shadow-[0_10px_30px_-10px_rgba(37,99,235,0.2)]'}`}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-white/10 to-transparent rounded-tr-3xl pointer-events-none" />
                
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div>
                        <h2 className="text-xs sm:text-sm font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Estado Corriente</h2>
                        <p className={`text-sm sm:text-base font-bold ${isDebt ? 'text-red-400' : 'text-cyan-400'}`}>
                            {isDebt ? "⚠️ REQUERIDO: REGULARIZAR SALDO" : "✓ AL DÍA"}
                        </p>
                    </div>
                    <Wallet className={isDebt ? 'text-red-500/50' : 'text-blue-500/50'} size={36} />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-3xl sm:text-4xl font-light">$</span>
                    <h1 className={`text-6xl sm:text-7xl font-black tracking-tighter ${isDebt ? 'text-red-500' : 'text-white'}`}>
                        {absBalance.toLocaleString('es-AR')}
                    </h1>
                </div>
            </div>

            <div className="bg-[#12121A] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl w-full">
                <div className="flex items-center gap-3 mb-5 sm:mb-6">
                   <img src={logoUbi} alt="Traslados UBI" className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-xl bg-white/5 p-1 border border-white/10" />
                   <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">
                       Pagar a Administración
                   </h3>
                </div>
                
                <div className="bg-black/40 p-4 sm:p-5 rounded-2xl border border-white/5 mb-6 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <p className="text-xs sm:text-sm text-blue-400 font-bold uppercase tracking-widest">Datos para Transferir</p>
                        <button 
                            type="button"
                            onClick={handleOpenMercadoPago}
                            className="bg-[#009EE3]/10 hover:bg-[#009EE3]/20 text-[#009EE3] text-xs sm:text-sm font-black px-5 py-3 rounded-xl flex items-center gap-2 border border-[#009EE3]/20 shadow-[0_0_15px_rgba(0,158,227,0.15)] transition-all active:scale-95 w-full sm:w-auto justify-center whitespace-nowrap"
                        >
                            <img src="/mercadopago_icon.png" alt="MP" className="w-5 h-5 object-contain rounded-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
                            ABRIR MERCADO PAGO
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-sm text-zinc-300 w-full">
                        <div className="bg-white/10 p-3 sm:p-3.5 rounded-xl border border-white/5 flex flex-col justify-center min-w-0">
                            <span className="block text-[10px] sm:text-xs uppercase text-zinc-400 font-black mb-1">Banco</span>
                            <span className="font-bold text-white text-[13px] sm:text-base truncate">Banco Provincia del Chaco</span>
                        </div>
                        <div className="bg-white/10 p-3 sm:p-3.5 rounded-xl border border-white/5 flex flex-col justify-center min-w-0">
                            <span className="block text-[10px] sm:text-xs uppercase text-zinc-400 font-black mb-1">Titular</span>
                            <span className="font-bold text-white text-[13px] sm:text-base truncate">TRASLADOS UBI S.R.L.</span>
                        </div>
                        
                        <div className="bg-white/10 p-2 sm:p-3.5 rounded-xl border border-white/5 flex justify-between items-center group min-w-0 sm:col-span-1 pl-3 sm:pl-3.5">
                            <div className="min-w-0 pr-2 flex-1">
                                <span className="block text-[10px] sm:text-xs uppercase text-zinc-500 font-black mb-1">CBU</span>
                                <span className="font-bold text-white text-[12px] min-[375px]:text-[13px] sm:text-base tracking-tighter sm:tracking-tight whitespace-nowrap block">3110030211000012345678</span>
                            </div>
                            <button 
                                type="button"
                                onClick={() => copyToClipboard("3110030211000012345678", "cbu")}
                                className={`shrink-0 flex items-center justify-center p-2.5 sm:p-2.5 rounded-lg transition-all active:scale-95 ${copiedField === 'cbu' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-black/20 text-zinc-400 hover:text-white hover:bg-black/40'}`}
                                title="Copiar CBU"
                            >
                                {copiedField === 'cbu' ? <Check size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Copy size={16} className="sm:w-[18px] sm:h-[18px]" />}
                            </button>
                        </div>
                        
                        <div className="bg-white/10 p-2 sm:p-3.5 rounded-xl border border-white/5 flex justify-between items-center group min-w-0 sm:col-span-1 pl-3 sm:pl-3.5">
                            <div className="min-w-0 pr-2 flex-1">
                                <span className="block text-[10px] sm:text-xs uppercase text-zinc-400 font-black mb-1">Alias</span>
                                <span className="font-bold text-white text-[12px] min-[375px]:text-[13px] sm:text-base tracking-tighter sm:tracking-tight whitespace-nowrap block">UBI.TRASLADOS.OFICIAL</span>
                            </div>
                            <button 
                                type="button"
                                onClick={() => copyToClipboard("UBI.TRASLADOS.OFICIAL", "alias")}
                                className={`shrink-0 flex items-center justify-center p-2.5 sm:p-2.5 rounded-lg transition-all active:scale-95 ${copiedField === 'alias' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-black/20 text-zinc-400 hover:text-white hover:bg-black/40'}`}
                                title="Copiar Alias"
                            >
                                {copiedField === 'alias' ? <Check size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Copy size={16} className="sm:w-[18px] sm:h-[18px]" />}
                            </button>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleUploadPago} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                        <div>
                            <label className="block text-sm font-bold text-zinc-400 mb-2 ml-1">Monto ($)</label>
                            <input 
                                type="number"
                                min="1"
                                step="any"
                                value={monto}
                                onChange={(e) => setMonto(e.target.value)}
                                required
                                placeholder={isDebt ? `${absBalance}` : "Ej: 5000"}
                                className="w-full bg-black/40 border border-white/10 px-4 h-[52px] sm:h-[60px] text-lg rounded-xl text-white font-bold focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-zinc-400 mb-2 ml-1">Comprobante</label>
                            <label className={`w-full ${file ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'} border font-bold uppercase tracking-widest text-[11px] sm:text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 h-[52px] sm:h-[60px]`}>
                                {file ? <CheckCircle2 size={18} /> : <Upload size={18} />}
                                {file ? "COMPROBANTE CARGADO ✓" : "SELECCIONAR ARCHIVO"}
                                <input 
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileChange}
                                    required
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={payLoading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-3 sm:py-4 rounded-xl flex items-center justify-center gap-1.5 sm:gap-3 shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-95 disabled:opacity-50 transition-all mt-4 text-[13px] sm:text-base uppercase tracking-wider sm:tracking-widest"
                    >
                        {payLoading ? <Loader2 className="animate-spin" size={20} /> : <><Upload size={18} className="-mt-0.5 sm:w-5 sm:h-5" /> <span>ENVIAR PAGO Y COMPROBANTE</span></>}
                    </button>
                </form>
            </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="xl:col-span-5 flex h-[450px] xl:h-auto">
            <div className="bg-[#12121A] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl w-full flex flex-col">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/5">
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-widest">Mis Pagos Enviados</h3>
                    <span className="bg-blue-500/10 text-blue-400 text-xs font-black px-3 py-1 rounded-full border border-blue-500/20">{pagos.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                    {pagos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-60 text-center">
                            <Inbox size={56} className="mb-4 text-blue-500/50" />
                            <p className="text-sm font-bold tracking-widest uppercase text-zinc-400">Sin Movimientos</p>
                        </div>
                    ) : pagos.map((p) => {
                        const isPendiente = p.estado === 'PENDIENTE';
                        const isAprobado = p.estado === 'APROBADO';
                        const isRechazado = p.estado === 'RECHAZADO';
                        
                        return (
                            <div key={p.id} className="group bg-[#1A1A24] border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col gap-3 hover:bg-[#20202C] transition-all">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-xl bg-zinc-900 border border-white/5`}>
                                            {isPendiente && <Clock className="text-yellow-500" size={18}/>}
                                            {isAprobado && <CheckCircle2 className="text-cyan-500" size={18}/>}
                                            {isRechazado && <AlertCircle className="text-red-500" size={18}/>}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-base sm:text-lg">${Number(p.monto).toLocaleString('es-AR')}</p>
                                            <p className="text-zinc-500 text-[10px] sm:text-xs uppercase font-bold tracking-wider mt-0.5">
                                                {new Date(p.creado_en).toLocaleDateString('es-AR')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-[10px] sm:text-xs uppercase font-black px-2.5 py-1.5 rounded-lg border ${isPendiente ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : isAprobado ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                        {p.estado}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/5">
                                    <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs font-bold hover:underline uppercase tracking-wide">Ver Comprobante</a>
                                    {isRechazado && p.observaciones && <span className="text-xs text-red-400 italic truncate ml-2" title={p.observaciones}>{p.observaciones}</span>}
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
