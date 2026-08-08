import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import { Loader2, Search, Download, FileText, FileSpreadsheet, Building, Store, Gift, Car, Users as UsersIcon, CheckCircle2, AlertTriangle, Shield, ChevronLeft, ChevronRight, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function PadronGeneralAdmin() {
  const { orgId } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("TODOS");
  const [status, setStatus] = useState("TODOS");
  
  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Modals
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [orgId, page, category, status, searchTerm]); // Debounce search in a real app, here it triggers fetch

  const fetchUsers = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Registrar auditoría por consulta
      await supabase.from("security_audit_log").insert({
        action: "CONSULTA_PADRON_GENERAL",
        details: { category, status, searchTerm, page }
      });

      let query = supabase.from("usuarios")
        .select(`
          *,
          choferes!usuario_id ( id, vehiculo, patente, estado ),
          comercios!user_id ( id, nombre, categoria, estado, activo, creado_en ),
          empresas!usuario_id ( id, nombre_empresa, cuit, activo, creado_en ),
          vehicles!titular_id ( id, marca, modelo, patente, estado, driver_id )
        `, { count: "exact" })
        .eq("organizacion_id", orgId);

      // Filtering Category
      if (category !== "TODOS") {
        query = query.eq("rol", category.toLowerCase());
      }
      
      // Filtering Status
      if (status !== "TODOS") {
        if (status === "ACTIVO") query = query.eq("activo", true);
        if (status === "INACTIVO") query = query.eq("activo", false);
        // Note: For choferes pending/suspended, it might rely on specific tables. Simple boolean for now.
      }

      // Search
      if (searchTerm.trim() !== "") {
        const isNumeric = /^\d+$/.test(searchTerm.trim());
        if (isNumeric) {
          // Exact match for DNI or phone
          query = query.or(`dni.eq.${searchTerm.trim()},telefono.ilike.%${searchTerm.trim()}%`);
        } else {
          query = query.or(`nombre.ilike.%${searchTerm.trim()}%,apellido.ilike.%${searchTerm.trim()}%,email.ilike.%${searchTerm.trim()}%`);
        }
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order("creado_en", { ascending: false });

      const { data, count, error } = await query;
      if (error) throw error;
      
      // If we have clients, optionally fetch their trips count (for simplicity, we skip full join for trips to keep it fast, or do a separate fetch here)
      const clients = data.filter(u => u.rol === 'cliente');
      if (clients.length > 0) {
        const { data: viajesData } = await supabase.from("viajes").select("cliente_id").in("cliente_id", clients.map(c => c.id));
        
        const counts = viajesData?.reduce((acc: any, v: any) => {
          acc[v.cliente_id] = (acc[v.cliente_id] || 0) + 1;
          return acc;
        }, {});

        data.forEach(u => {
          if (u.rol === 'cliente') {
            u.viajes_count = counts?.[u.id] || 0;
          }
        });
      }

      setUsers(data || []);
      if (count !== null) setTotalCount(count);
    } catch (err) {
      console.error("Error fetching padrón:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (rol: string) => {
    switch(rol?.toLowerCase()) {
      case 'admin':
      case 'superadmin': return <span className="flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-bold uppercase"><Shield size={12}/> {rol}</span>;
      case 'chofer': return <span className="flex items-center gap-1 bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-xs font-bold uppercase"><Car size={12}/> Chofer</span>;
      case 'titular': return <span className="flex items-center gap-1 bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded text-xs font-bold uppercase"><UsersIcon size={12}/> Titular</span>;
      case 'comercio': return <span className="flex items-center gap-1 bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-xs font-bold uppercase"><Store size={12}/> Comercio</span>;
      case 'empresa': return <span className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded text-xs font-bold uppercase"><Building size={12}/> Empresa</span>;
      default: return <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold uppercase"><Gift size={12}/> Pasajero</span>;
    }
  };

  // EXPORT FUNCTIONS
  const handleExport = async (format: "pdf" | "excel", mode: "all" | "filtered" | "category") => {
    setExporting(true);
    setShowExportModal(false);
    try {
      await supabase.from("security_audit_log").insert({
        action: format === 'pdf' ? "EXPORT_PADRON_PDF" : "EXPORT_PADRON_EXCEL",
        details: { format, mode, filters: { category, status, searchTerm } }
      });

      let query = supabase.from("usuarios").select("nombre, apellido, dni, email, telefono, rol, activo, creado_en").eq("organizacion_id", orgId);
      
      if (mode === "filtered" || mode === "category") {
         if (category !== "TODOS") query = query.eq("rol", category.toLowerCase());
         if (status === "ACTIVO") query = query.eq("activo", true);
         if (status === "INACTIVO") query = query.eq("activo", false);
         if (searchTerm.trim() !== "") {
           if (/^\d+$/.test(searchTerm.trim())) query = query.or(`dni.eq.${searchTerm.trim()},telefono.ilike.%${searchTerm.trim()}%`);
           else query = query.or(`nombre.ilike.%${searchTerm.trim()}%,apellido.ilike.%${searchTerm.trim()}%,email.ilike.%${searchTerm.trim()}%`);
         }
      }
      
      const { data, error } = await query.order("creado_en", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return alert("No hay datos para exportar.");

      const exportData = data.map(d => ({
        Nombre: d.nombre || "",
        Apellido: d.apellido || "",
        DNI: d.dni || "",
        Teléfono: d.telefono || "",
        Email: d.email || "",
        Categoría: d.rol?.toUpperCase() || "CLIENTE",
        Estado: d.activo ? "Activo" : "Inactivo",
        Alta: new Date(d.creado_en).toLocaleDateString()
      }));

      if (format === "pdf") {
        const doc = new jsPDF('landscape');
        
        doc.setFontSize(18);
        doc.text("Padrón General de Usuarios - Traslados UBI", 14, 22);
        
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Total registros: ${data.length}`, 14, 35);
        doc.text(`Generado por: Administrador`, 14, 40);

        autoTable(doc, {
          startY: 45,
          head: [['Nombre', 'Apellido', 'DNI', 'Teléfono', 'Email', 'Categoría', 'Estado', 'Fecha Alta']],
          body: exportData.map(Object.values),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [13, 110, 253] }
        });
        
        doc.save("Padron_General_UBI.pdf");
      } else {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Padrón");
        XLSX.writeFile(workbook, "Padron_General_UBI.xlsx");
      }
    } catch (err) {
      console.error("Error exportando:", err);
      alert("Error al exportar los datos.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col w-full gap-6">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-zinc-900/50 p-4 md:p-6 rounded-2xl border border-zinc-800">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar DNI exacto, nombre, email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/50 border border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-600 font-medium"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select 
            value={category} 
            onChange={e => setCategory(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500 cursor-pointer appearance-none"
          >
            <option value="TODOS">Todas las Categorías</option>
            <option value="CLIENTE">Clientes / Pasajeros</option>
            <option value="CHOFER">Choferes</option>
            <option value="TITULAR">Titulares</option>
            <option value="COMERCIO">Comercios Adheridos</option>
            <option value="EMPRESA">Empresas</option>
            <option value="ADMIN">Administradores</option>
          </select>
          
          <select 
            value={status} 
            onChange={e => setStatus(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500 cursor-pointer appearance-none"
          >
            <option value="TODOS">Cualquier Estado</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos / Pendientes</option>
          </select>
          
          <button 
            onClick={() => setShowExportModal(true)}
            disabled={exporting}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all ml-auto md:ml-2 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-2xl bg-zinc-900/50 border border-zinc-800 shadow-xl">
        <table className="w-full text-left text-sm" style={{ minWidth: '800px' }}>
          <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4">Usuario</th>
              <th className="px-6 py-4">Contacto</th>
              <th className="px-6 py-4">Rol & Info Adicional</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4">Alta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                  <Loader2 size={32} className="animate-spin mx-auto mb-4 text-blue-500" />
                  Cargando padrón de usuarios...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                  No se encontraron usuarios con los filtros actuales.
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-white font-bold text-base leading-tight">
                      {u.nombre} {u.apellido}
                    </p>
                    {u.dni && (
                      <p className="text-zinc-500 text-[10px] font-mono mt-1 flex items-center gap-1">
                        DNI: <span className="bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">{u.dni}</span>
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-zinc-300 font-medium truncate max-w-[200px]" title={u.email}>{u.email}</p>
                    <p className="text-zinc-500 text-xs font-mono mt-0.5">{u.telefono || 'Sin teléfono'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2 items-start">
                      {getRoleBadge(u.rol)}
                      
                      {/* Chofer Extra Info */}
                      {u.choferes && u.choferes.length > 0 && (
                        <div className="text-[10px] text-zinc-500 border-l-2 border-zinc-700 pl-2">
                          <p>Vehículo: <span className="text-zinc-300">{u.choferes[0].vehiculo}</span></p>
                          <p>Patente: <span className="text-zinc-300 font-mono uppercase">{u.choferes[0].patente}</span></p>
                        </div>
                      )}
                      
                      {/* Titular Extra Info */}
                      {u.vehicles && u.vehicles.length > 0 && (
                        <div className="text-[10px] text-zinc-500 border-l-2 border-zinc-700 pl-2">
                          <p>Vehículos: <span className="text-blue-400 font-bold">{u.vehicles.length}</span></p>
                          <p>Choferes Asoc.: <span className="text-blue-400 font-bold">{u.vehicles.filter((v:any) => v.driver_id).length}</span></p>
                        </div>
                      )}

                      {/* Cliente Extra Info */}
                      {u.rol === 'cliente' && (
                        <div className="text-[10px] text-zinc-500 border-l-2 border-zinc-700 pl-2">
                          <p>Viajes totales: <span className="text-zinc-300 font-bold">{u.viajes_count || 0}</span></p>
                        </div>
                      )}

                      {/* Comercio Extra Info */}
                      {u.comercios && u.comercios.length > 0 && (
                        <div className="text-[10px] text-zinc-500 border-l-2 border-zinc-700 pl-2">
                          <p>Comercio: <span className="text-zinc-300 font-bold">{u.comercios[0].nombre || u.comercios[0].nombre_comercio}</span></p>
                          <p>Rubro: <span className="text-zinc-400">{u.comercios[0].rubro || u.comercios[0].categoria}</span></p>
                        </div>
                      )}
                      
                      {/* Empresa Extra Info */}
                      {u.empresas && u.empresas.length > 0 && (
                        <div className="text-[10px] text-zinc-500 border-l-2 border-zinc-700 pl-2">
                          <p>Empresa: <span className="text-zinc-300 font-bold">{u.empresas[0].nombre_empresa || u.empresas[0].nombre}</span></p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.activo !== false ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 size={14} /> Activo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-zinc-500 text-xs font-bold">
                        <AlertTriangle size={14} /> Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-500 text-xs">
                    {new Date(u.creado_en).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* PAGINATION */}
        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-black/20">
            <p className="text-xs text-zinc-500 font-medium">
              Mostrando <span className="text-zinc-300">{page * pageSize + 1}</span> a <span className="text-zinc-300">{Math.min((page + 1) * pageSize, totalCount)}</span> de <span className="text-zinc-300">{totalCount}</span> usuarios
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg bg-zinc-800 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= totalCount}
                className="p-2 rounded-lg bg-zinc-800 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setShowExportModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-black text-white mb-2">Exportar Padrón</h3>
            <p className="text-zinc-400 text-sm mb-6">Selecciona el formato y los datos a incluir en el reporte.</p>
            
            <div className="space-y-3 mb-6">
              <button onClick={() => handleExport('pdf', 'filtered')} className="w-full flex items-center gap-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 p-4 rounded-xl border border-red-500/30 transition-colors font-bold text-sm">
                <FileText size={20} /> PDF (Resultados filtrados)
              </button>
              <button onClick={() => handleExport('excel', 'filtered')} className="w-full flex items-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 p-4 rounded-xl border border-emerald-500/30 transition-colors font-bold text-sm">
                <FileSpreadsheet size={20} /> Excel (Resultados filtrados)
              </button>
              <div className="border-t border-zinc-800 my-4 pt-4">
                <button onClick={() => handleExport('pdf', 'all')} className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 p-4 rounded-xl border border-zinc-800 transition-colors font-bold text-sm mb-3">
                  <FileText size={20} className="text-red-400" /> Exportar TODO a PDF
                </button>
                <button onClick={() => handleExport('excel', 'all')} className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 p-4 rounded-xl border border-zinc-800 transition-colors font-bold text-sm">
                  <FileSpreadsheet size={20} className="text-emerald-400" /> Exportar TODO a Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
