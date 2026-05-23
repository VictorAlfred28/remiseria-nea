import { API_BASE_URL } from '../config';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, Mail, Loader2, ArrowLeft, User, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function Register() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
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
            Pasajero Nuevo
          </h1>
          <p className="text-[#00D4FF] font-bold text-lg text-center">
            Registrate para viajar.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 text-sm px-4 py-3 rounded-xl animate-in fade-in w-full">
            {errorMsg}
          </div>
        )}

        <div className="w-full glass-panel p-6 sm:p-8 rounded-[2rem] shadow-2xl relative overflow-hidden mb-4">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#0D6EFD]/50 to-transparent"></div>

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
                  type="password"
                  required
                  minLength={6}
                  className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] transition-all text-white placeholder-zinc-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
