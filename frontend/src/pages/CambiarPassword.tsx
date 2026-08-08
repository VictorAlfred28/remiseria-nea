import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { API_BASE_URL } from "../config";
import { useAuthStore } from "../store/useAuthStore";
import { Lock, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function CambiarPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const { checkSession } = useAuthStore();

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (!/[A-Z]/.test(pass)) return "La contraseña debe contener al menos una mayúscula.";
    if (!/[0-9]/.test(pass)) return "La contraseña debe contener al menos un número.";
    if (pass === "UBI2026!") return "La nueva contraseña no puede ser igual a la contraseña inicial.";
    if (pass !== confirmPassword && confirmPassword !== "") return "Las contraseñas no coinciden.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      // 1. Cambiar contraseña en Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) throw authError;

      // 2. Notificar al backend para que actualice `requiere_cambio_password = FALSE`
      const token = localStorage.getItem('sb-access-token');
      const response = await fetch(`${API_BASE_URL}/auth/password-inicial-completada`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar el estado de la contraseña en el servidor.");
      }

      setSuccess(true);
      
      // 3. Recargar sesión global para limpiar el flag requiere_cambio_password
      await checkSession();
      
      setTimeout(() => {
        navigate("/");
      }, 2000);

    } catch (err: any) {
      setError(err.message || "Ocurrió un error al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950 to-zinc-950"></div>
        <div className="glass-panel p-8 sm:p-10 rounded-3xl w-full max-w-md relative z-10 flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center mb-6 text-green-400">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">¡Contraseña Actualizada!</h2>
          <p className="text-zinc-400">Te estamos redirigiendo a tu panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950 to-zinc-950"></div>
      
      <div className="glass-panel p-8 sm:p-10 rounded-3xl w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-2xl border border-white/10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)] border border-blue-500/20">
            <Lock className="text-blue-400" size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Cambio Obligatorio</h1>
          <p className="text-zinc-400 text-sm">
            Por seguridad, debes cambiar tu contraseña inicial para continuar usando la plataforma.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in shake">
            <AlertTriangle size={18} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nueva Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500/50 rounded-xl px-4 py-3.5 text-white outline-none transition-all focus:ring-4 focus:ring-blue-500/10 placeholder-zinc-600"
                placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-2"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Confirmar Contraseña</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500/50 rounded-xl px-4 py-3.5 text-white outline-none transition-all focus:ring-4 focus:ring-blue-500/10 placeholder-zinc-600"
                placeholder="Repite la nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-2"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Actualizar Contraseña"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
