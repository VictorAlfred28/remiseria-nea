import { useEffect } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, HashRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import AdminDashboard from "./pages/AdminDashboard";
import ChoferDashboard from "./pages/ChoferDashboard";
import ClienteDashboard from "./pages/ClienteDashboard";
import ComercioDashboard from "./pages/ComercioDashboard";
import PromocionDetalle from "./pages/PromocionDetalle";
import TariffPrintView from './pages/TariffPrintView';
import TestSimulator from './pages/TestSimulator';
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterChofer from "./pages/RegisterChofer";
import ResetPassword from "./pages/ResetPassword";
import LiveTracker from "./pages/LiveTracker";
import { useAuthStore } from "./store/useAuthStore";
import { LogOut, Sun, Moon } from "lucide-react";

// Selección dinámica del Router: HashRouter es obligatorio en Android/iOS para evitar pantalla negra por rutas file:// o custom schemes
const AppRouter = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

// Inyectar clase inicial al cargar la app sin esperar al componente react
if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light-theme');
}
// Componente para proteger rutas según el rol
function ProtectedRoute({ children, allowedRoles }: { children: ReactNode, allowedRoles?: string[] }) {
  const { user, role, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Cargando Sistema...</div>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} />;
  
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'admin' || role === 'superadmin') return <Navigate to="/admin" />;
    return <Navigate to="/" />;
  }

  return children;
}

function App() {
  const { checkSession, user, role, roles, logout, isLightMode, toggleTheme, isLoading } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <AppRouter>
      <div className="min-h-screen overflow-y-auto bg-[#030712] text-white flex flex-col items-center font-sans selection:bg-blue-500/30 w-full flex-1 pb-[env(safe-area-inset-bottom,0px)]">
        
        {/* Barra de navegación superior solo si hay sesión */}
        {user && (
          <nav className="w-full glass-panel !border-l-0 !border-r-0 !border-t-0 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex justify-between items-center border-b border-[rgba(255,255,255,0.08)] sticky top-0 z-50 safe-pt">
            <div className="flex items-center gap-6">
              <span className="text-xl font-black text-white ml-2 tracking-tight">Viajes NEA</span>
              
              <div className="flex gap-4 border-l border-white/10 pl-6 ml-2 text-sm font-medium">
                {(role === 'admin' || role === 'superadmin') && (
                  <Link to="/admin" className="text-blue-400 hover:text-blue-300 transition-colors">Panel Admin</Link>
                )}
                {role === 'chofer' && (
                  <Link to="/chofer" className="text-green-400 hover:text-green-300 transition-colors">Panel Chofer</Link>
                )}
                {role === 'cliente' && (
                  <Link to="/cliente" className="text-purple-400 hover:text-purple-300 transition-colors">Panel Pasajero</Link>
                )}
                {role === 'titular' && (
                  <Link to="/cliente" className="text-orange-400 hover:text-orange-300 transition-colors">🚗 Mi Flota</Link>
                )}
                {role === 'comercio' && (
                  <Link to="/comercio" className="text-amber-400 hover:text-amber-300 transition-colors">Panel Comercio</Link>
                )}
                {/* Multi-rol: si tiene titular además de otro rol */}
                {role !== 'titular' && roles.includes('titular') && (
                  <Link to="/cliente" className="text-orange-400 hover:text-orange-300 transition-colors">🚗 Mi Flota</Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleTheme} 
                className="flex items-center justify-center w-9 h-9 text-zinc-400 hover:text-amber-400 transition-colors bg-white/5 hover:bg-white/10 rounded-full border border-white/5 no-invert"
                title="Cambiar Modo Día/Noche"
              >
                {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
              </button>

              <button onClick={logout} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-red-400 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          </nav>
        )}
        
        <main className="w-full max-w-7xl relative flex-1 pb-[env(safe-area-inset-bottom,0px)]">
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
            <Route path="/registro-conductor" element={user ? <Navigate to="/" /> : <RegisterChofer />} />
            <Route path="/reset-password" element={user ? <Navigate to="/" /> : <ResetPassword />} />
            
            <Route path="/track/:viajeId" element={<LiveTracker />} />
            <Route path="/test-simulator" element={<TestSimulator />} />
            
            <Route path="/" element={
              <div className="flex items-center justify-center p-10 h-[80vh]">
                {isLoading ? (
                  <div className="text-zinc-500 animate-pulse">Cargando perfil...</div>
                ) : user ? (
                  <Navigate to={(role === 'admin' || role === 'superadmin') ? "/admin" : (role === 'chofer' ? "/chofer" : (role === 'comercio' ? "/comercio" : "/cliente"))} />
                ) : (
                  <Navigate to="/login" />
                )}
              </div>
            } />

            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <div className="p-6"><AdminDashboard /></div>
              </ProtectedRoute>
            } />
            <Route path="/admin/:tab" element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <div className="p-6"><AdminDashboard /></div>
              </ProtectedRoute>
            } />

            <Route path="/admin/print-tariff" element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <TariffPrintView />
              </ProtectedRoute>
            } />

            <Route path="/chofer/*" element={
              <ProtectedRoute allowedRoles={['chofer']}>
                <div className="p-6"><ChoferDashboard /></div>
              </ProtectedRoute>
            } />

            <Route path="/cliente" element={
              <ProtectedRoute allowedRoles={['cliente', 'titular']}>
                <div className="p-4 md:p-6"><ClienteDashboard /></div>
              </ProtectedRoute>
            } />

            <Route path="/comercio" element={
              <ProtectedRoute allowedRoles={['comercio']}>
                <ComercioDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/promocion/:id" element={
              <ProtectedRoute>
                <div className="p-4 md:p-8"><PromocionDetalle /></div>
              </ProtectedRoute>
            } />
            
            {/* Opcional: una pantalla success si Mercado Pago re-dirige al volver */}
            <Route path="/cliente/payment-success" element={
               <ProtectedRoute allowedRoles={['cliente']}>
                  <div className="p-10 flex flex-col items-center justify-center text-center">
                     <h2 className="text-2xl text-green-400 font-bold mb-4">¡Pago procesado con éxito!</h2>
                     <p className="text-zinc-400 mb-6">Gracias por viajar con nosotros.</p>
                     <Link to="/cliente" className="bg-white text-black px-6 py-2 rounded-xl font-bold">Volver al Panel</Link>
                  </div>
               </ProtectedRoute>
            } />
            {/* Catch-all route to prevent blank screens */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </AppRouter>
  );
}

export default App;
