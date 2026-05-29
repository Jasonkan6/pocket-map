export type User = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  couple_id: string | null;
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
  couple_id: string | null;
  saved_by: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: 'food' | 'cafe' | 'attraction' | 'accommodation' | 'other';
  region: string | null;
  note: string | null;        // column name in DB is 'note' (LINE Bot)
  visited: boolean;
  visit_count: number;
  bloom_level: 0 | 1 | 2 | 3 | 4 | 5;
  image_url: string | null;
  source_type: string | null;
  status: string | null;      // LINE Bot legacy: 'want-to-go' | 'visited'
  google_place_id: string | null;
  created_at: string;
};

export type Moment = {
  id: string;
  place_id: string;
  user_id: string;
  couple_id: string | null;
  image_url: string;
  thumbnail_url: string | null;
  lat: number | null;
  lng: number | null;
  taken_at: string;
  ai_caption: string | null;
  ai_tags: string[] | null;
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
