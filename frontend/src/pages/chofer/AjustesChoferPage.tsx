import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, Users, Lock, Loader2, Eye, EyeOff } from "lucide-react";

export default function AjustesChoferPage({ 
    choferNombre, 
    configPago, 
    updatePassMsg, 
    handleUpdatePassword, 
    newPassword, 
    setNewPassword, 
    showPassword, 
    setShowPassword, 
    updatePassLoading 
}: any) {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => navigate('/chofer')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 font-medium transition-colors text-sm w-fit">
                <ArrowLeft size={18} /> Volver al Panel
            </button>

            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Settings size={20}/> Ajustes y Seguridad</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
               {/* Card Datos Personales */}
               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Users size={18} className="text-emerald-400" /> Perfil del Conductor
                  </h3>
                  <p className="text-zinc-400 text-sm mb-6">Información registrada en la flota.</p>
                  
                  <div className="space-y-4">
                      <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                          <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Nombre Completo</p>
                          <p className="text-white font-medium">{choferNombre || 'Cargando...'}</p>
                      </div>
                      <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                          <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Documento (DNI)</p>
                          <p className="text-blue-400 font-mono font-bold tracking-widest">{configPago?.dni || 'Sin registrar'}</p>
                      </div>
                  </div>
               </div>

               {/* Card Cambio de Clave */}
               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Lock size={18} className="text-blue-400" /> Cambiar Contraseña
                  </h3>
                  <p className="text-zinc-400 text-sm mb-4">Actualiza tu contraseña periódicamente por seguridad. Asegurate de usar al menos 6 caracteres.</p>

                  {updatePassMsg.text && (
                    <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${updatePassMsg.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-green-500/10 text-green-400 border border-green-500/30'}`}>
                       {updatePassMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                       <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Nueva Contraseña</label>
                       <div className="relative">
                         <input 
                            type={showPassword ? "text" : "password"}
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 pr-12 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
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
                       disabled={updatePassLoading || newPassword.length < 6}
                       className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2"
                    >
                       {updatePassLoading ? <Loader2 size={18} className="animate-spin" /> : "Actualizar Contraseña"}
                    </button>
                  </form>
               </div>
            </div>
        </div>
    );
}
