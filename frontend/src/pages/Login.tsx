import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Lock, Mail, Loader2, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

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
        // Verificar estado de aprobación para choferes
        const { data: userData, error: profileError } = await supabase
          .from('usuarios')
          .select('rol, estado')
          .eq('id', data.session.user.id)
          .single();

        if (profileError) {
          console.error("Error al obtener perfil:", profileError);
          // Si el perfil no existe o falla la query (ej. 500), informamos al usuario
          if (profileError.code === 'PGRST116') {
             throw new Error("No se encontró un perfil de usuario asociado a esta cuenta. Por favor, contacta al soporte.");
          } else {
             throw new Error(`Error de sistema (${profileError.code || '500'}). Tu sesión se inició pero no pudimos cargar tu perfil.`);
          }
        }

        const isPrimarySuperAdmin = userData?.rol === 'superadmin' && data.session.user.email === 'agentech.nea@gmail.com';

        // Verificar estado de aprobación administrativa (excepto para superadmin principal)
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
          // Navegar directamente al dashboard según el rol para evitar race condition en "/"
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
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center relative bg-[#030712] overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
         <img src="/bg-login.png" alt="City Night" className="w-full h-full object-cover opacity-50" loading="lazy" />
         <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/30 via-[#030712]/70 to-[#030712] backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-4 safe-pt safe-pb flex flex-col items-center animate-in fade-in duration-700 h-full overflow-y-auto scrollbar-hide">
        
        <div className="flex flex-col items-center mb-6 mt-8 sm:mt-12">
          <div className="w-24 h-24 bg-[#071B4D] border border-white/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(13,110,253,0.3)] mb-4">
            <div className="text-center">
              <span className="text-4xl font-black text-white tracking-tighter block leading-none">UBI</span>
              <span className="text-[10px] font-bold text-white tracking-widest block uppercase">Traslados</span>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1 text-center">
            {isResetView ? "Recuperar Acceso" : "Movemos personas."}
          </h1>
          <p className="text-[#00D4FF] font-bold text-lg text-center">
            {isResetView ? "Ingresa tu email para continuar." : "Conectamos destinos."}
          </p>
        </div>

        {/* Benefits Cards (Visual Only) */}
        {!isResetView && (
          <div className="grid grid-cols-4 gap-2 w-full mb-8 px-2">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 shadow-lg backdrop-blur-md">
                <Car size={20} className="text-[#00D4FF]" />
              </div>
              <span className="text-[10px] text-[#C7D2FE] leading-tight font-medium">Viajes<br/>seguros</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 shadow-lg backdrop-blur-md">
                <CheckCircle2 size={20} className="text-[#0D6EFD]" />
              </div>
              <span className="text-[10px] text-[#C7D2FE] leading-tight font-medium">Choferes<br/>verificados</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 shadow-lg backdrop-blur-md">
                <span className="text-xl font-black text-[#00D4FF]">%</span>
              </div>
              <span className="text-[10px] text-[#C7D2FE] leading-tight font-medium">Beneficios y<br/>descuentos</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 shadow-lg backdrop-blur-md">
                <span className="text-sm font-bold text-[#0D6EFD]">24/7</span>
              </div>
              <span className="text-[10px] text-[#C7D2FE] leading-tight font-medium">Soporte<br/>continuo</span>
            </div>
          </div>
        )}

        <div className="w-full glass-panel p-6 sm:p-8 rounded-[2rem] shadow-2xl relative overflow-hidden mb-4">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#0D6EFD]/50 to-transparent"></div>
          
          <div className="text-center mb-6">
             <h2 className="text-xl font-bold text-white mb-1">{isResetView ? "Recuperación" : "Iniciar sesión"}</h2>
             <p className="text-sm text-[#C7D2FE]">{isResetView ? "Te enviaremos un enlace" : "Accedé a tu cuenta para continuar"}</p>
          </div>

        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 text-sm px-4 py-3 rounded-xl animate-in fade-in">
            {errorMsg === "Invalid login credentials" ? "El correo o la contraseña son incorrectos." : errorMsg}
          </div>
        )}

        {resetSuccess ? (
          <div className="mb-6 bg-green-500/10 border border-green-500/50 text-green-400 text-sm px-4 py-6 rounded-xl animate-in fade-in text-center flex flex-col items-center">
            <CheckCircle2 size={48} className="text-green-500 mb-3" />
            <p className="font-bold text-lg mb-1">¡Correo enviado¡</p>
            <p>Revisa tu bandeja de entrada (y la carpeta de spam) para restablecer tu contraseña.</p>
            <button 
              onClick={() => { setIsResetView(false); setResetSuccess(false); }}
              className="mt-6 text-blue-400 hover:text-blue-300 font-medium underline"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : isResetView ? (
          <form onSubmit={handleResetPassword} className="space-y-5 animate-in slide-in-from-right-4 fade-in">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-zinc-500" />
                </div>
                <input
                  type="email"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] transition-all text-white placeholder-zinc-500"
                  placeholder="admin@viajesnea.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 mt-2 bg-[#0D6EFD] text-white font-bold rounded-xl shadow-[0_0_20px_rgba(13,110,253,0.3)] hover:shadow-[0_0_25px_rgba(13,110,253,0.5)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Enviar Enlace de Recuperación"}
            </button>

            <button
              type="button"
              onClick={() => { setIsResetView(false); setErrorMsg(''); }}
              className="w-full flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors py-2 text-sm mt-2"
            >
              <ArrowLeft size={16} /> Volver a Iniciar Sesión
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5 animate-in slide-in-from-left-4 fade-in">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-zinc-500" />
                </div>
                <input
                  type="email"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] transition-all text-white placeholder-zinc-500"
                  placeholder="admin@viajesnea.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1 mr-1">
                 <label className="block text-sm font-medium text-zinc-300">Contraseña</label>
                 <button 
                  type="button" 
                  onClick={() => { setIsResetView(true); setErrorMsg(''); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                 >
                   ¿Olvidaste tu contraseña?
                 </button>
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-zinc-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-11 pr-12 py-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] transition-all text-white placeholder-zinc-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 mt-2 bg-white text-[#071B4D] font-black rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Ingresar"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center pb-8">
           <p className="text-[#C7D2FE] text-sm mb-2">¿No tenés cuenta?</p>
           <button 
             onClick={() => navigate('/register')}
             className="text-[#00D4FF] hover:text-white transition-colors text-sm font-bold block mx-auto mb-3"
           >
             Registrate como pasajero
           </button>

           <div className="flex items-center gap-2 justify-center text-xs mt-4 opacity-70">
              <span className="h-px w-8 bg-white/20"></span>
              <span className="text-white">Opciones de Chofer</span>
              <span className="h-px w-8 bg-white/20"></span>
           </div>
           
           <button 
             onClick={() => navigate('/registro-conductor')}
             className="text-[#0D6EFD] hover:text-white transition-colors text-sm font-bold mt-3 block mx-auto"
           >
             Quiero ser chofer UBI
           </button>
        </div>

      </div>
    </div>
    </div>
  );
}
