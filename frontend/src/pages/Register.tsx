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

    try {
      // 1. Obtener la organización por defecto (mediante el endpoint público backend que bypasses RLS)
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${apiBase}/public/organizaciones/default`);
      
      if (!response.ok) throw new Error("No hay organizaciones configuradas en la plataforma.");
      
      const { id: organizacionId } = await response.json();

      // 2. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw new Error(authError.message);

      if (authData.user) {
        // 3. Crear registro en tabla pública usuarios
        const profileResp = await fetch(`${apiBase}/public/registro/perfil`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: authData.user.id,
                organizacion_id: organizacionId,
                email: email,
                nombre: nombre,
                telefono: telefono,
                rol: 'cliente'
            })
        });

        if (!profileResp.ok) {
          const detail = await profileResp.json();
          throw new Error("Usuario creado, pero hubo un error en registro de datos: " + (detail.detail || profileResp.statusText));
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
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-4">
      <div className="absolute top-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-600/20 blur-[120px] rounded-full"></div>
          <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-green-600/20 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Car size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1">Viajes NEA</h1>
          <p className="text-zinc-400 text-sm text-center">
            Regístrate como Pasajero
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 text-sm px-4 py-3 rounded-xl animate-in fade-in">
            {errorMsg}
          </div>
        )}

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
                className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
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
                className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
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
                className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
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
                className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 mt-4 bg-white text-black font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] hover:bg-zinc-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Crear mi cuenta"}
          </button>
        </form>

        <button
          onClick={() => navigate('/login')}
          className="w-full mt-6 text-zinc-400 hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} /> Ya tengo cuenta, iniciar sesión
        </button>
      </div>
    </div>
  );
}
