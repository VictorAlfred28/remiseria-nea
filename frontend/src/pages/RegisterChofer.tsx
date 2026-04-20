import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, Mail, Loader2, ArrowLeft, User, Phone, CheckCircle2, ChevronRight, UploadCloud, MapPin, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../services/api'; // Or use fetch depending on how the app does it, we'll use fetch as seen in Register.tsx

export default function RegisterChofer() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Paso 1: Datos
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [password, setPassword] = useState('');

  // Paso 2: Licencia
  const [licenciaNumero, setLicenciaNumero] = useState('');
  const [licenciaCategoria, setLicenciaCategoria] = useState('D1'); // default pasajero
  const [licenciaVencimiento, setLicenciaVencimiento] = useState('');

  // Paso 3: Documentación
  const [frenteFile, setFrenteFile] = useState<File | null>(null);
  const [dorsoFile, setDorsoFile] = useState<File | null>(null);
  const [antecedentesFile, setAntecedentesFile] = useState<File | null>(null);

  // Paso 4: Vehículo
  const [tieneVehiculo, setTieneVehiculo] = useState(true);
  const [vehiculoMarcaModelo, setVehiculoMarcaModelo] = useState('');
  const [patente, setPatente] = useState('');

  const nextStep = () => {
    setErrorMsg('');
    if (step === 1 && (!nombre || !email || !telefono || !direccion || !password)) {
      setErrorMsg('Por favor completa todos los datos personales.');
      return;
    }
    if (step === 2 && (!licenciaNumero || !licenciaCategoria || !licenciaVencimiento)) {
      setErrorMsg('Completa la información de tu licencia.');
      return;
    }
    if (step === 3 && (!frenteFile || !dorsoFile || !antecedentesFile)) {
      setErrorMsg('Debes subir todos los documentos requeridos (Frente, Dorso, y Antecedentes).');
      return;
    }
    setStep(s => s + 1);
  };

  const prevStep = () => {
    setErrorMsg('');
    setStep(s => s - 1);
  };

  const uploadFile = async (file: File, folderId: string, prefix: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folderId}/${prefix}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    // Assuming 'documentos_choferes' is set to public or authenticated
    const { data, error } = await supabase.storage.from('documentos_choferes').upload(fileName, file);
    if (error) throw new Error(`Error subiendo ${prefix}: ${error.message}`);
    
    // get public url
    const { data: { publicUrl } } = supabase.storage.from('documentos_choferes').getPublicUrl(fileName);
    return { title: prefix, url: publicUrl, fileName: fileName };
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tieneVehiculo && (!vehiculoMarcaModelo || !patente)) {
      setErrorMsg('Si tienes vehículo, ingresa la marca, modelo y patente.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Obtener org default (al igual que pasajero)
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
      if (!authData.user) throw new Error("No se pudo crear el usuario.");

      const userId = authData.user.id;

      // 3. Subir Imágenes
      let uploadedDocs = [];
      try {
        if (frenteFile) uploadedDocs.push(await uploadFile(frenteFile, userId, 'licencia_frente'));
        if (dorsoFile) uploadedDocs.push(await uploadFile(dorsoFile, userId, 'licencia_dorso'));
        if (antecedentesFile) uploadedDocs.push(await uploadFile(antecedentesFile, userId, 'antecedentes'));
      } catch (uploadErr: any) {
        throw new Error(uploadErr.message || "Error al subir archivos.");
      }

      // 4. Mudar al backend para que registre en public.usuarios y public.choferes
      const vehiculoFinal = tieneVehiculo ? vehiculoMarcaModelo : "Busca vehículo";
      const patenteFinal = tieneVehiculo ? patente.toUpperCase() : "N/A";

      const profileResp = await fetch(`${apiBase}/public/registro/chofer`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              id: userId,
              organizacion_id: organizacionId,
              email: email,
              nombre: nombre,
              telefono: telefono,
              direccion: direccion,
              vehiculo: vehiculoFinal,
              patente: patenteFinal,
              licencia_numero: licenciaNumero,
              licencia_categoria: licenciaCategoria,
              licencia_vencimiento: licenciaVencimiento,
              documentos: uploadedDocs,
              tiene_vehiculo: tieneVehiculo
          })
      });

      if (!profileResp.ok) {
        const detail = await profileResp.json();
        throw new Error("Error en registro de datos: " + (detail.detail || profileResp.statusText));
      }

      setSuccess(true);
      // Cerramos sesión por las dudas porque si Auth la dejó abierta, el authState lo bloquearía
      await supabase.auth.signOut();

    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col items-center text-center">
             <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                 <CheckCircle2 size={40} className="text-green-500" />
             </div>
             <h2 className="text-2xl font-black text-white mb-2">Solicitud Enviada</h2>
             <p className="text-zinc-400 mb-8">Tu registro como chofer ha sido enviado exitosamente. Un administrador revisará tu perfil y documentación. Te notificaremos cuando tu cuenta sea aprobada.</p>
             <button onClick={() => navigate('/login')} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-500 transition-colors">
               Volver a Inicio de Sesión
             </button>
        </div>
      </div>
    );
  }

  const FileUploader = ({ label, file, setFile }: { label: string, file: File | null, setFile: (f: File | null) => void }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    return (
      <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
         <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600/20 text-blue-500 rounded-lg flex items-center justify-center shrink-0">
                <UploadCloud size={18} />
             </div>
             <div>
                <p className="text-sm text-zinc-300 font-medium">{label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{file ? file.name : 'Ningún archivo .jpg o .png'}</p>
             </div>
         </div>
         <input type="file" ref={fileRef} className="hidden" accept="image/*,.pdf" onChange={(e) => { if(e.target.files && e.target.files[0]) setFile(e.target.files[0]) }} />
         {file ? (
            <button type="button" onClick={() => setFile(null)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors"><X size={16}/></button>
         ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-zinc-800 text-white text-xs font-medium rounded-lg hover:bg-zinc-700 transition">Seleccionar</button>
         )}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      
      {/* Background blurs */}
      <div className="absolute top-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-600/20 blur-[120px] rounded-full"></div>
          <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-purple-600/20 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative w-full max-w-lg bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-6 md:p-8 rounded-3xl shadow-2xl">
        
        {/* Header Steps */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/login')} className="p-2 text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"><ArrowLeft size={18}/></button>
                <div>
                   <h1 className="text-xl font-black tracking-tight text-white">Alta Chofer</h1>
                   <p className="text-xs text-zinc-400">Paso {step} de 4</p>
                </div>
            </div>
            <div className="flex items-center gap-1">
                {[1,2,3,4].map(num => (
                   <div key={num} className={`w-3 h-3 rounded-full transition-colors ${step >= num ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                ))}
            </div>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 text-sm px-4 py-3 rounded-xl animate-in fade-in">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in">
               <h2 className="text-lg font-bold text-white mb-2">1. Datos Personales</h2>
               
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                   <User size={18} className="text-zinc-500" />
                 </div>
                 <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-white outline-none"
                   placeholder="Nombre Completo" />
               </div>

               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                   <Phone size={18} className="text-zinc-500" />
                 </div>
                 <input type="text" required value={telefono} onChange={e => setTelefono(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-white outline-none"
                   placeholder="Teléfono (Ej: 3794123456)" />
               </div>

               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                   <MapPin size={18} className="text-zinc-500" />
                 </div>
                 <input type="text" required value={direccion} onChange={e => setDireccion(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-white outline-none"
                   placeholder="Dirección Física" />
               </div>

               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                   <Mail size={18} className="text-zinc-500" />
                 </div>
                 <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-white outline-none"
                   placeholder="Correo Electrónico" />
               </div>

               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                   <Lock size={18} className="text-zinc-500" />
                 </div>
                 <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                   className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-white outline-none"
                   placeholder="Crea una contraseña" />
               </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in">
               <h2 className="text-lg font-bold text-white mb-2">2. Carnet de Conducir</h2>
               
               <div>
                  <label className="text-xs text-zinc-500 ml-1 block mb-1">Número de Licencia</label>
                  <input type="text" required value={licenciaNumero} onChange={e => setLicenciaNumero(e.target.value)}
                   className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-white outline-none"
                   placeholder="Ej: 30123456" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div>
                       <label className="text-xs text-zinc-500 ml-1 block mb-1">Categoría</label>
                       <select value={licenciaCategoria} onChange={e => setLicenciaCategoria(e.target.value)} className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl text-white outline-none focus:ring-1 focus:ring-blue-500">
                           <option value="D1">D1 (Profesional)</option>
                           <option value="D2">D2 (Profesional Pasajeros)</option>
                           <option value="B1">B1 (Particular)</option>
                           <option value="Otra">Otra</option>
                       </select>
                   </div>
                   <div>
                       <label className="text-xs text-zinc-500 ml-1 block mb-1">Vencimiento</label>
                       <input type="date" required value={licenciaVencimiento} onChange={e => setLicenciaVencimiento(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-blue-500 transition-all text-white outline-none" />
                   </div>
               </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in">
               <h2 className="text-lg font-bold text-white mb-2">3. Subida de Documentos</h2>
               <p className="text-xs text-zinc-400 mb-4">Asegúrate de que las fotos sean claras y legibles.</p>
               
               <FileUploader label="Licencia de Conducir (Frente)" file={frenteFile} setFile={setFrenteFile} />
               <FileUploader label="Licencia de Conducir (Dorso)" file={dorsoFile} setFile={setDorsoFile} />
               <FileUploader label="Certificado Antecedentes Penales" file={antecedentesFile} setFile={setAntecedentesFile} />
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in">
               <h2 className="text-lg font-bold text-white mb-2">4. Vehículo</h2>
               
               <div className="bg-zinc-950/50 border border-zinc-800 p-5 rounded-xl">
                    <label className="flex items-center gap-3 cursor-pointer mb-2">
                         <input type="checkbox" checked={tieneVehiculo} onChange={e => setTieneVehiculo(e.target.checked)} className="w-5 h-5 accent-blue-500 rounded cursor-pointer" />
                         <span className="text-white font-medium">Tengo vehículo propio</span>
                    </label>
                    <p className="text-xs text-zinc-500 ml-8 mb-4">Si no tienes vehículo, te conectaremos con titulares buscando chofer.</p>

                    {tieneVehiculo && (
                       <div className="ml-8 space-y-4 border-l-2 border-zinc-800 pl-4 animate-in fade-in">
                           <div>
                              <label className="text-xs text-zinc-500 block mb-1">Marca y Modelo</label>
                              <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <Car size={16} className="text-zinc-500" />
                                  </div>
                                  <input type="text" value={vehiculoMarcaModelo} onChange={e => setVehiculoMarcaModelo(e.target.value)} className="w-full pl-10 pr-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm outline-none focus:border-blue-500" placeholder="Ej: Chevrolet Onix 2019" />
                              </div>
                           </div>
                           <div>
                              <label className="text-xs text-zinc-500 block mb-1">Patente / Dominio</label>
                              <input type="text" value={patente} onChange={e => setPatente(e.target.value)} className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm outline-none uppercase focus:border-blue-500" placeholder="AB 123 CD" />
                           </div>
                       </div>
                    )}
               </div>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-800/80 flex gap-3">
             {step > 1 && (
                <button type="button" onClick={prevStep} disabled={loading} className="px-6 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
                    Atrás
                </button>
             )}
             
             {step < 4 ? (
                <button type="button" onClick={nextStep} className="flex-1 px-6 py-3.5 bg-white text-black font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:bg-zinc-200 transition-all flex items-center justify-center gap-2">
                    Siguiente <ChevronRight size={18} />
                </button>
             ) : (
                <button type="submit" disabled={loading} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : "Enviar Solicitud"}
                </button>
             )}
          </div>

        </form>
      </div>
    </div>
  );
}
