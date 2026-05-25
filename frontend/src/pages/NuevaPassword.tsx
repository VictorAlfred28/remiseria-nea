import { useState, useEffect } from "react";
import type React from "react";
import { supabase } from "../lib/supabase";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

export default function NuevaPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  const { setRecoveringPassword } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/");
      } else {
        setCheckingSession(false);
      }
    });
  }, [navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password
    });

    setLoading(false);

    if (updateError) {
      setError("Error al actualizar: " + updateError.message);
    } else {
      setRecoveringPassword(false);
      navigate("/");
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30 shadow-[0_0_15px_rgba(13,110,253,0.3)]">
            <Lock size={32} className="text-blue-500" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tighter mb-2">Nueva contraseña</h2>
          <p className="text-sm text-zinc-400">Ingresa tu nueva contraseña para acceder.</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-5">
          <div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 pr-12 py-4 bg-black/50 border border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600 outline-none"
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-white transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 pr-12 py-4 bg-black/50 border border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600 outline-none"
                placeholder="Confirmar contraseña"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-white transition-colors"
                aria-label={showConfirm ? "Ocultar" : "Mostrar"}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || password.length < 8}
            className="w-full bg-[#0D6EFD] hover:bg-blue-600 text-white font-black text-sm tracking-widest py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(13,110,253,0.3)] mt-2 flex justify-center items-center"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : "GUARDAR CONTRASEÑA"}
          </button>
        </form>
      </div>
    </div>
  );
}
