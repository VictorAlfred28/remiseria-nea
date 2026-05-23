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
      className="min-h-screen w-full flex items-start justify-center"
      style={{ background: '#03080f' }}
    >
      <div
        id="login-card"
        className="w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: '430px',
          minHeight: '100svh',
          background: '#03080f',
          boxShadow: '0 0 80px rgba(0,0,0,0.7)',
        }}
      >
        <div
          id="login-image-section"
          className="relative flex-shrink-0"
          style={{
            height: '360px',
            background: '#04102a',
            overflow: 'hidden',
          }}
        >
          <img
            src={loginImg}
            alt="UBI Traslados — Movemos personas. Conectamos destinos."
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center top',
              display: 'block',
            }}
            draggable={false}
          />
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: '80px',
              background: 'linear-gradient(to bottom, transparent, #0d1829)',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div
          id="login-form-section"
          className="relative flex-1 overflow-y-auto"
          style={{
            background: '#0d1829',
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px',
            marginTop: '-28px',
            zIndex: 10,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            className="absolute"
            style={{
              top: 0, left: '30%', right: '30%',
              height: '4px', borderRadius: '9999px',
              background: 'linear-gradient(90deg, transparent, #0D6EFD, #00D4FF, #0D6EFD, transparent)',
            }}
          />

          <div className="px-6 pt-8 pb-10">
            <div className="text-center mb-6">
              <h1 id="login-title" className="text-2xl font-black text-white tracking-tight">
                {isResetView ? 'Recuperar Acceso' : 'Iniciar sesión'}
              </h1>
              <p className="text-sm mt-1 text-[#8da4c4]">
                {isResetView ? 'Te enviaremos un enlace de recuperación' : 'Accedé a tu cuenta para continuar'}
              </p>
            </div>

            {errorMsg && (
              <div id="login-error" className="mb-5 text-sm px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 animate-in fade-in">
                {errorMsg === 'Invalid login credentials' ? 'El correo o la contraseña son incorrectos.' : errorMsg}
              </div>
            )}

            {resetSuccess ? (
              <div className="flex flex-col items-center text-center py-8 px-4 bg-green-500/5 rounded-2xl border border-green-500/20">
                <CheckCircle2 size={48} className="text-green-400 mb-3" />
                <p className="font-bold text-lg text-white mb-1">¡Correo enviado!</p>
                <p className="text-sm text-green-300/80">Revisá tu bandeja de entrada (y spam) para restablecer tu contraseña.</p>
                <button
                  onClick={() => { setIsResetView(false); setResetSuccess(false); }}
                  className="mt-6 text-sm text-blue-400 underline font-medium"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : isResetView ? (
              <form onSubmit={handleResetPassword} className="space-y-4 animate-in slide-in-from-right-4 fade-in">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Mail size={18} className="text-[#4a6fa5]" />
                  </div>
                  <input
                    type="email" required placeholder="Correo electrónico"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#4a6fa5] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : 'Enviar Enlace de Recuperación'}
                </button>
                <button type="button" onClick={() => { setIsResetView(false); setErrorMsg(''); }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[#8da4c4] hover:text-white transition"
                >
                  <ArrowLeft size={16} /> Volver a Iniciar Sesión
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4 animate-in slide-in-from-left-4 fade-in">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-[#c3d4e8] mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <Mail size={18} className="text-[#4a6fa5]" />
                    </div>
                    <input
                      id="login-email" type="email" required placeholder="Correo electrónico"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#4a6fa5] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="login-password" className="block text-sm font-medium text-[#c3d4e8]">
                      Contraseña
                    </label>
                    <button type="button" onClick={() => { setIsResetView(true); setErrorMsg(''); }}
                      className="text-xs font-medium text-[#0D6EFD] hover:text-blue-400 transition"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <Lock size={18} className="text-[#4a6fa5]" />
                    </div>
                    <input
                      id="login-password" type={showPassword ? 'text' : 'password'} required placeholder="Contraseña"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#4a6fa5] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#4a6fa5] hover:text-white transition"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} id="login-submit-btn"
                  className="w-full py-4 mt-2 bg-white text-[#071B4D] font-black text-[17px] rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={20} className="animate-spin text-[#071B4D]" /> : 'Ingresar'}
                </button>

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-[#4a6fa5] whitespace-nowrap">o continuá con</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button type="button" id="login-google-btn"
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 active:scale-[0.97] transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>
                  <button type="button" id="login-apple-btn"
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 active:scale-[0.97] transition"
                  >
                    <svg width="15" height="18" viewBox="0 0 814 1000" fill="white">
                      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.8-317.3 71 0 130.3 46.7 173.1 46.7 41.3 0 106.5-49.3 185.5-49.3zm-90-170.7c34.1-40.2 58.7-96 58.7-151.8 0-7.7-.6-15.5-1.9-22.5-55.5 2.1-121.7 36.8-160.6 79.1-31 33.7-59.9 89.5-59.9 146.1 0 8.4 1.3 16.8 1.9 19.4 3.2.5 8.4 1.3 13.6 1.3 50 0 110.8-33.1 148.2-71.6z"/>
                    </svg>
                    Apple
                  </button>
                  <button type="button" id="login-facebook-btn"
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 active:scale-[0.97] transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </button>
                </div>
              </form>
            )}

            {!resetSuccess && (
              <div className="mt-7 text-center space-y-3">
                <p className="text-sm text-[#8da4c4]">
                  ¿No tenés cuenta?{' '}
                  <button id="login-register-link" onClick={() => navigate('/register')}
                    className="text-[#00D4FF] font-bold hover:text-white transition"
                  >
                    Registrate
                  </button>
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <span className="h-px w-8 bg-white/15 block" />
                  <span className="text-xs text-[#4a6fa5]">Opciones de Chofer</span>
                  <span className="h-px w-8 bg-white/15 block" />
                </div>
                <button id="login-chofer-link" onClick={() => navigate('/registro-conductor')}
                  className="text-[#0D6EFD] font-bold text-sm hover:text-blue-400 transition"
                >
                  Quiero ser chofer UBI
                </button>
                <div className="flex items-center justify-center gap-5 pt-2">
                  <div className="flex items-center gap-1.5 text-[#4a6fa5]">
                    <Car size={14} /><span className="text-[11px]">Viajes seguros</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#4a6fa5]">
                    <ShieldCheck size={14} /><span className="text-[11px]">Choferes verificados</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
