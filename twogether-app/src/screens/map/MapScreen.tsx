import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPlaces } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Place } from '../../types';
import PlaceDetailSheet from '../../components/PlaceDetailSheet';

const BLOOM_LABELS = ['🌱', '🌿', '🌳', '🌲', '🌸', '🌴'];
const CATEGORY_LABELS: Record<Place['category'], string> = {
  food: '食物', cafe: '咖啡', attraction: '景點', accommodation: '住宿', other: '其他',
};

// react-native-maps requires a native build (EAS) and is not available in Expo Go.
// This list view is used for Expo Go testing; the full map renders in the EAS build.

export default function MapScreen() {
  const { couple } = useAuthStore();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Place | null>(null);
  const [filter, setFilter] = useState<'all' | 'visited' | 'wishlist'>('all');

  const loadPlaces = useCallback(async () => {
    if (!couple) { setLoading(false); return; }
    try {
      const data = await getPlaces(couple.id);
      setPlaces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [couple]);

  useFocusEffect(useCallback(() => { loadPlaces(); }, [loadPlaces]));

  if (!couple) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>配對後才能看到地點</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#5C7A5F" /></View>;
  }

  const filtered = places.filter(p => {
    if (filter === 'visited') return p.visited;
    if (filter === 'wishlist') return !p.visited;
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterRow}>
        {(['all', 'visited', 'wishlist'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? '全部' : f === 'visited' ? '去過' : '想去'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyTitle}>還沒有地點</Text>
          <Text style={styles.emptyHint}>用 Pocket Map 截圖存地點，就會出現在這裡</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map(place => (
            <TouchableOpacity key={place.id} style={styles.card} onPress={() => setSelected(place)}>
              <View style={styles.cardLeft}>
                <Text style={styles.bloom}>{BLOOM_LABELS[place.bloom_level]}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
                <Text style={styles.placeMeta}>
                  {CATEGORY_LABELS[place.category]}{place.region ? ` · ${place.region}` : ''}
                </Text>
              </View>
              <View style={[styles.badge, place.visited ? styles.visitedBadge : styles.wishBadge]}>
                <Text style={styles.badgeText}>{place.visited ? '去過' : '想去'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {selected && <PlaceDetailSheet place={selected} onClose={() => setSelected(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#2D2A26' },
  emptyHint: { fontSize: 13, color: '#8A8070', textAlign: 'center', paddingHorizontal: 32 },
  filterRow: { flexDirection: 'row', gap: 8, padding: 12 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F0EBE3',
  },
  filterChipActive: { backgroundColor: '#5C7A5F' },
  filterText: { fontSize: 13, color: '#8A8070' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: 12, gap: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    padding: 12, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardLeft: { width: 36, alignItems: 'center' },
  bloom: { fontSize: 24 },
  cardBody: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: '600', color: '#2D2A26' },
  placeMeta: { fontSize: 12, color: '#8A8070', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  visitedBadge: { backgroundColor: '#EEF3EF' },
  wishBadge: { backgroundColor: '#F3F0E8' },
  badgeText: { fontSize: 11, color: '#5C7A5F', fontWeight: '500' },
});
