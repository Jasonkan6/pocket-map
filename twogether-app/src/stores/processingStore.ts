import { create } from 'zustand';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { extractPlaceFromScreenshot } from '../lib/gemini';
import { geocodePlaceName } from '../lib/geocode';
import { getPlaces, savePlace, uploadScreenshot } from '../lib/supabase';

const REGION_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  north:   { lat: 25.04, lng: 121.56 },
  central: { lat: 24.14, lng: 120.68 },
  south:   { lat: 22.63, lng: 120.30 },
  east:    { lat: 23.99, lng: 121.60 },
  unknown: { lat: 23.5,  lng: 121.0  },
};

type Result = { success: number; failed: number; skipped: number };

type ProcessingState = {
  isProcessing: boolean;
  done: number;
  total: number;
  completedResult: Result | null;
  enqueue: (assets: ImagePickerAsset[], userId: string, coupleId: string | null) => void;
  clearResult: () => void;
};

export const useProcessingStore = create<ProcessingState>((set) => ({
  isProcessing: false,
  done: 0,
  total: 0,
  completedResult: null,

  clearResult: () => set({ completedResult: null }),

  enqueue: (assets, userId, coupleId) => {
    set({ isProcessing: true, done: 0, total: assets.length, completedResult: null });

    // Fire-and-forget — caller does not await this.
    (async () => {
      let success = 0;
      let failed = 0;
      let skipped = 0;

      // Fetch the couple's existing places once to build the dedup set.
      let existingPlaceIds: Set<string>;
      try {
        const existing = await getPlaces(coupleId, userId);
        existingPlaceIds = new Set(
          existing.map(p => p.google_place_id).filter(Boolean) as string[],
        );
        console.log('[processing] loaded', existing.length, 'existing places,',
          existingPlaceIds.size, 'with Google Place IDs');
      } catch {
        existingPlaceIds = new Set();
      }

      for (let i = 0; i < assets.length; i++) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            assets[i].uri,
            [{ resize: { width: 1024 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          );

          const info = await extractPlaceFromScreenshot(manipulated.base64!);
          const geocoded = await geocodePlaceName(info.name, info.address || null);

          // Dedup: skip if this Google Place ID is already in the couple's list.
          if (geocoded && existingPlaceIds.has(geocoded.placeId)) {
            console.log('[processing] ⏭ duplicate, skipping:', info.name, geocoded.placeId);
            skipped++;
            set(s => ({ done: s.done + 1 }));
            continue;
          }

          const coords = geocoded ?? (REGION_CENTROIDS[info.region] ?? REGION_CENTROIDS.unknown);
          const imageUrl = await uploadScreenshot(userId, manipulated.base64!);

          const { error } = await savePlace(userId, coupleId, {
            name: info.name,
            category: info.category ?? 'other',
            lat: coords.lat,
            lng: coords.lng,
            region: info.region ?? undefined,
            address: info.address || undefined,
            note: info.note || undefined,
            image_url: imageUrl,
            google_place_id: geocoded?.placeId ?? null,
            visited: false,
            status: 'want-to-go',
            source_type: 'screenshot',
          });
          if (error) throw error;

          // Add to the local set so subsequent photos in the same batch are also deduped.
          if (geocoded) existingPlaceIds.add(geocoded.placeId);
          console.log('[processing] ✅ saved:', info.name);
          success++;
        } catch (e) {
          console.error('[processing] ❌ photo', i + 1, 'failed:', e);
          failed++;
        }
        set(s => ({ done: s.done + 1 }));
      }

      set({ isProcessing: false, completedResult: { success, failed, skipped } });
    })();
  },
}));
