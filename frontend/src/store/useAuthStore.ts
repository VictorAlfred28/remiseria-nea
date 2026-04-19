import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  role: string | null;
  roles: string[];          // Multi-rol: lista completa desde user_roles
  orgId: string | null;
  isLoading: boolean;
  login: (user: any, role: string, orgId: string) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  isLightMode: boolean;
  toggleTheme: () => void;
  /** Helper: comprueba si el usuario tiene un rol (campo legado O user_roles) */
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  roles: [],
  orgId: null,
  isLoading: true,
  isLightMode: localStorage.getItem('theme') === 'light',

  hasRole: (role: string) => {
    const state = get();
    return state.role === role || state.roles.includes(role);
  },

  login: (user, role, orgId) => set({ user, role, orgId, roles: [], isLoading: false }),

  toggleTheme: () => set((state) => {
    const newMode = !state.isLightMode;
    localStorage.setItem('theme', newMode ? 'light' : 'dark');
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
    set({ user: null, role: null, roles: [], orgId: null, isLoading: false });
  },

  checkSession: async () => {
    try {
      set({ isLoading: true });
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        set({ user: null, role: null, roles: [], isLoading: false });
        return;
      }

      // Save token for axios
      localStorage.setItem('sb-access-token', session.access_token);

      // 1. Perfil base con rol legado
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('rol, organizacion_id')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData) {
        set({ user: null, role: null, roles: [], isLoading: false });
        return;
      }

      // 2. Lista extendida de roles desde user_roles (multi-rol)
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      const rolesList: string[] = rolesData?.map((r: any) => r.role) ?? [];

      set({
        user: session.user,
        role: userData.rol,
        roles: rolesList,
        orgId: userData.organizacion_id,
        isLoading: false,
      });

    } catch (err) {
      set({ user: null, role: null, roles: [], orgId: null, isLoading: false });
    }
  }
}));
