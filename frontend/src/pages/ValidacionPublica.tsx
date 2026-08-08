import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "../config";
import ubiLogo from "../../assets/splash.png";

interface ScanResult {
  valido: boolean;
  mensaje: string;
  socio?: {
    nombre: string;
    apellido: string;
    numero_socio: number;
    foto_perfil: string | null;
    activo: boolean;
    es_socio: boolean;
  };
}

export default function ValidacionPublica() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    
    const tokenInUrl = searchParams.get("scan");
    if (tokenInUrl) {
      fetchedRef.current = true;
      validarTokenBackend(tokenInUrl);
    } else {
      setLoading(false);
      setScanResult({
        valido: false,
        mensaje: "No se proporcionó ningún token válido para escanear."
      });
    }
  }, [searchParams]);

  const validarTokenBackend = async (token: string) => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE_URL}/socios/validar_qr_publico`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qr_token: token }),
      });
      const data = await resp.json();
      setScanResult(data);
    } catch (error) {
      setScanResult({
        valido: false,
        mensaje: "Error de conexión al servidor. Intente de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 sm:p-6 w-full relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-600/10 to-transparent rounded-full translate-y-1/3 -translate-x-1/3" />
      </div>

      <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-2xl flex flex-col items-center relative z-10">
        
        <div className="flex items-center gap-2 mb-6 opacity-80">
          <img src={ubiLogo} alt="UBI Logo" className="w-6 h-6" />
          <span className="text-sm font-bold tracking-widest text-zinc-400">CLUB UBI</span>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-white mb-2 flex items-center justify-center gap-2">
            <ShieldCheck className="text-blue-500" />
            Validación de Carnet
          </h2>
          <p className="text-zinc-400 text-sm">Verificación pública de identidad de socio.</p>
        </div>

        {loading && (
          <div className="h-[300px] flex flex-col items-center justify-center gap-4 w-full bg-black/40 rounded-2xl border border-white/5">
            <Loader2 size={48} className="animate-spin text-blue-500" />
            <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Verificando en línea...</p>
          </div>
        )}

        {scanResult && !loading && (
          <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-500">
            {scanResult.valido ? (
              <>
                {scanResult.socio?.foto_perfil ? (
                  <div className="w-28 h-28 rounded-full border-4 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] overflow-hidden mb-4 relative z-10">
                    <img src={scanResult.socio.foto_perfil} alt="Foto Socio" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-zinc-900">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                ) : (
                  <div className="w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] relative z-10">
                    <img src={ubiLogo} alt="UBI Fallback" className="w-16 h-16 drop-shadow-md opacity-80" />
                    <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-zinc-900">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                )}
                <h3 className="text-3xl font-black text-emerald-400 text-center mb-2 drop-shadow-md">SOCIO VALIDADO</h3>

                <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 mt-2 mb-6">
                  <p className="text-zinc-400 text-xs font-black uppercase tracking-widest text-center mb-1">Titular</p>
                  <p className="text-white text-xl sm:text-2xl font-bold mb-4 text-center">
                    {scanResult.socio?.nombre} {scanResult.socio?.apellido}
                  </p>

                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 mb-3">
                    <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Socio Nº</span>
                    <span className="font-mono text-white text-lg font-bold">
                      {scanResult.socio?.numero_socio ? String(scanResult.socio.numero_socio).padStart(8, '0') : 'N/A'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Estado</span>
                    <span className={`px-2 py-1 text-xs font-black uppercase rounded-md ${scanResult.socio?.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {scanResult.socio?.activo ? 'ACTIVO' : 'SUSPENDIDO'}
                    </span>
                  </div>
                </div>

                <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-2 flex flex-col items-center gap-1 text-center">
                  <span>Validado el: {new Date().toLocaleString()}</span>
                  <span className="text-emerald-500/80">✅ Verificación de identidad exitosa</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-4 relative mt-4">
                  <XCircle size={48} className="text-red-500" />
                  <div className="absolute inset-0 border-2 border-red-500/50 rounded-full animate-ping opacity-20"></div>
                </div>
                <h3 className="text-2xl font-black text-red-500 text-center mb-2">RECHAZADO</h3>
                <p className="text-white text-lg text-center mb-8 max-w-[280px] bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  {scanResult.mensaje}
                </p>
              </>
            )}

            <button onClick={() => window.location.href = '/login'} className="mt-4 w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 border border-white/5">
              Acceder a mi cuenta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
