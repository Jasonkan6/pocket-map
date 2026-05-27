import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User, Couple } from '../types';

type AuthState = {
  session: Session | null;
  profile: User | null;
  couple: Couple | null;
  isLoading: boolean;
  skippedPairing: boolean;
  setSession: (session: Session | null) => void;
  loadProfile: (userId: string) => Promise<void>;
  skipPairing: () => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  couple: null,
  isLoading: true,
  skippedPairing: false,

  setSession: (session) => set({ session, isLoading: false }),

  loadProfile: async (userId) => {
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) return;
    set({ profile: profile as User });

    if (profile.couple_id) {
      const { data: couple } = await supabase
        .from('couples')
        .select('*')
        .eq('id', profile.couple_id)
        .single();
      set({ couple: couple as Couple });
    }
  },

  skipPairing: () => set({ skippedPairing: true }),
  clear: () => set({ session: null, profile: null, couple: null, skippedPairing: false }),
}));
