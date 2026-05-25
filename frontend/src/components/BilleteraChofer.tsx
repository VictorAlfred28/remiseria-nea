import { useState, useEffect } from "react";
import { getPagosChofer, uploadPagoChofer, getMyBalance } from "../services/api";
import { Loader2, Wallet, ArrowUpRight, ArrowDownLeft, Upload, CheckCircle2, AlertCircle, Clock, Copy, ExternalLink, Smartphone, Check, Inbox } from "lucide-react";
import logoUbi from "../../assets/icon.png";

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

  const handleOpenMercadoPago = () => {
    const deepLink = "mercadopago://";
    const webFallback = "https://www.mercadopago.com.ar";
    
    // Intenta abrir la app
    window.location.href = deepLink;
    
    // Fallback a web si en 2.5s no se movió el foco (probablemente no abrió la app)
    setTimeout(() => {
        if (document.hasFocus()) {
            window.open(webFallback, "_blank");
        }
    }, 2500);
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
      fetchData(); // Recargar historial
    } catch (err: any) {
      alert("Error al subir comprobante: " + (err.response?.data?.detail || err.message));
    }
    setPayLoading(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-green-500" size={48} />
        <p className="text-zinc-500 font-bold animate-pulse tracking-widest text-xs uppercase">Sincronizando Billetera...</p>
    </div>
  );

  const isDebt = balance < 0;
  const absBalance = Math.abs(balance);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* COLUMNA IZQUIERDA: ESTADO Y ENVÍO DE COMPROBANTE */}
        <div className="lg:col-span-7 space-y-6">
            
            <div className={`relative overflow-hidden p-8 rounded-[2rem] border backdrop-blur-md transition-all duration-500 ${isDebt ? 'bg-red-500/5 border-red-500/20 shadow-[0_20px_40px_-15px_rgba(239,68,68,0.1)]' : 'bg-blue-600/5 border-blue-500/20 shadow-[0_20px_40px_-15px_rgba(37,99,235,0.1)]'}`}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-white/5 to-transparent rounded-tr-[2rem] pointer-events-none" />
                
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">Estado Corriente</h2>
                        <p className={`text-xs font-bold ${isDebt ? 'text-red-400' : 'text-cyan-400'}`}>
                            {isDebt ? "⚠️ REQUERIDO: REGULARIZAR SALDO" : "✓ AL DÍA"}
                        </p>
                    </div>
                    <Wallet className={isDebt ? 'text-red-500/50' : 'text-blue-500/50'} size={40} />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-3xl font-light">$</span>
                    <h1 className={`text-6xl sm:text-7xl font-black tracking-tighter ${isDebt ? 'text-red-500' : 'text-white'}`}>
                        {absBalance.toLocaleString('es-AR')}
                    </h1>
                </div>
            </div>

            {/* SECCIÓN DE DATOS DE PAGO Y SUBIDA DE COMPROBANTE */}
            <div className="bg-zinc-900/40 border border-white/5 backdrop-blur-md rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                   <img src={logoUbi} alt="Traslados UBI" className="w-10 h-10 object-contain rounded-xl" />
                   <h3 className="text-xl font-black text-white">
                       Pagar a Administración
                   </h3>
                </div>
                
                <div className="bg-zinc-950 p-6 rounded-2xl border border-blue-500/20 mb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Datos para Transferir</p>
                        <button 
                            type="button"
                            onClick={handleOpenMercadoPago}
                            className="bg-[#009EE3]/10 hover:bg-[#009EE3]/20 text-[#009EE3] text-xs font-black px-5 py-3 rounded-xl flex items-center gap-2 border border-[#009EE3]/30 transition-all active:scale-95 w-full sm:w-auto justify-center"
                        >
                            <img src="/mercadopago_icon.png" alt="Mercado Pago" className="w-5 h-5 object-contain rounded-sm" />
                            ABRIR MERCADO PAGO
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-zinc-300">
                        <div className="bg-zinc-900/50 p-4 rounded-xl">
                            <span className="block text-[10px] uppercase text-zinc-500 font-black mb-1">Banco</span>
                            <span className="font-bold text-white break-words">Banco Provincia del Chaco</span>
                        </div>
                        <div className="bg-zinc-900/50 p-4 rounded-xl">
                            <span className="block text-[10px] uppercase text-zinc-500 font-black mb-1">Titular</span>
                            <span className="font-bold text-white break-words">TRASLADOS UBI S.R.L.</span>
                        </div>
                        <div className="bg-zinc-900/50 p-4 rounded-xl flex justify-between items-center group">
                            <div className="overflow-hidden pr-2">
                                <span className="block text-[10px] uppercase text-zinc-500 font-black mb-1">CBU</span>
                                <span className="font-bold text-white break-all">3110030211000012345678</span>
                            </div>
                            <button 
                                type="button"
                                onClick={() => copyToClipboard("3110030211000012345678", "cbu")}
                                className={`shrink-0 flex items-center justify-center p-2.5 rounded-lg transition-all active:scale-95 ${copiedField === 'cbu' ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                                title="Copiar CBU"
                            >
                                {copiedField === 'cbu' ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>
                        <div className="bg-zinc-900/50 p-4 rounded-xl flex justify-between items-center group">
                            <div className="overflow-hidden pr-2">
                                <span className="block text-[10px] uppercase text-zinc-500 font-black mb-1">Alias</span>
                                <span className="font-bold text-white break-all">UBI.TRASLADOS.OFICIAL</span>
                            </div>
                            <button 
                                type="button"
                                onClick={() => copyToClipboard("UBI.TRASLADOS.OFICIAL", "alias")}
                                className={`shrink-0 flex items-center justify-center p-2.5 rounded-lg transition-all active:scale-95 ${copiedField === 'alias' ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                                title="Copiar Alias"
                            >
                                {copiedField === 'alias' ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleUploadPago} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-2">Monto a Avisar ($)</label>
                        <input 
                            type="number"
                            min="1"
                            step="any"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            required
                            placeholder={isDebt ? `${absBalance}` : "Ej: 5000"}
                            className="w-full bg-zinc-800/50 border border-zinc-700 p-4 rounded-xl text-white font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-zinc-400 mb-2">Comprobante de Transferencia (Imagen PDF o JPG)</label>
                        <div className="relative">
                            <input 
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFileChange}
                                required
                                className="w-full bg-zinc-800/50 border border-zinc-700 p-3 rounded-xl text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 transition-all cursor-pointer"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={payLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all"
                    >
                        {payLoading ? <Loader2 className="animate-spin" /> : <><Upload size={20}/> ENVIAR PAGO Y COMPROBANTE</>}
                    </button>
                </form>
            </div>
        </div>

        {/* COLUMNA DERECHA: HISTORIAL DE PAGOS */}
        <div className="lg:col-span-5">
            <div className="bg-zinc-900/40 border border-white/5 backdrop-blur-md rounded-[2rem] p-8 shadow-xl h-full flex flex-col">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                    <h3 className="text-lg font-black text-white uppercase tracking-widest">Mis Pagos Enviados</h3>
                    <span className="bg-zinc-800 text-zinc-400 text-[10px] font-black px-3 py-1 rounded-full">{pagos.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {pagos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 opacity-50 text-center">
                            <Inbox size={56} className="mb-4 text-blue-500/50" />
                            <p className="text-sm font-bold tracking-widest uppercase text-zinc-400">Sin Movimientos</p>
                            <p className="text-xs text-zinc-500 mt-2">Aún no has enviado comprobantes de pago.</p>
                        </div>
                    ) : pagos.map((p) => {
                        const isPendiente = p.estado === 'PENDIENTE';
                        const isAprobado = p.estado === 'APROBADO';
                        const isRechazado = p.estado === 'RECHAZADO';
                        
                        return (
                            <div key={p.id} className="group bg-zinc-950/30 border border-white/5 p-5 rounded-[1.5rem] flex flex-col gap-3 hover:bg-zinc-900/50 transition-all">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        {isPendiente && <Clock className="text-yellow-500" size={24}/>}
                                        {isAprobado && <CheckCircle2 className="text-cyan-500" size={24}/>}
                                        {isRechazado && <AlertCircle className="text-red-500" size={24}/>}
                                        
                                        <div>
                                            <p className="text-white font-bold">${Number(p.monto).toLocaleString('es-AR')}</p>
                                            <p className="text-zinc-500 text-[10px] uppercase font-bold mt-1">
                                                {new Date(p.creado_en).toLocaleDateString('es-AR')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${isPendiente ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : isAprobado ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                                        {p.estado}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                                    <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs font-bold hover:underline">Ver Foto Comprobante</a>
                                    {isRechazado && p.observaciones && <span className="text-xs text-red-400 italic flex-1 text-right ml-4 truncate" title={p.observaciones}>Motivo: {p.observaciones}</span>}
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
