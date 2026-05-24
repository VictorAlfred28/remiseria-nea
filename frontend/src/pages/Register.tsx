import { API_BASE_URL } from '../config';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, Mail, Loader2, ArrowLeft, User, Phone, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import logoOriginal from '../assets/login/logoUbi.png';

export default function Register() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const checkSession = useAuthStore(state => state.checkSession);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Validations
    if (!/^\d+$/.test(telefono.replace(/\s+/g, '').replace('+', ''))) {
      setErrorMsg("El teléfono debe contener solo números.");
      setLoading(false);
      return;
    }
    
    // Convert email to lowercase
    const finalEmail = email.toLowerCase().trim();

    try {
      // 1. Obtener la organización por defecto
      const apiBase = API_BASE_URL;
      let response;
      try {
        response = await fetch(`${apiBase}/public/organizaciones/default`);
      } catch (networkErr) {
        throw new Error("No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.");
      }
      
      if (!response.ok) throw new Error("No hay organizaciones configuradas en la plataforma.");
      
      const { id: organizacionId } = await response.json();

      // 2. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error("Este correo ya se encuentra registrado.");
        }
        throw new Error(authError.message);
      }

      if (authData.user) {
        // 3. Crear registro en tabla pública usuarios
        let profileResp;
        try {
          profileResp = await fetch(`${apiBase}/public/registro/perfil`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: authData.user.id,
                  organizacion_id: organizacionId,
                  email: finalEmail,
                  nombre: nombre,
                  telefono: telefono,
                  rol: 'cliente'
              })
          });
        } catch (networkErr) {
          throw new Error("No se pudo conectar con el servidor para guardar tu perfil.");
        }

        if (!profileResp.ok) {
          const detail = await profileResp.json().catch(() => ({}));
          const errMsg = detail.detail || profileResp.statusText;
          if (errMsg.includes('ya existe') || errMsg.includes('already exists')) {
             throw new Error("Este correo ya se encuentra registrado.");
          }
          throw new Error("Error en registro de datos: " + errMsg);
        }

        // 4. Iniciar sesión automáticamente
        if (authData.session) {
           localStorage.setItem('sb-access-token', authData.session.access_token);
           await checkSession();
           navigate('/cliente');
        } else {
           setErrorMsg("Registro exitoso. Por favor, confirma tu correo e inicia sesión.");
           setTimeout(() => navigate('/login'), 4000);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-hidden overscroll-none bg-gradient-to-b from-[#061a4a] via-[#08296d] to-[#04153d]">
      
      {/* Círculos decorativos sutiles y radar */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
         <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full border-[0.5px] border-blue-400/20"></div>
         <div className="absolute top-[5%] left-[5%] w-[400px] h-[400px] rounded-full border-[0.5px] border-blue-400/10"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full border-[0.5px] border-blue-400/20"></div>
         <div className="absolute bottom-[5%] right-[5%] w-[500px] h-[500px] rounded-full border-[0.5px] border-blue-400/10"></div>
         {/* Glow central */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-4 safe-pt safe-pb flex flex-col items-center justify-center animate-in fade-in duration-700 h-full overflow-y-auto scrollbar-hide py-8">
        
        {/* LOGO ORIGINAL CENTRADO */}
        <div className="flex flex-col items-center mb-8">
           <img src={logoOriginal} alt="UBI Viajes NEA" className="w-52 sm:w-60 object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.3)]" />
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 text-sm px-4 py-3 rounded-xl animate-in fade-in w-full">
            {errorMsg}
          </div>
        )}

        <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-6 sm:p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden mb-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              Crear cuenta
            </h1>
            <p className="text-zinc-300 text-sm">
              Completá tus datos para registrarte
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Nombre Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={18} className="text-zinc-500" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] transition-all text-white placeholder-zinc-500"
                  placeholder="Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Teléfono</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone size={18} className="text-zinc-500" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] transition-all text-white placeholder-zinc-500"
                  placeholder="+54 9 11 1234-5678"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>
            </div>

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
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-zinc-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className="w-full pl-11 pr-11 py-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] transition-all text-white placeholder-zinc-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-white transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 mt-6 bg-[#0D6EFD] text-white font-bold rounded-xl shadow-[0_0_20px_rgba(13,110,253,0.3)] hover:shadow-[0_0_25px_rgba(13,110,253,0.5)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Crear mi cuenta"}
            </button>
          </form>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="w-full mt-2 mb-8 text-[#C7D2FE] hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} /> Ya tengo cuenta, iniciar sesión
        </button>
      </div>
    </div>
  );
}
