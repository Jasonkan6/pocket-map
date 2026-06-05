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
    let { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Auto-create profile row for users who signed up before migration ran
    if (!profile) {
      const { data: authData } = await supabase.auth.getUser();
      const { error: upsertError } = await supabase.from('users').upsert({
        id: userId,
        email: authData.user?.email ?? null,
        display_name:
          authData.user?.user_metadata?.display_name ??
          authData.user?.email?.split('@')[0] ??
          null,
      });
      if (!upsertError) {
        const { data: created } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        profile = created;
      }
    }

    // Even if the users table fails (RLS or missing table), synthesise a
    // minimal profile from the auth session so the app stays functional.
    if (!profile) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const synthetic: User = {
          id: authData.user.id,
          email: authData.user.email ?? null,
          display_name: authData.user.user_metadata?.display_name ?? null,
          avatar_url: null,
          couple_id: null,
          created_at: authData.user.created_at,
        };
        set({ profile: synthetic });
        return;
      }
      return;
    }

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
