import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  StyleSheet, ActivityIndicator, SafeAreaView, Animated,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getPlaces, deletePlace } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useProcessingStore } from '../../stores/processingStore';
import type { Place } from '../../types';
import RegionGallerySheet from '../../components/RegionGallerySheet';
import LeafletMap from '../../components/LeafletMap';

const REGION_DEG = 0.5 / 111;

function getRegion(center: Place, all: Place[]): Place[] {
  return all.filter(
    p => Math.abs(p.lat - center.lat) <= REGION_DEG && Math.abs(p.lng - center.lng) <= REGION_DEG,
  );
}

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const { couple, profile, session } = useAuthStore();
  const { isProcessing, done, total, completedResult, clearResult } = useProcessingStore();

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionPlaces, setRegionPlaces] = useState<Place[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'visited' | 'wishlist'>('all');
  const [toastMsg, setToastMsg] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;

  const loadPlaces = useCallback(async () => {
    const userId = profile?.id ?? session?.user?.id;
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getPlaces(couple?.id ?? null, userId);
      setPlaces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [couple, profile, session]);

  useFocusEffect(useCallback(() => { loadPlaces(); }, [loadPlaces]));

  // When background processing finishes: refresh map + show toast.
  useEffect(() => {
    if (!completedResult) return;
    loadPlaces();
    const msg = completedResult.failed === 0
      ? `✅ 已新增 ${completedResult.success} 個想去地點`
      : `✅ ${completedResult.success} 個成功　❌ ${completedResult.failed} 個無法辨識`;
    setToastMsg(msg);
    clearResult();
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [completedResult]);

  function handleEdit(place: Place) {
    setRegionPlaces(null);
    navigation.navigate('PlaceEdit', { place });
  }

  function handleDelete(place: Place) {
    Alert.alert('刪除地點', `確定要刪除「${place.name}」嗎？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deletePlace(place.id);
          if (error) { Alert.alert('刪除失敗', String(error)); return; }
          setRegionPlaces(prev => {
            const next = (prev ?? []).filter(p => p.id !== place.id);
            return next.length ? next : null;
          });
          loadPlaces();
        },
      },
    ]);
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
        <Text style={styles.count}>{filtered.length} 個地點</Text>
      </View>

      {/* Background processing banner */}
      {isProcessing && (
        <View style={styles.processingBanner}>
          <ActivityIndicator size="small" color="#5C7A5F" />
          <Text style={styles.processingText}>
            正在分析第 {done} / {total} 張截圖…
          </Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        <LeafletMap
          places={filtered}
          onPlaceSelect={(tapped) => {
            const nearby = getRegion(tapped, places);
            const ordered = [tapped, ...nearby.filter(p => p.id !== tapped.id)];
            setRegionPlaces(ordered);
          }}
          style={styles.map}
        />
        {filtered.length === 0 && (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🌱</Text>
              <Text style={styles.emptyTitle}>還沒有地點</Text>
              <Text style={styles.emptyHint}>點右下角 ＋ 新增，或前往「同步相簿」匯入</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('WishlistAdd')}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* Completion toast */}
      <Animated.View style={[
        styles.toast,
        {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}>
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>

      {regionPlaces && (
        <RegionGallerySheet
          places={regionPlaces}
          onClose={() => setRegionPlaces(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  processingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EEF3EF',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  processingText: { fontSize: 13, color: '#5C7A5F', fontWeight: '500' },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: 'rgba(250,250,248,0.92)',
    borderRadius: 16, paddingHorizontal: 24, paddingVertical: 20,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#2D2A26' },
  emptyHint: { fontSize: 13, color: '#8A8070', textAlign: 'center', maxWidth: 220 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#5C7A5F',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  toast: {
    position: 'absolute', bottom: 48, alignSelf: 'center',
    backgroundColor: '#2D2A26', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
