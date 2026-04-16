import { useState, useEffect } from "react";
import { Lock, User, Shield, Plus, Trash2, Map } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function ControlParental({ user, isPro }: { user: any, isPro: boolean }) {
    const [familyMembers, setFamilyMembers] = useState<any[]>([]);
    const [invitePhone, setInvitePhone] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [tutorPhoneToAccept, setTutorPhoneToAccept] = useState("");
    const [familyLoading, setFamilyLoading] = useState(false);
    
    // Reglas PRO
    const [showProConfig, setShowProConfig] = useState(false);
    const [familyRules, setFamilyRules] = useState({ max_trips_per_day: '', max_amount_per_trip: '', allowed_start_time: '', allowed_end_time: '', require_approval: false });
    const [aprobacionesPro, setAprobacionesPro] = useState<any[]>([]);
    const [familyZones, setFamilyZones] = useState<any[]>([]);
    const [newZone, setNewZone] = useState({ nombre: '', tipo: 'permitida', lat: -27.45, lng: -58.98, radio_metros: 1000 });

    useEffect(() => {
        cargarFamilia();
    }, [user]);

    const cargarFamilia = async () => {
        if (!user) return;
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/members`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setFamilyMembers(data.members || []);
                // Si soy tutor, cargar aprobaciones y reglas
                if(data.members?.some((m:any) => m.rol === 'tutor' && m.user_id === user?.id)) {
                    cargarAprobacionesPro();
                    cargarReglasPro();
                    cargarZonasPro();
                }
            }
        } catch(e) {}
    };

    const cargarZonasPro = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/zones`, {
               headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if(resp.ok) {
                const data = await resp.json();
                setFamilyZones(data.zones || []);
            }
        } catch(e){}
    };

    const cargarAprobacionesPro = async () => {
        const { data } = await supabase.from('viajes').select('id, origen, destino, precio_original, final_price, estado, clientes:usuarios!viajes_cliente_id_fkey(nombre)')
           .eq('estado', 'esperando_tutor')
           .eq('tutor_responsable_id', user?.id);
        if(data) setAprobacionesPro(data);
    };

    const cargarReglasPro = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/rules`, {
               headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if(resp.ok) {
                const d = await resp.json();
                if(d.rules) setFamilyRules({
                    max_trips_per_day: d.rules.max_trips_per_day || '',
                    max_amount_per_trip: d.rules.max_amount_per_trip || '',
                    allowed_start_time: d.rules.allowed_start_time || '',
                    allowed_end_time: d.rules.allowed_end_time || '',
                    require_approval: d.rules.require_approval || false
                });
            }
        } catch(e){}
    };

    const handleCreateGroup = async () => {
        setFamilyLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/create`, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.detail || "Error al crear grupo familiar");
            }
            await cargarFamilia();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setFamilyLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!invitePhone) return;
        setFamilyLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/invite`, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`, "Content-Type": "application/json" },
                body: JSON.stringify({ telefono: invitePhone, nombre: inviteName || "Familiar" })
            });
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.detail || "Error al invitar");
            }
            setInvitePhone(""); setInviteName("");
            alert("Invitación enviada por WhatsApp");
            await cargarFamilia();
        } catch(err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setFamilyLoading(false);
        }
    };

    const handleAcceptInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setFamilyLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/accept`, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`, "Content-Type": "application/json" },
                body: JSON.stringify({ tutor_telefono: tutorPhoneToAccept })
            });
            if(resp.ok) {
                alert("¡Grupo Familiar vinculado exitosamente!");
                await cargarFamilia();
            } else {
                const d = await resp.json();
                alert(d.detail || "Error al aceptar invitación");
            }
        } catch(err) {
             alert("Error de conexión");
        } finally {
             setFamilyLoading(false);
        }
    };

    const handleTripAction = async (viajeId: string, action: 'approve'|'reject') => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/trip-action`, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`, "Content-Type": "application/json" },
                body: JSON.stringify({ viaje_id: viajeId, action })
            });
            if(res.ok) {
                alert(action === 'approve' ? 'Viaje aprobado y en búsqueda 🚗' : 'Viaje Rechazado 🚫');
                await cargarAprobacionesPro();
            } else {
                alert("Error intentando " + action);
            }
        } catch(e) {
            alert("Error de red");
        }
    };

    const handleSaveRules = async (e: React.FormEvent) => {
        e.preventDefault();
        setFamilyLoading(true);
        try {
            const payload: any = {};
            if (familyRules.max_amount_per_trip) payload.max_amount_per_trip = parseFloat(familyRules.max_amount_per_trip);
            if (familyRules.max_trips_per_day) payload.max_trips_per_day = parseInt(familyRules.max_trips_per_day);
            if (familyRules.allowed_start_time) payload.allowed_start_time = familyRules.allowed_start_time;
            if (familyRules.allowed_end_time) payload.allowed_end_time = familyRules.allowed_end_time;
            payload.require_approval = familyRules.require_approval;

            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/rules`, {
               method: 'POST',
               headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`, "Content-Type": "application/json" },
               body: JSON.stringify(payload)
            });
            if(res.ok) {
                alert("Reglas guardadas exitosamente!");
                setShowProConfig(false);
            } else {
                const d = await res.json();
                alert(d.detail || "Error guardando reglas");
            }
        } catch(err) {
            alert("Error de conexión");
        } finally {
            setFamilyLoading(false);
        }
    };

    const handleAddZone = async (e: React.FormEvent) => {
        e.preventDefault();
        setFamilyLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/zones`, {
               method: 'POST',
               headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}`, "Content-Type": "application/json" },
               body: JSON.stringify(newZone)
            });
            if(res.ok) {
                setNewZone({ ...newZone, nombre: '' });
                alert("Zona agregada exitosamente");
                await cargarZonasPro();
            } else {
                alert("Error al agregar zona");
            }
        } catch(e) {
            alert("Error");
        } finally {
            setFamilyLoading(false);
        }
    };

    const handleDeleteZone = async (zona_id: string) => {
        if(!confirm("¿Eliminar zona límite?")) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/family/zones/${zona_id}`, {
               method: 'DELETE',
               headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if(res.ok) await cargarZonasPro();
        } catch(e){}
    };

    return (
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-blue-500/20 shadow-xl p-6 md:p-8 rounded-3xl animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6">
                <Shield className="text-blue-500" size={28} />
                <h2 className="text-2xl font-black text-white">Grupo Familiar</h2>
            </div>
               
            <p className="text-zinc-400 mb-8 max-w-xl">
                Vincula cuentas de menores para supervisar sus viajes en tiempo real y centralizar todos los pagos en tu cuenta automáticamente.
            </p>

            {familyMembers.length > 0 || (familyMembers.some(m => m.rol === 'tutor')) ? (
                <div className="space-y-6">
                    {/* Lista de Miembros */}
                    <div className="bg-black/20 p-5 rounded-2xl border border-white/5 space-y-4">
                        <h3 className="font-bold text-white mb-2">Miembros Vinculados</h3>
                        {familyMembers.map((m, i) => (
                            <div key={i} className="flex justify-between items-center bg-zinc-800/50 p-4 rounded-xl">
                                <div className="flex items-center gap-3">
                                    {m.usuarios?.foto_perfil ? (
                                        <img src={m.usuarios.foto_perfil} className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center"><User size={16} className="text-zinc-400" /></div>
                                    )}
                                    <div>
                                        <p className="text-white font-bold">{m.usuarios?.nombre || "Usuario"}</p>
                                        <p className="text-xs text-zinc-400">{m.usuarios?.telefono}</p>
                                    </div>
                                </div>
                                <span className={`text-xs px-3 py-1 rounded-full font-bold ${m.estado === 'activo' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    {m.estado}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Invitar */}
                    <form onSubmit={handleInvite} className="bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20 flex flex-col gap-3">
                        <h3 className="font-bold text-blue-200">Invitar Adolescente</h3>
                        <div className="flex gap-2">
                            <input placeholder="Nombre" value={inviteName} onChange={e => setInviteName(e.target.value)} className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white" />
                        </div>
                        <div className="flex gap-2">
                            <input type="tel" placeholder="Nro Teléfono (+549...)" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} className="flex-[2] bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white" />
                            <button type="submit" disabled={familyLoading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">{familyLoading ? '...' : 'Invitar'}</button>
                        </div>
                    </form>
                    
                    {/* APROBACIONES PENDIENTES */}
                    {aprobacionesPro.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="font-bold text-amber-500 flex items-center gap-2 mb-3">
                                <Shield size={18} /> Viajes esperando aprobación manual
                            </h3>
                            <div className="space-y-3">
                                {aprobacionesPro.map(ap => (
                                    <div key={ap.id} className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2">
                                        <div className="flex justify-between items-start text-sm">
                                            <div className="text-zinc-300">
                                                <p><span className="text-amber-500">De:</span> {ap.clientes?.nombre}</p>
                                                <p className="truncate w-40"><span className="text-zinc-500">Origen:</span> {ap.origen?.direccion}</p>
                                                <p className="truncate w-40"><span className="text-zinc-500">Destino:</span> {ap.destino?.direccion}</p>
                                            </div>
                                            <div className="text-right font-bold text-green-400">
                                                ${ap.final_price || ap.precio_original}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t border-white/5">
                                            <button onClick={() => handleTripAction(ap.id, 'reject')} className="flex-1 py-1.5 bg-red-500/20 text-red-400 rounded-lg font-bold text-sm hover:bg-red-500/30">Rechazar</button>
                                            <button onClick={() => handleTripAction(ap.id, 'approve')} className="flex-1 py-1.5 bg-green-500/20 text-green-400 rounded-lg font-bold text-sm hover:bg-green-500/30">Aprobar</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* PANEL REGALAS PRO */}
                    {isPro ? (
                        <div className="bg-indigo-500/10 border border-indigo-500/30 p-5 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 py-1 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-[10px] font-black uppercase tracking-wider text-white rounded-bl-xl">SaaS PRO</div>
                            <h3 className="font-bold text-indigo-300 mb-4 flex items-center gap-2"><Lock size={18}/> Reglas y Restricciones</h3>
                            
                            {!showProConfig ? (
                                <button onClick={() => setShowProConfig(true)} className="w-full py-2 bg-indigo-600/20 text-indigo-400 rounded-xl font-bold hover:bg-indigo-600/40 transition">
                                    Configurar Restricciones
                                </button>
                            ) : (
                                <form onSubmit={handleSaveRules} className="space-y-4 text-sm animate-in fade-in zoom-in-95">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-zinc-400 text-xs">Monto Máximo ($)</label>
                                            <input type="number" placeholder="Ej: 5000" value={familyRules.max_amount_per_trip || ''} onChange={e => setFamilyRules({...familyRules, max_amount_per_trip: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-zinc-400 text-xs">Max. Viajes / Día</label>
                                            <input type="number" placeholder="Límite diario" value={familyRules.max_trips_per_day || ''} onChange={e => setFamilyRules({...familyRules, max_trips_per_day: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-zinc-400 text-xs">Horario de Inicio</label>
                                            <input type="time" value={familyRules.allowed_start_time || ''} step="1" onChange={e => setFamilyRules({...familyRules, allowed_start_time: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-zinc-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-zinc-400 text-xs">Horario Límite</label>
                                            <input type="time" value={familyRules.allowed_end_time || ''} step="1" onChange={e => setFamilyRules({...familyRules, allowed_end_time: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-zinc-500" />
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-white/5 cursor-pointer">
                                        <input type="checkbox" checked={familyRules.require_approval} onChange={e => setFamilyRules({...familyRules, require_approval: e.target.checked})} className="w-5 h-5 accent-indigo-500" />
                                        <div>
                                            <p className="font-bold text-white text-sm leading-none mb-1">Aprobación Estricta</p>
                                            <p className="text-xs text-zinc-500">Ningún coche buscará al menor sin tu OK previo.</p>
                                        </div>
                                    </label>
                                    <div className="flex gap-2 pt-2">
                                        <button type="button" onClick={() => setShowProConfig(false)} className="px-4 py-2 bg-zinc-800 text-white rounded-xl">Cerrar</button>
                                        <button type="submit" disabled={familyLoading} className="flex-1 bg-indigo-600 text-white font-bold rounded-xl">{familyLoading ? '...' : 'Guardar Reglas'}</button>
                                    </div>
                                </form>
                            )}

                            {/* ZONAS GEOFENCING */}
                            <div className="mt-8 border-t border-white/5 pt-6">
                                <h4 className="text-zinc-300 font-bold text-sm mb-4 flex items-center gap-2"><Map size={16} className="text-indigo-400"/> Zonas GEOFENCING</h4>
                                
                                <div className="space-y-3 mb-6">
                                    {familyZones.length === 0 ? (
                                        <p className="text-zinc-500 text-xs italic">No has definido perímetros de seguridad aún.</p>
                                    ) : (
                                        familyZones.map(z => (
                                            <div key={z.id} className="bg-black/30 p-3 rounded-xl border border-white/5 flex justify-between items-center group">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${z.tipo === 'permitida' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                        <Shield size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{z.nombre}</p>
                                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{z.tipo} • {z.radio_metros}m</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteZone(z.id)} className="p-2 text-zinc-600 hover:text-rose-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="bg-indigo-500/5 border border-white/5 p-4 rounded-xl">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-3">Nueva Zona de Seguridad</p>
                                    <form onSubmit={handleAddZone} className="space-y-3">
                                        <input required type="text" placeholder="Nombre (Ej: Escuela Centenario)" value={newZone.nombre} onChange={e => setNewZone({...newZone, nombre: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={newZone.tipo} onChange={e => setNewZone({...newZone, tipo: e.target.value})} className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                                                <option value="permitida">Zona Permitida</option>
                                                <option value="restringida">Zona Prohibida</option>
                                            </select>
                                            <input required type="number" placeholder="Radio (mts)" value={newZone.radio_metros} onChange={e => setNewZone({...newZone, radio_metros: parseInt(e.target.value.toString())})} className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[9px] text-zinc-500 uppercase px-1">Latitud</label>
                                                <input required type="number" step="0.000001" value={newZone.lat} onChange={e => setNewZone({...newZone, lat: parseFloat(e.target.value)})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] text-zinc-500 uppercase px-1">Longitud</label>
                                                <input required type="number" step="0.000001" value={newZone.lng} onChange={e => setNewZone({...newZone, lng: parseFloat(e.target.value)})} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={familyLoading} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2">
                                            <Plus size={14} /> {familyLoading ? 'Creando...' : 'Añadir Perímetro'}
                                        </button>
                                    </form>
                                    <p className="text-[9px] text-zinc-500 mt-3 italic text-center">Tip: Puedes obtener la Lat/Lng tocando el mapa o desde Google Maps.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-zinc-800/40 p-5 rounded-2xl border border-zinc-700/50 text-center">
                            <Lock className="mx-auto text-zinc-500 mb-2" />
                            <p className="text-sm font-bold text-zinc-300">Restricciones Avanzadas</p>
                            <p className="text-xs text-zinc-500 mt-1">Tu Remisería no te ha asignado un Plan PRO para limitar el horario y consumo de tus dependientes.</p>
                        </div>
                    )}
                    
                </div>
            ) : (
                <div className="flex flex-col gap-6 md:flex-row">
                    {/* Crear Grupo */}
                    <div className="flex-1 bg-zinc-800/50 p-6 rounded-2xl flex flex-col items-center text-center gap-4 border border-zinc-700/50">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <User className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-white mb-1">Soy Tutor</p>
                            <p className="text-sm text-zinc-400">Crear un grupo para administrar dependientes.</p>
                        </div>
                        <button onClick={handleCreateGroup} disabled={familyLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-sm">
                            {familyLoading ? 'Iniciando...' : 'Habilitar Control Parental'}
                        </button>
                    </div>

                    {/* Vincularme a Tutor */}
                    <div className="flex-1 bg-zinc-800/50 p-6 rounded-2xl flex flex-col items-center text-center gap-4 border border-zinc-700/50">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
                            <Lock className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-white mb-1">Soy Adolescente</p>
                            <p className="text-sm text-zinc-400">Tengo permiso y quiero vincularme.</p>
                        </div>
                        <form onSubmit={handleAcceptInvite} className="w-full flex gap-2">
                            <input type="tel" placeholder="Teléfono de Tutor" required value={tutorPhoneToAccept} onChange={e => setTutorPhoneToAccept(e.target.value)} className="w-full bg-black/50 border border-white/10 p-2 rounded-xl text-white text-sm" />
                            <button type="submit" disabled={familyLoading} className="bg-purple-600 px-4 text-white font-bold rounded-xl text-sm">→</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
