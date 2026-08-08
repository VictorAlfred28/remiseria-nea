import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PasswordInput, AuthButton, AuthLayout } from '../components/auth';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [success, setSuccess] = useState(false);
  const { setRecoveringPassword } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      const isRecoveryFlow =
        hash.includes('type=recovery') ||
        search.includes('type=recovery') ||
        hash.includes('access_token=') ||
        search.includes('access_token=');

      if (isRecoveryFlow) {
        setRecoveringPassword(true);
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();

      if (mounted) {
        if (error || !session) {
          setError(
            error
              ? 'El enlace es inválido o ha expirado. Por favor, solicitá uno nuevo.'
              : 'No estás autorizado para ver esta página.',
          );
        }
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && mounted) {
        setError('');
        setRecoveringPassword(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setRecoveringPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPasswordError('');
    setConfirmError('');

    if (password.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      setRecoveringPassword(false);
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err.message || 'Hubo un problema al actualizar tu contraseña. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────

  if (success) {
    return (
      <AuthLayout showLogo bg="gradient">
        <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <CheckCircle2 size={40} className="text-green-400" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-white mb-4 tracking-tight">¡Contraseña Actualizada!</h1>
          <p className="text-zinc-400 mb-8 leading-relaxed text-sm">
            Tu contraseña ha sido actualizada correctamente. Ya podés acceder a tu cuenta con tus nuevas credenciales.
          </p>
          <AuthButton variant="primary" onClick={() => navigate('/login')} className="!py-4 tracking-wide">
            Ir al Inicio de Sesión
          </AuthButton>
        </div>
      </AuthLayout>
    );
  }

  // ── Reset form ──────────────────────────────────────────────

  return (
    <AuthLayout showLogo bg="gradient">
      <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-6 sm:p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden">
        {/* Top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, transparent, #0D6EFD 30%, #00D4FF 50%, #0D6EFD 70%, transparent)' }}
          aria-hidden="true"
        />

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-500/30 shadow-[0_0_20px_rgba(13,110,253,0.25)]">
            <Lock size={30} className="text-blue-400" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter mb-2">Restablecer Contraseña</h1>
          <p className="text-sm text-zinc-400">Ingresá tu nueva contraseña para acceder a Traslados UBI.</p>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            id="reset-password"
            label="Nueva contraseña"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={loading}
            error={passwordError}
            variant="darker"
          />

          <PasswordInput
            id="reset-password-confirm"
            label="Confirmar contraseña"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={loading}
            error={confirmError}
            variant="darker"
          />

          <div className="pt-2">
            <AuthButton
              type="submit"
              loading={loading}
              disabled={!!error?.includes('No estás autorizado')}
              variant="primary"
              className="!py-4 tracking-wide"
            >
              Guardar contraseña
            </AuthButton>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
