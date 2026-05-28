import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { getPlaces, savePlace } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Place } from '../../types';
import PlaceDetailSheet from '../../components/PlaceDetailSheet';
import LeafletMap from '../../components/LeafletMap';

export default function MapScreen() {
  const { couple, profile } = useAuthStore();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [filter, setFilter] = useState<'all' | 'visited' | 'wishlist'>('all');

  const loadPlaces = useCallback(async () => {
    if (!profile) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getPlaces(couple?.id ?? null, profile.id);
      setPlaces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [couple, profile]);

  useFocusEffect(useCallback(() => { loadPlaces(); }, [loadPlaces]));

  async function handleAddPlace() {
    if (!profile || adding) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要定位權限', '請在設定中允許 Twogether 存取位置');
      return;
    }
    setAdding(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      Alert.prompt(
        '在這裡新增地點',
        '輸入這個地方的名稱',
        async (name) => {
          if (!name?.trim()) return;
          await savePlace(profile.id, couple?.id ?? null, {
            name: name.trim(),
            category: 'other',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          loadPlaces();
        },
        'plain-text',
      );
    } catch (e) {
      Alert.alert('取得位置失敗', String(e));
    } finally {
      setAdding(false);
    }
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
        <Text style={styles.count}>{filtered.length} 個地點</Text>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyTitle}>還沒有地點</Text>
          <Text style={styles.emptyHint}>點右下角 ＋ 在目前位置新增地點，或前往「同步相簿」匯入照片</Text>
        </View>
      ) : (
        <LeafletMap
          places={filtered}
          onPlaceSelect={setSelected}
          style={styles.map}
        />
      )}

      {/* FAB — drop a pin at current GPS location */}
      <TouchableOpacity style={styles.fab} onPress={handleAddPlace} disabled={adding}>
        {adding
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.fabText}>＋</Text>
        }
      </TouchableOpacity>

      {selected && (
        <PlaceDetailSheet place={selected} onClose={() => setSelected(null)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#2D2A26' },
  emptyHint: { fontSize: 13, color: '#8A8070', textAlign: 'center' },
  filterRow: {
    flexDirection: 'row', gap: 8, padding: 12,
    alignItems: 'center', backgroundColor: '#FAFAF8',
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F0EBE3',
  },
  filterChipActive: { backgroundColor: '#5C7A5F' },
  filterText: { fontSize: 13, color: '#8A8070' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  count: { fontSize: 12, color: '#8A8070', marginLeft: 'auto' },
  map: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5C7A5F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
