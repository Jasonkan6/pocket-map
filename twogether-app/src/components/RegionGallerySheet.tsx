import React, { useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Linking, ListRenderItemInfo,
} from 'react-native';
import type { Place } from '../types';

const CATEGORY_LABELS: Record<Place['category'], string> = {
  food: '食物',
  cafe: '咖啡',
  attraction: '景點',
  accommodation: '住宿',
  other: '其他',
};

const REGION_LABELS: Record<string, string> = {
  north: '北部',
  central: '中部',
  south: '南部',
  east: '東部',
  unknown: '',
};

const BLOOM_EMOJIS = ['🌱', '🌿', '🌳', '🌲', '🌸', '🌴'];
const BLOOM_LABELS = ['種子', '幼苗', '小樹', '中樹', '大樹', '茂盛'];

const CATEGORY_EMOJI: Record<Place['category'], string> = {
  food: '🍜',
  cafe: '☕',
  attraction: '🏛️',
  accommodation: '🛏️',
  other: '📍',
};

type Props = {
  places: Place[];
  onClose: () => void;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
};

function PlaceCard({ place, onEdit, onDelete }: {
  place: Place;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
}) {
  const date = new Date(place.created_at).toLocaleDateString('zh-TW');
  const bloomIdx = Math.min(place.bloom_level ?? 0, 5);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  return (
    <View style={styles.card}>
      {place.image_url ? (
        <Image
          source={{ uri: place.image_url }}
          style={[styles.photo, aspectRatio ? { height: undefined, aspectRatio } : null]}
          resizeMode="contain"
          onLoad={(e) => {
            const { width, height } = e.nativeEvent.source;
            if (width && height) setAspectRatio(width / height);
          }}
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.placeholderEmoji}>{CATEGORY_EMOJI[place.category]}</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.placeName} numberOfLines={2}>{place.name}</Text>
        <Text style={styles.placeMeta}>{date} · {(place.region ? (REGION_LABELS[place.region] ?? place.region) : null) ?? CATEGORY_LABELS[place.category]}</Text>

        <View style={styles.badges}>
          <View style={[styles.badge, place.visited ? styles.visitedBadge : styles.wishlistBadge]}>
            <Text style={styles.badgeText}>{place.visited ? '去過' : '想去'}</Text>
          </View>
          {place.visited ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {BLOOM_EMOJIS[bloomIdx]} {BLOOM_LABELS[bloomIdx]}
              </Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.starBadge]}>
              <Text style={styles.badgeText}>⭐ 收藏中</Text>
            </View>
          )}
          {(place.visit_count ?? 0) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>造訪 {place.visit_count} 次</Text>
            </View>
          )}
        </View>

        {place.note && <Text style={styles.note} numberOfLines={3}>{place.note}</Text>}

        {place.lat && place.lng && (
          <TouchableOpacity
            style={styles.mapsBtn}
            onPress={() => {
              const query = place.address ? `${place.name} ${place.address}` : place.name;
              Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(query)}&ll=${place.lat},${place.lng}`);
            }}
          >
            <Text style={styles.mapsBtnText}>在 Google Maps 開啟</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(place)}>
            <Text style={styles.actionText}>✏️ 編輯</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDelete(place)}>
            <Text style={[styles.actionText, styles.deleteText]}>🗑️ 刪除</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function getSheetTitle(places: Place[]): string {
  const regions = [...new Set(places.map(p => p.region).filter(Boolean))] as string[];
  if (regions.length === 1) return `📍 ${REGION_LABELS[regions[0]] || regions[0]}`;
  return `📍 附近 ${places.length} 個地點`;
}

export default function RegionGallerySheet({ places, onClose, onEdit, onDelete }: Props) {
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{getSheetTitle(places)}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={places}
        keyExtractor={item => item.id}
        renderItem={({ item }: ListRenderItemInfo<Place>) => (
          <PlaceCard place={item} onEdit={onEdit} onDelete={onDelete} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
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
    maxHeight: '78%',
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
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#2D2A26', flex: 1 },
  closeBtn: { padding: 4, marginLeft: 8 },
  closeText: { fontSize: 16, color: '#8A8070' },
  listContent: { paddingBottom: 40 },
  separator: { height: 1, backgroundColor: '#F0EBE3', marginHorizontal: 20 },
  card: { paddingHorizontal: 20, paddingVertical: 16 },
  photo: {
    width: '100%',
    height: 260,  // fallback until natural dimensions load
    borderRadius: 12,
    backgroundColor: '#EEF3EF',
    marginBottom: 12,
  },
  photoPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#EEF3EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderEmoji: { fontSize: 48 },
  cardBody: { gap: 6 },
  placeName: { fontSize: 17, fontWeight: '700', color: '#2D2A26' },
  placeMeta: { fontSize: 13, color: '#8A8070' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badge: {
    backgroundColor: '#EEF3EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  visitedBadge: { backgroundColor: '#EEF3EF' },
  wishlistBadge: { backgroundColor: '#F3F0E8' },
  starBadge: { backgroundColor: '#FFF8E1' },
  badgeText: { fontSize: 12, color: '#5C7A5F', fontWeight: '500' },
  note: { fontSize: 14, color: '#2D2A26', lineHeight: 20, marginTop: 4 },
  mapsBtn: {
    marginTop: 10,
    backgroundColor: '#EEF3EF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mapsBtnText: { fontSize: 14, color: '#5C7A5F', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#F0EBE3',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionText: { fontSize: 14, color: '#5C7A5F', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#FBEDEC' },
  deleteText: { color: '#C0392B' },
});
