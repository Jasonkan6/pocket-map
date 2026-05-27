export type User = {
  id: string;
  email: string | null;
  apple_user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  couple_id: string | null;
  line_user_id: string | null;
  created_at: string;
};

export type Couple = {
  id: string;
  user_a_id: string;
  user_b_id: string | null;
  invite_code: string;
  paired_at: string | null;
  status: 'pending' | 'active' | 'disconnected';
};

export type Place = {
  id: string;
  couple_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: 'food' | 'cafe' | 'attraction' | 'accommodation' | 'other';
  region: string | null;
  notes: string | null;
  visited: boolean;
  is_spontaneous: boolean;
  visit_count: number;
  bloom_level: 0 | 1 | 2 | 3 | 4 | 5;
  first_visited_at: string | null;
  last_visited_at: string | null;
  created_at: string;
};

export type Moment = {
  id: string;
  place_id: string;
  user_id: string;
  couple_id: string;
  image_url: string;
  thumbnail_url: string | null;
  lat: number | null;
  lng: number | null;
  taken_at: string;
  ai_caption: string | null;
  ai_tags: string[] | null;
  pair_id: string | null;
  companion_present: boolean;
  created_at: string;
};

export type Gift = {
  id: string;
  sender_id: string;
  receiver_id: string;
  place_id: string;
  content_type: 'voice' | 'photo' | 'text';
  content_url: string | null;
  content_text: string | null;
  created_at: string;
  unlocked_at: string | null;
};

export type Visit = {
  id: string;
  place_id: string;
  user_id: string;
  couple_id: string;
  visited_at: string;
  duration_minutes: number | null;
};
