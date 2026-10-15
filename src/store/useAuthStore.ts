import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  checkUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  checkUser: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ user: session?.user || null, loading: false });
    
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user || null });
    });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  }
}));
