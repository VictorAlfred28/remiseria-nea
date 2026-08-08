import { API_BASE_URL } from '../config';
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, ScanLine, CheckCircle2, XCircle, Loader2, Store } from "lucide-react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { useSearchParams } from "react-router-dom";

export default function ComercioDashboard() {
  const { user, signOut } = useAuthStore();
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const tokenInUrl = searchParams.get("scan");
    if (tokenInUrl && !scanResult && isScanning) {
       // Si vino por cámara nativa y leyó la URL
       setSearchParams({}, { replace: true });
       handleScanSuccess(tokenInUrl);
    }
  }, [searchParams, isScanning, scanResult]);

  useEffect(() => {
    // Only initialize scanner if tab is scanning and no result is there yet
    if (isScanning && !scanResult) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        false
      );

      scanner.render(handleScanSuccess, handleScanError);

      return () => {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      };
    }
  }, [isScanning, scanResult]);

  async function handleScanSuccess(decodedText: string) {
    // Detenemos escáner visual para no re-escanear
    setIsScanning(false);
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE_URL}/socios/validar_qr`, {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`
          },
          body: JSON.stringify({ qr_token: decodedText })
      });

      if (resp.ok) {
         const data = await resp.json();
         setScanResult(data);
      } else {
         const err = await resp.json();
         setScanResult({ valido: false, mensaje: err.detail || "Error al conectar." });
      }
    } catch (e) {
       setScanResult({ valido: false, mensaje: "Error de red al intentar validar." });
    } finally {
       setLoading(false);
    }
  }

  function handleScanError(err: any) {
    // console.warn(err); silently fail on continuous scan
  }

  const resetScanner = () => {
     setScanResult(null);
     setIsScanning(true);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-600/10 to-transparent rounded-full translate-y-1/3 -translate-x-1/3" />
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 relative z-10 flex flex-col min-h-screen">
        <header className="flex justify-between items-center mb-8 bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-4 rounded-3xl">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl">
                 <Store size={24} />
              </div>
              <div>
                 <h1 className="text-xl font-black text-white">Panel Comercio</h1>
                 <p className="text-zinc-400 text-sm">{user?.user_metadata?.nombre || "Comercio Adherido"}</p>
              </div>
           </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center -mt-10">
            <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-2xl flex flex-col items-center">
                <div className="text-center mb-6">
                   <h2 className="text-2xl font-black text-white mb-2">Validador de Socios</h2>
                   <p className="text-zinc-400 text-sm">Escanea el Carnet Digital del cliente para aplicar beneficios.</p>
                </div>

                {loading && (
                   <div className="h-[300px] flex flex-col items-center justify-center gap-4 w-full bg-black/40 rounded-2xl border border-white/5">
                      <Loader2 size={48} className="animate-spin text-blue-500" />
                      <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Validando credencial...</p>
                   </div>
                )}

                {isScanning && !loading && (
                   <div className="w-full h-full min-h-[300px] bg-black/20 rounded-2xl overflow-hidden border border-white/5 scanner-container">
                      <div id="reader" className="w-full" style={{ border: 'none' }}></div>
                   </div>
                )}

                {scanResult && !loading && (
                    <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-500 p-4">
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
                               <div className="w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                  <CheckCircle2 size={56} className="text-emerald-500" />
                               </div>
                             )}
                             <h3 className="text-3xl font-black text-emerald-400 text-center mb-2 drop-shadow-md">SOCIO VALIDADO</h3>
                             
                             <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 mt-2 mb-6">
                               <p className="text-zinc-400 text-xs font-black uppercase tracking-widest text-center mb-1">Titular</p>
                               <p className="text-white text-xl sm:text-2xl font-bold mb-4 text-center">
                                 {scanResult.socio?.nombre} {scanResult.socio?.apellido}
                               </p>
                               
                               <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 mb-3">
                                 <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Socio N°</span>
                                 <span className="font-mono text-white text-lg font-bold">{scanResult.socio?.numero_socio ? String(scanResult.socio.numero_socio).padStart(8, '0') : 'N/A'}</span>
                               </div>
                               
                               <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                 <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Estado</span>
                                 <span className={`px-2 py-1 text-xs font-black uppercase rounded-md ${scanResult.socio?.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {scanResult.socio?.activo ? 'ACTIVO' : 'SUSPENDIDO'}
                                 </span>
                               </div>
                             </div>

                             <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-6 flex flex-col items-center gap-1">
                               <span>Validado el: {new Date().toLocaleString()}</span>
                               <span className="text-emerald-500/80">✔ Beneficio aplicable</span>
                             </div>
                           </>
                        ) : (
                           <>
                             <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-4 relative">
                                <XCircle size={48} className="text-red-500" />
                                <div className="absolute inset-0 border-2 border-red-500/50 rounded-full animate-ping opacity-20"></div>
                             </div>
                             <h3 className="text-2xl font-black text-red-500 text-center mb-2">RECHAZADO</h3>
                             <p className="text-white text-lg text-center mb-8 max-w-[280px] bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                               {scanResult.mensaje}
                             </p>
                           </>
                        )}

                        <button onClick={resetScanner} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.3)] transition flex items-center justify-center gap-2">
                           <ScanLine size={20} /> Escanear Nuevo Cliente
                        </button>
                    </div>
                )}
            </div>
            {isScanning && (
               <style>{`
                  #reader { width: 100%; border: none !important; }
                  #reader__scan_region { background: transparent !important; }
                  #reader__scan_region img { object-fit: cover !important; border-radius: 1rem; }
                  #reader__scan_region video { border-radius: 1rem; object-fit: cover; }
                  #reader__dashboard_section_csr span { color: white !important; }
                  #reader button { background: #2563eb; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: bold; margin-bottom: 0.5rem; }
               `}</style>
            )}
        </main>
      </div>
    </div>
  );
}
