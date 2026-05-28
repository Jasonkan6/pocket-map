import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import type { User, Couple, Place, Moment } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder';

// Use SecureStore for session persistence on iOS
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// --- Auth helpers ---

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error || !data.user) return { data, error };

  // Create user profile row
  await supabase.from('users').insert({
    id: data.user.id,
    email,
    display_name: displayName,
  });

  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

// --- Couple helpers ---

export async function createCouple(userId: string): Promise<{ couple: Couple | null; error: unknown }> {
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from('couples')
    .insert({ user_a_id: userId, invite_code: inviteCode, status: 'pending' })
    .select()
    .single();

  if (error) return { couple: null, error };

  await supabase.from('users').update({ couple_id: data.id }).eq('id', userId);
  return { couple: data as Couple, error: null };
}

export async function joinCouple(userId: string, inviteCode: string): Promise<{ couple: Couple | null; error: unknown }> {
  const { data: couple, error: findError } = await supabase
    .from('couples')
    .select()
    .eq('invite_code', inviteCode.toUpperCase())
    .eq('status', 'pending')
    .single();

  if (findError || !couple) return { couple: null, error: findError ?? new Error('Invalid or expired invite code') };
  if (couple.user_a_id === userId) return { couple: null, error: new Error('Cannot pair with yourself') };

  const { data: updated, error } = await supabase
    .from('couples')
    .update({ user_b_id: userId, status: 'active', paired_at: new Date().toISOString() })
    .eq('id', couple.id)
    .select()
    .single();

  if (error) return { couple: null, error };

  await supabase.from('users').update({ couple_id: couple.id }).eq('id', userId);
  return { couple: updated as Couple, error: null };
}

// --- Places helpers ---

export async function getPlaces(coupleId: string | null, userId: string): Promise<Place[]> {
  const query = supabase.from('places').select('*').order('created_at', { ascending: false });
  const { data, error } = coupleId
    ? await query.eq('couple_id', coupleId)
    : await query.eq('saved_by', userId);
  if (error) throw error;
  return (data ?? []) as Place[];
}

export async function savePlace(
  userId: string,
  coupleId: string | null,
  fields: Pick<Place, 'name' | 'category' | 'lat' | 'lng'> & Partial<Pick<Place, 'image_url' | 'region' | 'note'>>,
): Promise<{ place: Place | null; error: unknown }> {
  const { data, error } = await supabase
    .from('places')
    .insert({
      saved_by: userId,
      couple_id: coupleId,
      visited: true,        // a synced photo / dropped pin is a place you've been
      bloom_level: 0,
      visit_count: 0,
      status: 'visited',    // keep LINE-bot status field consistent
      source_type: 'photo',
      ...fields,
    })
    .select()
    .single();
  return { place: data as Place | null, error };
}

// --- Moments helpers ---

export async function getMomentsForPlace(placeId: string): Promise<Moment[]> {
  const { data, error } = await supabase
    .from('moments')
    .select('*')
    .eq('place_id', placeId)
    .order('taken_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Moment[];
}
