import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Plus, Edit, Trash2, Building, Users, Percent, Search, CreditCard, History, DollarSign } from "lucide-react";

export default function EmpresasAdmin() {
    const [empresas, setEmpresas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // UI states
    const [verDetalle, setVerDetalle] = useState<any>(null); // Empresa seleccionada para gestion de usu & beneficios
    const [showForm, setShowForm] = useState(false);
    
    // Form fields (Empresa)
    const [id, setId] = useState("");
    const [nombre, setNombre] = useState("");
    const [cuit, setCuit] = useState("");
    const [activo, setActivo] = useState(true);

    useEffect(() => {
        fetchEmpresas();
    }, []);

    const fetchEmpresas = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setEmpresas(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEmpresa = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        try {
            const method = id ? "PUT" : "POST";
            const url = id 
                ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas/${id}` 
                : `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas`;
                
            const resp = await fetch(url, {
                method,
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` 
                },
                body: JSON.stringify({ nombre_empresa: nombre, cuit, activo })
            });
            if (resp.ok) {
                setShowForm(false);
                setId(""); setNombre(""); setCuit(""); setActivo(true);
                fetchEmpresas();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const editEmpresa = (em: any) => {
        setId(em.id);
        setNombre(em.nombre_empresa);
        setCuit(em.cuit || "");
        setActivo(em.activo);
        setShowForm(true);
    }

    return (
        <div className="space-y-6">
            {!verDetalle ? (
                <>
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-black text-white flex items-center gap-2"><Building /> Empresa Adheridas</h2>
                            <p className="text-zinc-500 text-sm">Administra las compañías, descuentos y empleados autorizados.</p>
                        </div>
                        <button onClick={() => { setId(""); setNombre(""); setCuit(""); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                           <Plus size={16} /> Crear Empresa
                        </button>
                    </div>

                    {showForm && (
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                            <h3 className="text-lg font-bold text-white mb-4">{id ? 'Editar' : 'Nueva'} Empresa</h3>
                            <form onSubmit={handleSaveEmpresa} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-xs text-zinc-500 block mb-1">Razón Social / Nombre</label>
                                    <input required value={nombre} onChange={e=>setNombre(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-white outline-none" />
                                </div>
                                <div className="">
                                    <label className="text-xs text-zinc-500 block mb-1">CUIT (Opcional)</label>
                                    <input value={cuit} onChange={e=>setCuit(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-white outline-none" />
                                </div>
                                <div className="flex items-end">
                                    <button disabled={loading} type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded-xl h-[42px] hover:bg-emerald-500">
                                        {loading ? '...' : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {loading && !showForm ? <div className="p-12 text-center"><Loader2 className="animate-spin inline-block text-blue-500" /></div> : (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-zinc-900 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
                                    <tr>
                                        <th className="px-6 py-4">Empresa</th>
                                        <th className="px-6 py-4">Saldo</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {empresas.map(em => (
                                        <tr key={em.id} className="hover:bg-zinc-800/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-white">{em.nombre_empresa}</p>
                                                <p className="text-zinc-500 text-xs">CUIT: {em.cuit || 'S/D'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className={`font-mono font-bold ${em.saldo > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                    ${parseFloat(em.saldo || 0).toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {em.activo ? <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded text-xs">Activa</span> : <span className="text-rose-400 bg-rose-500/10 px-2 py-1 rounded text-xs">Inactiva</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center space-x-2">
                                                 <button onClick={() => setVerDetalle(em)} className="bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-700">Gestionar Plantilla</button>
                                                 <button onClick={() => editEmpresa(em)} className="bg-zinc-800 p-1.5 rounded-lg text-zinc-400 hover:text-white"><Edit size={14}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : (
                <EmpresaDetalle empresa={verDetalle} goBack={() => setVerDetalle(null)} fetchList={fetchEmpresas} />
            )}
        </div>
    );
}

function EmpresaDetalle({ empresa, goBack, fetchList }: any) {
    const [activeTab, setActiveTab] = useState('usuarios');
    const [usuarios, setUsuarios] = useState<any[]>([]);
    
    // Buscador
    const [todosUsuarios, setTodosUsuarios] = useState<any[]>([]);
    const [searchQ, setSearchQ] = useState("");
    
    // Beneficios Form
    const benefit = empresa.empresa_beneficios ? empresa.empresa_beneficios[0] : null;
    const [tipoDesc, setTipoDesc] = useState(benefit?.tipo_descuento || "PORCENTAJE");
    const [valorDesc, setValorDesc] = useState(benefit?.valor || 0);

    useEffect(() => {
        fetchUsuariosAsignados();
        fetchTodosLosUsuarios();
    }, []);

    const fetchUsuariosAsignados = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas/${empresa.id}/usuarios`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if (resp.ok) setUsuarios(await resp.json());
        } catch(e){}
    };
    
    const fetchTodosLosUsuarios = async () => {
         try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/clientes`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if (resp.ok) setTodosUsuarios(await resp.json());
        } catch(e){}
    };
    
    const addUsuario = async (userId: string) => {
        try {
             await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas/${empresa.id}/usuarios`, {
                method: "POST",
                headers: { "Content-Type":"application/json", "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` },
                body: JSON.stringify({ user_id: userId, limite_mensual: 0 })
             });
             fetchUsuariosAsignados();
        } catch(e){ alert("Error al vincular") }
    };
    
    const removeUsuario = async (userId: string) => {
         try {
             await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas/${empresa.id}/usuarios/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
             });
             fetchUsuariosAsignados();
        } catch(e){ alert("Error al remover") }
    };

    const saveBeneficio = async (e: any) => {
        e.preventDefault();
        try {
             const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas/${empresa.id}/beneficios`, {
                method: "POST",
                headers: { "Content-Type":"application/json", "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` },
                body: JSON.stringify({ tipo_descuento: tipoDesc, valor: valorDesc, activo: true })
             });
             if(resp.ok) {
                 alert("Condiciones actualizadas");
                 fetchList(); // Para actualizar los datos padre
             }
        } catch(e){ alert("Error") }
    };

    // Filter missing users
    const assignedIds = usuarios.map(u => u.user_id);
    const availableUsers = todosUsuarios.filter(u => (!assignedIds.includes(u.id)) && ((u.nombre || '').toLowerCase().includes(searchQ.toLowerCase()) || (u.email || '').toLowerCase().includes(searchQ.toLowerCase())));

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            <button onClick={goBack} className="text-zinc-500 mb-4 hover:text-white text-sm flex items-center gap-2">← Volver al listado</button>
            <div className="mb-6">
                <h2 className="text-3xl font-black text-white">{empresa.nombre_empresa}</h2>
                <p className="text-zinc-400 text-sm mt-1">Gestión de plantilla corporativa y configuración de tarifas</p>
            </div>
            
            <div className="flex gap-4 mb-6 border-b border-zinc-800 pb-2">
                <button onClick={() => setActiveTab('usuarios')} className={`pb-2 font-bold px-2 border-b-2 flex items-center gap-2 ${activeTab==='usuarios' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500'}`}><Users size={16}/> Empleados Asignados</button>
                <button onClick={() => setActiveTab('beneficios')} className={`pb-2 font-bold px-2 border-b-2 flex items-center gap-2 ${activeTab==='beneficios' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500'}`}><Percent size={16}/> Descuentos Autorizados</button>
                <button onClick={() => setActiveTab('cuenta')} className={`pb-2 font-bold px-2 border-b-2 flex items-center gap-2 ${activeTab==='cuenta' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500'}`}><CreditCard size={16}/> Cuenta Corriente</button>
            </div>
            
            {activeTab === 'cuenta' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                            <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Saldo Deudor Actual</p>
                            <h3 className={`text-3xl font-black ${empresa.saldo > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                ${parseFloat(empresa.saldo || 0).toLocaleString()}
                            </h3>
                            <p className="text-zinc-400 text-[10px] mt-2 italic">Saldo positivo indica deuda pendiente de la empresa.</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl md:col-span-2">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2"><DollarSign size={18} className="text-emerald-500"/> Registrar Pago Manual</h4>
                            <form onSubmit={async (e: any) => {
                                e.preventDefault();
                                const amount = e.target.monto.value;
                                const method = e.target.metodo.value;
                                const obs = e.target.obs.value;
                                if (!amount || amount <= 0) return;
                                try {
                                    const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas/${empresa.id}/pagos`, {
                                        method: "POST",
                                        headers: { "Content-Type":"application/json", "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` },
                                        body: JSON.stringify({ monto: parseFloat(amount), metodo_pago: method, observaciones: obs })
                                    });
                                    if(resp.ok) {
                                        alert("Pago registrado con éxito");
                                        e.target.reset();
                                        fetchList();
                                        goBack(); // Para recargar los datos
                                    }
                                } catch(e){ alert("Error") }
                            }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase block mb-1">Monto ($)</label>
                                    <input name="monto" type="number" step="0.01" required className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-white outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase block mb-1">Método</label>
                                    <select name="metodo" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-white outline-none">
                                        <option value="Transferencia">Transferencia</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition-colors">Abonar</button>
                                </div>
                                <div className="md:col-span-3">
                                    <input name="obs" placeholder="Observaciones / Referencia" className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-white outline-none text-sm" />
                                </div>
                            </form>
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                            <h4 className="text-white font-bold flex items-center gap-2"><History size={18} className="text-blue-500"/> Extracto de Cuenta</h4>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            <MovimientosList empresaId={empresa.id} />
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'usuarios' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-bold text-white mb-4">Plantilla Actual ({usuarios.length})</h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {usuarios.length === 0 && <p className="text-zinc-500 text-sm">No hay empleados vinculados.</p>}
                            {usuarios.map(u => (
                                <div key={u.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex justify-between items-center">
                                    <div>
                                        <p className="text-white text-sm font-bold">{u.usuarios?.nombre}</p>
                                        <p className="text-zinc-500 text-[10px]">{u.usuarios?.email}</p>
                                    </div>
                                    <button onClick={() => removeUsuario(u.user_id)} className="text-rose-500 hover:bg-rose-500/20 p-2 rounded-lg">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="border-l border-zinc-800 pl-8">
                        <h3 className="font-bold text-white mb-4">Añadir al Grupo</h3>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 text-zinc-500" size={16} />
                            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar cliente..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none" />
                        </div>
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-2">
                            {availableUsers.slice(0, 15).map(u => (
                                <div key={u.id} className="bg-black/30 border border-white/5 p-3 rounded-xl flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                                    <div>
                                        <p className="text-white text-sm">{u.nombre}</p>
                                        <p className="text-zinc-500 text-[10px]">{u.email}</p>
                                    </div>
                                    <button onClick={() => addUsuario(u.id)} className="text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 rounded text-xs font-bold">Añadir</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'beneficios' && (
                <form onSubmit={saveBeneficio} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-xl">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs text-zinc-500 block mb-1">Cálculo de Descuento</label>
                            <select value={tipoDesc} onChange={e=>setTipoDesc(e.target.value)} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-white outline-none">
                                <option value="PORCENTAJE">Porcentaje (%)</option>
                                <option value="FIJO">Monto Fijo ($)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 block mb-1">Valor de Bonificación</label>
                            <input type="number" required value={valorDesc} onChange={e=>setValorDesc(Number(e.target.value))} className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2 text-white outline-none" />
                        </div>
                    </div>
                    <button type="submit" className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold">Actualizar Condiciones</button>
                    
                    <div className="mt-6 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-200">
                        Los usuarios vinculados a <b>{empresa.nombre_empresa}</b> verán este descuento aplicado automáticamente al cotizar sus viajes en su perfil, mientras no sobrepasen límites de horarios/saldo.
                    </div>
                </form>
            )}
        </div>
    );
}

function MovimientosList({ empresaId }: { empresaId: string }) {
    const [movs, setMovs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchMovs();
    }, [empresaId]);

    const fetchMovs = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/admin/empresas/${empresaId}/movimientos`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem('sb-access-token')}` }
            });
            if (resp.ok) setMovs(await resp.json());
        } catch(e){}
        finally { setLoading(false); }
    };

    if (loading) return <div className="p-12 text-center text-zinc-500 text-xs">Cargando movimientos...</div>;
    if (movs.length === 0) return <div className="p-12 text-center text-zinc-500 text-sm">No hay movimientos registrados.</div>;

    return (
        <table className="w-full text-left text-xs">
            <thead className="bg-black/20 text-zinc-500 font-bold uppercase text-[9px] tracking-wider border-b border-zinc-800">
                <tr>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">Descripción</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
                {movs.map((m: any) => (
                    <tr key={m.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">
                            {new Date(m.creado_en).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[8px] uppercase ${m.tipo === 'CREDITO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                {m.tipo}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                            {m.descripcion}
                            {m.metodo_pago && <span className="block text-[9px] text-zinc-500 mt-0.5 italic">Vía {m.metodo_pago}</span>}
                        </td>
                        <td className={`px-6 py-4 text-right font-mono font-bold ${m.tipo === 'CREDITO' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {m.tipo === 'CREDITO' ? '-' : '+'}${parseFloat(m.monto).toLocaleString()}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
