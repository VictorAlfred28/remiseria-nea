import { useState } from 'react';
import { X, MapPin, DollarSign, Phone, Loader2, Navigation } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/useAuthStore';

interface CargaManualModalProps {
  onClose: () => void;
}

export default function CargaManualModal({ onClose }: CargaManualModalProps) {
  const { token } = useAuthStore();
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('Cliente Agencia');
  const [origenDir, setOrigenDir] = useState('');
  const [destinoDir, setDestinoDir] = useState('');
  const [precio, setPrecio] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Mock lat/lng since we don't have a map picker here yet. 
  // In a real scenario, this would use Google Maps Autocomplete or Leaflet Picker.
  const MOCK_LAT = -27.4692;
  const MOCK_LNG = -58.8302;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        telefono,
        nombre,
        origen_direccion: origenDir,
        origen_lat: MOCK_LAT,
        origen_lng: MOCK_LNG,
        destino_direccion: destinoDir,
        destino_lat: MOCK_LAT - 0.01,
        destino_lng: MOCK_LNG - 0.01,
        precio_fijado: Number(precio),
        tipo_viaje: "PERSONAL"
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/viajes/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Error al despachar el viaje.");
      }

      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl text-white font-black flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Despacho Manual
            </h2>
            <p className="text-blue-100/80 text-xs mt-1">Ingresa un viaje telefónico al sistema de asignación.</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white bg-black/20 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500">
                <Navigation className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl text-white font-black mb-1">¡Viaje Despachado!</h3>
              <p className="text-zinc-400 text-sm">El sistema ya está buscando un móvil disponible.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Teléfono (WhatsApp)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4" />
                    <input required value={telefono} onChange={e=>setTelefono(e.target.value)} placeholder="Ej: 3794123456" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Nombre Referencia</label>
                  <input required value={nombre} onChange={e=>setNombre(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Origen</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                  <input required value={origenDir} onChange={e=>setOrigenDir(e.target.value)} placeholder="¿Dónde busca el móvil al pasajero?" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Destino</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 w-4 h-4" />
                  <input required value={destinoDir} onChange={e=>setDestinoDir(e.target.value)} placeholder="¿Hacia dónde va?" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Precio Pactado ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 w-4 h-4" />
                  <input required type="number" min="0" value={precio} onChange={e=>setPrecio(e.target.value)} placeholder="0.00" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="flex-[1] bg-zinc-800 text-zinc-400 py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : "Despachar Móvil"}
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
