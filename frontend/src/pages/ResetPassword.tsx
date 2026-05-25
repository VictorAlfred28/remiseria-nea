import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, CheckCircle2, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { setRecoveringPassword } = useAuthStore();

  useEffect(() => {
    // Verificar si el usuario llegó con un token de recuperación válido
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setError('El enlace es inválido o ha expirado. Por favor, solicita uno nuevo.');
      } else if (!session) {
        // En un flujo de recovery, Supabase inicializa una sesión implícita con el token en el fragmento de la URL.
        // Si no hay sesión tras procesar el fragmento, el enlace expiró o es inválido.
        const hash = window.location.hash;
        if (!hash || !hash.includes('type=recovery')) {
          setError('No estás autorizado para ver esta página.');
        }
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      // Limpiar hash de la URL para que no quede expuesto el token
      window.history.replaceState({}, document.title, window.location.pathname);
      // Limpiar estado de recuperación global
      setRecoveringPassword(false);
      // Forzar cierre de sesión (Supabase creó una sesión silenciosa con el token)
      await supabase.auth.signOut();
      
    } catch (err: any) {
      console.error('Error al actualizar contraseña:', err);
      setError(err.message || 'Hubo un problema al actualizar tu contraseña. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4 tracking-tight">¡Contraseña Actualizada!</h2>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            Tu contraseña ha sido actualizada correctamente. Ya puedes acceder a tu cuenta utilizando tus nuevas credenciales.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-[#0D6EFD] hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(13,110,253,0.3)] uppercase tracking-widest text-sm"
          >
            Ir al Inicio de Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30 shadow-[0_0_15px_rgba(13,110,253,0.3)]">
            <Lock size={32} className="text-blue-500" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter mb-2">Restablecer Contraseña</h1>
          <p className="text-sm text-zinc-400">Ingresa tu nueva contraseña para acceder a Traslados UBI.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 pr-12 py-4 bg-black/50 border border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600 outline-none"
                placeholder="••••••••"
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
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 pr-12 py-4 bg-black/50 border border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600 outline-none"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-white transition-colors"
                aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!error?.includes('No estás autorizado')}
            className="w-full bg-[#0D6EFD] hover:bg-blue-600 text-white font-black text-sm tracking-widest py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(13,110,253,0.3)] mt-2 flex justify-center items-center"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'GUARDAR CONTRASEÑA'}
          </button>
        </form>
      </div>
    </div>
  );
}
