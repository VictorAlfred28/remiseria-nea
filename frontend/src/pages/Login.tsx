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
      className="w-full h-[100dvh] overflow-hidden flex flex-col items-center bg-[#04102a]"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="w-full flex flex-col h-full" style={{ maxWidth: '600px' }}>
        
        {/* IMAGEN SUPERIOR (No tapada por el formulario) */}
        <div 
          className="w-full relative flex-1 flex items-center justify-center overflow-hidden"
          style={{ 
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)'
          }}
        >
          <img
            src={loginImg}
            alt="UBI Traslados"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              transform: 'scaleX(1.35)', /* Expansión horizontal mayor para llenar el ancho */
              transformOrigin: 'center center'
            }}
            draggable={false}
          />
        </div>

        {/* FORMULARIO */}
        <div
          id="login-form-section"
          className="flex-shrink-0 w-full relative z-10 flex flex-col"
          style={{
            background: '#0d1829',
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px',
            boxShadow: '0 -15px 40px rgba(0,0,0,0.5)',
            marginTop: '-15px'
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

            <div className="w-full max-w-[430px] mx-auto px-5 pt-5 pb-4">
            <div className="text-center mb-4">
              <h1 id="login-title" className="text-xl font-black text-white tracking-tight">
                {isResetView ? 'Recuperar Acceso' : 'Iniciar sesión'}
              </h1>
              <p className="text-xs mt-1 text-[#8da4c4]">
                {isResetView ? 'Te enviaremos un enlace de recuperación' : 'Accedé a tu cuenta para continuar'}
              </p>
            </div>

            {errorMsg && (
              <div id="login-error" className="mb-3 text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 animate-in fade-in">
                {errorMsg === 'Invalid login credentials' ? 'El correo o la contraseña son incorrectos.' : errorMsg}
              </div>
            )}

            {resetSuccess ? (
              <div className="flex flex-col items-center text-center py-5 px-4 bg-green-500/5 rounded-2xl border border-green-500/20">
                <CheckCircle2 size={40} className="text-green-400 mb-2" />
                <p className="font-bold text-base text-white mb-1">¡Correo enviado!</p>
                <p className="text-xs text-green-300/80">Revisá tu bandeja de entrada para restablecer tu contraseña.</p>
                <button
                  onClick={() => { setIsResetView(false); setResetSuccess(false); }}
                  className="mt-4 text-xs text-blue-400 underline font-medium"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : isResetView ? (
              <form onSubmit={handleResetPassword} className="space-y-3 animate-in slide-in-from-right-4 fade-in">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Mail size={16} className="text-[#4a6fa5]" />
                  </div>
                  <input
                    type="email" required placeholder="Correo electrónico"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#4a6fa5] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 text-sm bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Enviar Enlace'}
                </button>
                <button type="button" onClick={() => { setIsResetView(false); setErrorMsg(''); }}
                  className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-[#8da4c4] hover:text-white transition"
                >
                  <ArrowLeft size={14} /> Volver
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3 animate-in slide-in-from-left-4 fade-in">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-[#c3d4e8] mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Mail size={16} className="text-[#4a6fa5]" />
                    </div>
                    <input
                      id="login-email" type="email" required placeholder="Correo electrónico"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#4a6fa5] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-medium text-[#c3d4e8]">
                      Contraseña
                    </label>
                    <button type="button" onClick={() => { setIsResetView(true); setErrorMsg(''); }}
                      className="text-[11px] font-medium text-[#0D6EFD] hover:text-blue-400 transition"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lock size={16} className="text-[#4a6fa5]" />
                    </div>
                    <input
                      id="login-password" type={showPassword ? 'text' : 'password'} required placeholder="Contraseña"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-[#4a6fa5] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#4a6fa5] hover:text-white transition"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} id="login-submit-btn"
                  className="w-full py-2.5 mt-1 bg-white text-[#071B4D] font-black text-base rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin text-[#071B4D]" /> : 'Ingresar'}
                </button>

                <div className="flex items-center gap-2 my-1.5">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[11px] text-[#4a6fa5] whitespace-nowrap">o continuá con</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" id="login-facebook-btn"
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold hover:bg-white/10 active:scale-[0.97] transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </button>
                  <button type="button" id="login-instagram-btn"
                    onClick={() => window.open('https://www.instagram.com/ubi_traslados/', '_blank')}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 active:scale-[0.97] transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="url(#ig-grad)">
                      <defs>
                        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stop-color="#f09433" />
                          <stop offset="25%" stop-color="#e6683c" />
                          <stop offset="50%" stop-color="#dc2743" />
                          <stop offset="75%" stop-color="#cc2366" />
                          <stop offset="100%" stop-color="#bc1888" />
                        </linearGradient>
                      </defs>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Instagram
                  </button>
                </div>
              </form>
            )}

            {!resetSuccess && (
              <div className="mt-4 text-center space-y-2">
                <p className="text-xs text-[#8da4c4]">
                  ¿No tenés cuenta?{' '}
                  <button id="login-register-link" onClick={() => navigate('/register')}
                    className="text-[#00D4FF] font-bold hover:text-white transition"
                  >
                    Registrate
                  </button>
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <span className="h-px w-8 bg-white/15 block" />
                  <span className="text-[10px] text-[#4a6fa5]">Opciones de Chofer</span>
                  <span className="h-px w-8 bg-white/15 block" />
                </div>
                <button id="login-chofer-link" onClick={() => navigate('/registro-conductor')}
                  className="text-[#0D6EFD] font-bold text-xs hover:text-blue-400 transition"
                >
                  Quiero ser chofer UBI
                </button>
                <div className="flex items-center justify-center gap-4 pt-1">
                  <div className="flex items-center gap-1 text-[#4a6fa5]">
                    <Car size={12} /><span className="text-[10px]">Viajes seguros</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#4a6fa5]">
                    <ShieldCheck size={12} /><span className="text-[10px]">Choferes verificados</span>
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
