import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  role: string | null;
  orgId: string | null;
  isLoading: boolean;
  login: (user: any, role: string, orgId: string) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  isLightMode: boolean;
  toggleTheme: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  orgId: null,
  isLoading: true,
  isLightMode: localStorage.getItem('theme') === 'light',

  login: (user, role, orgId) => set({ user, role, orgId, isLoading: false }),

  toggleTheme: () => set((state) => {
      const newMode = !state.isLightMode;
      localStorage.setItem('theme', newMode ? 'light' : 'dark');
      // Aplicar al body directamente para que index.css actúe instantáneamente sin esperar renders en cascada
      if (newMode) {
          document.documentElement.classList.add('light-theme');
      } else {
          document.documentElement.classList.remove('light-theme');
      }
      return { isLightMode: newMode };
  }),

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('sb-access-token');
    set({ user: null, role: null, orgId: null, isLoading: false });
  },

  checkSession: async () => {
    try {
      set({ isLoading: true });
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        set({ user: null, role: null, isLoading: false });
        return;
      }

      // Save token for axios
      localStorage.setItem('sb-access-token', session.access_token);

      // Verify role from public.usuarios
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('rol, organizacion_id')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData) {
        set({ user: null, role: null, isLoading: false });
        return;
      }

      set({ 
        user: session.user, 
        role: userData.rol, 
        orgId: userData.organizacion_id,
        isLoading: false 
      });

    } catch (err) {
      set({ user: null, role: null, orgId: null, isLoading: false });
    }
  }
}));
