import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowLeft, CheckCircle2, Eye, EyeOff, Car, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import loginImg from '../assets/login/imagen-login.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isResetView, setIsResetView] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkSession = useAuthStore(state => state.checkSession);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session) {
        const { data: userData, error: profileError } = await supabase
          .from('usuarios')
          .select('rol, estado')
          .eq('id', data.session.user.id)
          .single();

        if (profileError) {
          console.error("Error al obtener perfil:", profileError);
          if (profileError.code === 'PGRST116') {
            throw new Error("No se encontró un perfil de usuario asociado a esta cuenta. Por favor, contacta al soporte.");
          } else {
            throw new Error(`Error de sistema (${profileError.code || '500'}). Tu sesión se inició pero no pudimos cargar tu perfil.`);
          }
        }

        const isPrimarySuperAdmin = userData?.rol === 'superadmin' && data.session.user.email === 'agentech.nea@gmail.com';

        if (!isPrimarySuperAdmin) {
          if (userData?.estado === 'pendiente') {
            await supabase.auth.signOut();
            if (userData?.rol === 'chofer') {
              throw new Error("Tu solicitud para ser chofer se encuentra en revisión. Te notificaremos cuando sea aprobada.");
            } else {
              throw new Error("Tu cuenta fue registrada correctamente y está pendiente de aprobación administrativa.");
            }
          }
          if (userData?.estado === 'rechazado') {
            await supabase.auth.signOut();
            if (userData?.rol === 'chofer') {
              throw new Error("Tu solicitud para ser chofer ha sido rechazada por la administración.");
            } else {
              throw new Error("Tu solicitud de cuenta ha sido rechazada por la administración.");
            }
          }
        }

        localStorage.setItem('sb-access-token', data.session.access_token);
        await checkSession();

        const redirectUrl = searchParams.get('redirect');
        if (redirectUrl) {
          navigate(redirectUrl);
        } else {
          const rol = userData?.rol;
          if (rol === 'admin' || rol === 'superadmin') {
            navigate('/admin');
          } else if (rol === 'chofer') {
            navigate('/chofer');
          } else if (rol === 'comercio') {
            navigate('/comercio');
          } else {
            navigate('/cliente');
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Por favor, ingresa tu correo electrónico.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/',
      });
      if (error) throw error;
      setResetSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al enviar correo de recuperación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="login-screen"
      style={{ minHeight: '100dvh', background: '#03080f' }}
      className="w-full flex flex-col overflow-hidden"
    >
      {/* ══════════════════════════════════════
          SECCIÓN SUPERIOR — Imagen con proporción correcta
          ══════════════════════════════════════ */}
      <div
        id="login-image-section"
        style={{
          /* La imagen dicta su propio alto según su proporción natural.
             Limitamos con max-height para que en pantallas grandes no
             ocupe demasiado, pero NUNCA la deformamos. */
          width: '100%',
          maxHeight: '52vh',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          background: '#03080f',
        }}
      >
        <img
          src={loginImg}
          alt="UBI Traslados — Movemos personas. Conectamos destinos."
          style={{
            width: '100%',
            height: '100%',
            /* contain muestra la imagen COMPLETA sin recortar nada.
               La imagen se centra y puede dejar bandas si el ratio
               de la pantalla difiere, pero NUNCA se distorsiona. */
            objectFit: 'contain',
            objectPosition: 'center top',
            display: 'block',
            /* Máxima calidad de renderizado */
            imageRendering: 'high-quality',
          }}
          draggable={false}
        />

        {/* Gradiente de transición suave hacia la sección inferior */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '72px',
            background: 'linear-gradient(to bottom, transparent, #0d1829)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* ══════════════════════════════════════
          SECCIÓN INFERIOR — Formulario glassmorphism
          ══════════════════════════════════════ */}
      <div
        id="login-form-section"
        style={{
          flex: 1,
          background: '#0d1829',
          /* Borde superior redondeado que se superpone a la imagen */
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          marginTop: '-28px',
          position: 'relative',
          zIndex: 10,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Línea decorativa superior */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '30%',
            right: '30%',
            height: '4px',
            borderRadius: '9999px',
            background: 'linear-gradient(90deg, transparent, #0D6EFD, #00D4FF, #0D6EFD, transparent)',
          }}
        />

        <div
          id="login-form-inner"
          className="w-full max-w-md mx-auto px-5 pt-8 pb-10"
        >
          {/* Título del formulario */}
          <div className="text-center mb-6">
            <h1
              id="login-title"
              className="text-2xl font-black text-white tracking-tight"
            >
              {isResetView ? 'Recuperar Acceso' : 'Iniciar sesión'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8da4c4' }}>
              {isResetView
                ? 'Te enviaremos un enlace de recuperación'
                : 'Accedé a tu cuenta para continuar'}
            </p>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div
              id="login-error"
              className="mb-5 text-sm px-4 py-3 rounded-2xl animate-in fade-in"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#fca5a5',
              }}
            >
              {errorMsg === 'Invalid login credentials'
                ? 'El correo o la contraseña son incorrectos.'
                : errorMsg}
            </div>
          )}

          {/* ── Estado: reset exitoso ── */}
          {resetSuccess ? (
            <div
              className="mb-5 px-4 py-8 rounded-2xl animate-in fade-in flex flex-col items-center text-center"
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              <CheckCircle2 size={48} style={{ color: '#22c55e' }} className="mb-3" />
              <p className="font-bold text-lg text-white mb-1">¡Correo enviado!</p>
              <p style={{ color: '#86efac', fontSize: '14px' }}>
                Revisá tu bandeja de entrada (y spam) para restablecer tu contraseña.
              </p>
              <button
                onClick={() => { setIsResetView(false); setResetSuccess(false); }}
                className="mt-6 text-sm font-medium underline"
                style={{ color: '#60a5fa' }}
              >
                Volver al inicio de sesión
              </button>
            </div>

          /* ── Estado: formulario de reset ── */
          ) : isResetView ? (
            <form
              onSubmit={handleResetPassword}
              className="space-y-4 animate-in slide-in-from-right-4 fade-in"
            >
              {/* Campo email */}
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#c3d4e8' }}
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <div
                    className="absolute inset-y-0 left-0 flex items-center pointer-events-none"
                    style={{ paddingLeft: '14px' }}
                  >
                    <Mail size={18} style={{ color: '#4a6fa5' }} />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '44px',
                      paddingRight: '16px',
                      paddingTop: '14px',
                      paddingBottom: '14px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '14px',
                      color: '#ffffff',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#0D6EFD';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                id="reset-submit-btn"
                style={{
                  width: '100%',
                  padding: '15px',
                  background: 'linear-gradient(135deg, #0D6EFD, #0056cc)',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '16px',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 24px rgba(13,110,253,0.4)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
              >
                {loading
                  ? <Loader2 size={20} className="animate-spin" />
                  : 'Enviar Enlace de Recuperación'}
              </button>

              <button
                type="button"
                onClick={() => { setIsResetView(false); setErrorMsg(''); }}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm"
                style={{ color: '#8da4c4' }}
              >
                <ArrowLeft size={16} /> Volver a Iniciar Sesión
              </button>
            </form>

          /* ── Estado: formulario de login normal ── */
          ) : (
            <form
              onSubmit={handleLogin}
              className="space-y-4 animate-in slide-in-from-left-4 fade-in"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-medium mb-2"
                  style={{ color: '#c3d4e8' }}
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <div
                    className="absolute inset-y-0 left-0 flex items-center pointer-events-none"
                    style={{ paddingLeft: '14px' }}
                  >
                    <Mail size={18} style={{ color: '#4a6fa5' }} />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '44px',
                      paddingRight: '16px',
                      paddingTop: '14px',
                      paddingBottom: '14px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '14px',
                      color: '#ffffff',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#0D6EFD';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium"
                    style={{ color: '#c3d4e8' }}
                  >
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => { setIsResetView(true); setErrorMsg(''); }}
                    className="text-xs font-medium"
                    style={{ color: '#0D6EFD' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <div
                    className="absolute inset-y-0 left-0 flex items-center pointer-events-none"
                    style={{ paddingLeft: '14px' }}
                  >
                    <Lock size={18} style={{ color: '#4a6fa5' }} />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '44px',
                      paddingRight: '48px',
                      paddingTop: '14px',
                      paddingBottom: '14px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '14px',
                      color: '#ffffff',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#0D6EFD';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center transition-colors"
                    style={{ paddingRight: '14px', color: '#4a6fa5' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Botón Ingresar */}
              <button
                type="submit"
                disabled={loading}
                id="login-submit-btn"
                style={{
                  width: '100%',
                  padding: '16px',
                  background: '#ffffff',
                  color: '#071B4D',
                  fontWeight: '900',
                  fontSize: '17px',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 20px rgba(255,255,255,0.15)',
                  marginTop: '8px',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseDown={(e) => {
                  if (!loading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
                  }
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
              >
                {loading
                  ? <Loader2 size={20} className="animate-spin" style={{ color: '#071B4D' }} />
                  : 'Ingresar'}
              </button>

              {/* Divisor "o continuá con" */}
              <div className="flex items-center gap-3 my-1">
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
                <span style={{ color: '#4a6fa5', fontSize: '13px', whiteSpace: 'nowrap' }}>
                  o continuá con
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
              </div>

              {/* Botones sociales */}
              <div className="grid grid-cols-3 gap-3">
                {/* Google */}
                <button
                  type="button"
                  id="login-google-btn"
                  style={{
                    padding: '12px 8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Google "G" SVG */}
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>

                {/* Apple */}
                <button
                  type="button"
                  id="login-apple-btn"
                  style={{
                    padding: '12px 8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Apple SVG */}
                  <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.8-317.3 71 0 130.3 46.7 173.1 46.7 41.3 0 106.5-49.3 185.5-49.3zm-90-170.7c34.1-40.2 58.7-96 58.7-151.8 0-7.7-.6-15.5-1.9-22.5-55.5 2.1-121.7 36.8-160.6 79.1-31 33.7-59.9 89.5-59.9 146.1 0 8.4 1.3 16.8 1.9 19.4 3.2.5 8.4 1.3 13.6 1.3 50 0 110.8-33.1 148.2-71.6z"/>
                  </svg>
                  Apple
                </button>

                {/* Facebook */}
                <button
                  type="button"
                  id="login-facebook-btn"
                  style={{
                    padding: '12px 8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Facebook SVG */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </button>
              </div>
            </form>
          )}

          {/* ── Footer: registro / chofer ── */}
          {!resetSuccess && (
            <div className="mt-7 text-center space-y-3">
              <p style={{ color: '#8da4c4', fontSize: '14px' }}>
                ¿No tenés cuenta?{' '}
                <button
                  type="button"
                  id="login-register-link"
                  onClick={() => navigate('/register')}
                  style={{ color: '#00D4FF', fontWeight: '700' }}
                >
                  Registrate
                </button>
              </p>

              {/* Separador opciones de chofer */}
              <div className="flex items-center gap-2 justify-center">
                <span style={{ display: 'block', height: '1px', width: '32px', background: 'rgba(255,255,255,0.15)' }} />
                <span style={{ color: '#4a6fa5', fontSize: '12px' }}>Opciones de Chofer</span>
                <span style={{ display: 'block', height: '1px', width: '32px', background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <button
                type="button"
                id="login-chofer-link"
                onClick={() => navigate('/registro-conductor')}
                style={{ color: '#0D6EFD', fontWeight: '700', fontSize: '14px' }}
              >
                Quiero ser chofer UBI
              </button>

              {/* Iconos de confianza */}
              <div className="flex items-center justify-center gap-5 pt-3">
                <div className="flex items-center gap-1.5">
                  <Car size={14} style={{ color: '#4a6fa5' }} />
                  <span style={{ color: '#4a6fa5', fontSize: '11px' }}>Viajes seguros</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} style={{ color: '#4a6fa5' }} />
                  <span style={{ color: '#4a6fa5', fontSize: '11px' }}>Choferes verificados</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
