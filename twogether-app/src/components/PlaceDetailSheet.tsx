import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import type { Place } from '../types';

const CATEGORY_LABELS: Record<Place['category'], string> = {
  food: '食物',
  cafe: '咖啡',
  attraction: '景點',
  accommodation: '住宿',
  other: '其他',
};

const BLOOM_LABELS = ['種子', '幼苗', '小樹', '中樹', '大樹', '茂盛'];

type Props = { place: Place; onClose: () => void };

export default function PlaceDetailSheet({ place, onClose }: Props) {
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.name}>{place.name}</Text>
            <Text style={styles.meta}>
              {CATEGORY_LABELS[place.category]} · {place.region ?? ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badges}>
          <View style={[styles.badge, place.visited ? styles.visitedBadge : styles.wishlistBadge]}>
            <Text style={styles.badgeText}>{place.visited ? '去過' : '想去'}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{BLOOM_LABELS[place.bloom_level]}</Text>
          </View>
          {(place.visit_count ?? 0) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>造訪 {place.visit_count} 次</Text>
            </View>
          )}
        </View>

        {place.address && <Text style={styles.address}>{place.address}</Text>}
        {place.note && <Text style={styles.notes}>{place.note}</Text>}

        {place.lat && place.lng && (
          <TouchableOpacity
            style={styles.mapsBtn}
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${place.lat},${place.lng}`)}
          >
            <Text style={styles.mapsBtnText}>在 Google Maps 開啟</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FAFAF8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0D9CE',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 20, fontWeight: '700', color: '#2D2A26' },
  meta: { fontSize: 13, color: '#8A8070', marginTop: 2 },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 16, color: '#8A8070' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: {
    backgroundColor: '#EEF3EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  visitedBadge: { backgroundColor: '#EEF3EF' },
  wishlistBadge: { backgroundColor: '#F3F0E8' },
  badgeText: { fontSize: 12, color: '#5C7A5F', fontWeight: '500' },
  address: { fontSize: 13, color: '#8A8070', marginTop: 12, lineHeight: 18 },
  notes: { fontSize: 14, color: '#2D2A26', marginTop: 8, lineHeight: 20 },
  mapsBtn: {
    marginTop: 16,
    backgroundColor: '#EEF3EF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mapsBtnText: { fontSize: 14, color: '#5C7A5F', fontWeight: '600' },
});
