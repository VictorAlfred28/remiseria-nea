import { API_BASE_URL } from '../config';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Mail, ArrowLeft, User, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { PasswordInput, AuthInput, AuthButton, AuthLayout } from '../components/auth';

export default function Register() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const checkSession = useAuthStore((state) => state.checkSession);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!/^\d+$/.test(telefono.replace(/\s+/g, '').replace('+', ''))) {
      setErrorMsg('El teléfono debe contener solo números.');
      setLoading(false);
      return;
    }

    const finalEmail = email.toLowerCase().trim();

    try {
      const apiBase = API_BASE_URL;

      let response: Response;
      try {
        response = await fetch(`${apiBase}/public/organizaciones/default`);
      } catch {
        throw new Error('No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.');
      }

      if (!response.ok) throw new Error('No hay organizaciones configuradas en la plataforma.');
      const { id: organizacionId } = await response.json();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: finalEmail,
        password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('Este correo ya se encuentra registrado.');
        }
        throw new Error(authError.message);
      }

      if (authData.user) {
        let profileResp: Response;
        try {
          profileResp = await fetch(`${apiBase}/public/registro/perfil`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              auth_uid: authData.user.id,
              organizacion_id: organizacionId,
              email: finalEmail,
              nombre,
              telefono,
            }),
          });
        } catch {
          throw new Error('No se pudo conectar con el servidor para guardar tu perfil.');
        }

        if (!profileResp.ok) {
          const detail = await profileResp.json().catch(() => ({}));
          const errMsg = (detail as any).detail || profileResp.statusText;
          if (errMsg.includes('ya existe') || errMsg.includes('already exists')) {
            throw new Error('Este correo ya se encuentra registrado.');
          }
          throw new Error('Error en registro de datos: ' + errMsg);
        }

        if (authData.session) {
          localStorage.setItem('sb-access-token', authData.session.access_token);
          await checkSession();
          navigate('/cliente');
        } else {
          setErrorMsg('Registro exitoso. Por favor, confirmá tu correo e iniciá sesión.');
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
    <AuthLayout showLogo bg="gradient">

      {/* Error banner */}
      {errorMsg && (
        <div
          role="alert"
          className="mb-5 w-full bg-red-500/10 border border-red-500/50 text-red-400 text-sm px-4 py-3 rounded-xl animate-in fade-in"
        >
          {errorMsg}
        </div>
      )}

      {/* Card */}
      <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-6 sm:p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden mb-6">
        {/* Top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, transparent, #0D6EFD 30%, #00D4FF 50%, #0D6EFD 70%, transparent)' }}
          aria-hidden="true"
        />

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Crear cuenta</h1>
          <p className="text-zinc-400 text-sm">Completá tus datos para registrarte</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <AuthInput
            id="register-nombre"
            label="Nombre Completo"
            type="text"
            required
            placeholder="Juan Pérez"
            value={nombre}
            onChange={setNombre}
            autoComplete="name"
            icon={<User size={18} className="text-zinc-500" />}
            variant="darker"
          />

          <AuthInput
            id="register-telefono"
            label="Teléfono"
            type="tel"
            required
            placeholder="+54 9 11 1234-5678"
            value={telefono}
            onChange={setTelefono}
            autoComplete="tel"
            icon={<Phone size={18} className="text-zinc-500" />}
            variant="darker"
          />

          <AuthInput
            id="register-email"
            label="Correo Electrónico"
            type="email"
            required
            placeholder="tu@correo.com"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            icon={<Mail size={18} className="text-zinc-500" />}
            variant="darker"
          />

          <PasswordInput
            id="register-password"
            label="Contraseña"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={setPassword}
            required
            minLength={6}
            autoComplete="new-password"
            size="md"
            variant="darker"
          />

          <div className="pt-2">
            <AuthButton type="submit" loading={loading} variant="primary" id="register-submit-btn" className="!py-4 !text-lg">
              Crear mi cuenta
            </AuthButton>
          </div>
        </form>
      </div>

      {/* Back to login */}
      <button
        type="button"
        onClick={() => navigate('/login')}
        style={{ width: 'auto' }}
        className="mb-8 text-[#C7D2FE] hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Ya tengo cuenta, iniciar sesión
      </button>

      {/* Driver CTA */}
      <div className="text-center space-y-2 pb-4">
        <div className="flex items-center gap-2 justify-center opacity-60">
          <span className="h-px w-12 bg-white/20 block" />
          <span className="text-[11px] text-zinc-400">¿Sos chofer?</span>
          <span className="h-px w-12 bg-white/20 block" />
        </div>
        <button
          type="button"
          onClick={() => navigate('/registro-conductor')}
          style={{ width: 'auto' }}
          className="flex items-center gap-2 text-[#0D6EFD] font-bold text-sm hover:text-blue-400 transition mx-auto"
        >
          <Car size={14} aria-hidden="true" />
          Registrarme como chofer UBI
        </button>
      </div>

    </AuthLayout>
  );
}
