import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, ScanLine, CheckCircle2, XCircle, Loader2, Store } from "lucide-react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

export default function ComercioDashboard() {
  const { user, signOut } = useAuthStore();
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(true);

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
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/socios/validar_qr`, {
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
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/3" />
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
           
           <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl font-bold transition">
              <LogOut size={16} /> <span className="hidden sm:inline">Cerrar Sesión</span>
           </button>
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
                             <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 size={48} className="text-emerald-500" />
                             </div>
                             <h3 className="text-2xl font-black text-emerald-400 text-center mb-1">SOCIO VÁLIDO</h3>
                             <p className="text-white text-lg font-bold mb-4">{scanResult.socio?.nombre}</p>
                             <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg text-emerald-400 text-sm text-center mb-8">
                                 ✅ El beneficio puede ser aplicado
                             </div>
                           </>
                        ) : (
                           <>
                             <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                                <XCircle size={48} className="text-red-500" />
                             </div>
                             <h3 className="text-2xl font-black text-red-500 text-center mb-1">NO VÁLIDO</h3>
                             <p className="text-zinc-400 text-sm text-center mb-8 max-w-[250px]">{scanResult.mensaje}</p>
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
