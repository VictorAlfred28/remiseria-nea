import React, { useState, useEffect } from "react";
import { Lock, User, Phone, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function MiPerfilAdmin() {
  const [loading, setLoading] = useState(true);
  const [savingData, setSavingData] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [dataFeedback, setDataFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [passFeedback, setPassFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data, error } = await supabase
        .from("usuarios")
        .select("nombre, telefono")
        .eq("id", user.id)
        .single();

      if (data && !error) {
        setNombre(data.nombre || "");
        setTelefono(data.telefono || "");
      }
    } catch (err) {
      console.error("Error al cargar perfil:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateData = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingData(true);
    setDataFeedback(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No estás autenticado");

      const { error } = await supabase
        .from("usuarios")
        .update({ nombre, telefono })
        .eq("id", user.id);

      if (error) throw error;
      setDataFeedback({ type: "success", msg: "Datos actualizados correctamente." });
    } catch (err: any) {
      setDataFeedback({ type: "error", msg: err.message || "Error al actualizar datos." });
    } finally {
      setSavingData(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPass(true);
    setPassFeedback(null);

    if (newPassword.length < 6) {
      setPassFeedback({ type: "error", msg: "La contraseña debe tener al menos 6 caracteres." });
      setSavingPass(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassFeedback({ type: "error", msg: "Las contraseñas no coinciden." });
      setSavingPass(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setPassFeedback({ type: "success", msg: "Contraseña actualizada exitosamente." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassFeedback({ type: "error", msg: err.message || "Error al cambiar contraseña." });
    } finally {
      setSavingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-[#0D6EFD]" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 flex flex-col gap-8 lg:flex-row">
      {/* Datos Personales */}
      <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <User className="text-[#0D6EFD]" size={22} /> Datos Personales
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Actualiza la información básica de tu cuenta de administrador.
          </p>
        </div>

        {dataFeedback && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-semibold border ${dataFeedback.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
            <div className="flex items-center gap-2">
              {dataFeedback.type === "success" && <CheckCircle2 size={16} />}
              {dataFeedback.msg}
            </div>
          </div>
        )}

        <form onSubmit={handleUpdateData} className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Correo Electrónico</label>
            <input 
              type="email" 
              value={email} 
              disabled 
              className="w-full bg-black/50 border border-zinc-800 px-4 py-3 rounded-xl text-zinc-500 outline-none cursor-not-allowed" 
            />
            <p className="text-[10px] text-zinc-600">El correo no puede modificarse desde aquí.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nombre Completo</label>
            <input 
              type="text" 
              value={nombre} 
              onChange={e => setNombre(e.target.value)} 
              placeholder="Tu nombre completo"
              required
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#0D6EFD] px-4 py-3 rounded-xl text-white outline-none transition-colors" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Teléfono de Contacto</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="tel" 
                value={telefono} 
                onChange={e => setTelefono(e.target.value)} 
                placeholder="Ej: +54 9 379..."
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#0D6EFD] pl-12 pr-4 py-3 rounded-xl text-white outline-none transition-colors" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={savingData} 
            className="mt-2 w-full bg-[#0D6EFD] text-white font-bold py-3.5 rounded-xl transition-all hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {savingData ? <Loader2 className="animate-spin" size={18} /> : "Guardar Cambios"}
          </button>
        </form>
      </div>

      {/* Cambio de Contraseña */}
      <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <KeyRound className="text-purple-500" size={22} /> Seguridad
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Modifica tu contraseña de acceso al panel de control.
          </p>
        </div>

        {passFeedback && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-semibold border ${passFeedback.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
            <div className="flex items-center gap-2">
              {passFeedback.type === "success" && <CheckCircle2 size={16} />}
              {passFeedback.msg}
            </div>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nueva Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-purple-500 pl-12 pr-4 py-3 rounded-xl text-white outline-none transition-colors" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Confirmar Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="Repite tu nueva contraseña"
                required
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-purple-500 pl-12 pr-4 py-3 rounded-xl text-white outline-none transition-colors" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={savingPass} 
            className="mt-2 w-full bg-purple-600 text-white font-bold py-3.5 rounded-xl transition-all hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {savingPass ? <Loader2 className="animate-spin" size={18} /> : "Actualizar Contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
