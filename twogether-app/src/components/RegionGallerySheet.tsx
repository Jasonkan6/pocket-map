import React, { useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Linking, Dimensions,
} from 'react-native';
import type { Place } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

const CATEGORY_LABELS: Record<Place['category'], string> = {
  food: '食物', cafe: '咖啡', attraction: '景點', accommodation: '住宿', other: '其他',
};
const REGION_LABELS: Record<string, string> = {
  north: '北部', central: '中部', south: '南部', east: '東部', unknown: '',
};
const BLOOM_EMOJIS = ['🌱', '🌿', '🌳', '🌲', '🌸', '🌴'];
const BLOOM_LABELS = ['種子', '幼苗', '小樹', '中樹', '大樹', '茂盛'];
const CATEGORY_EMOJI: Record<Place['category'], string> = {
  food: '🍜', cafe: '☕', attraction: '🏛️', accommodation: '🛏️', other: '📍',
};

type Props = {
  places: Place[];
  onClose: () => void;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
  onAddPhoto: (place: Place) => void;
};

export default function RegionGallerySheet({ places, onClose, onEdit, onDelete, onAddPhoto }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = places[currentIndex] ?? places[0];
  const showDots = places.length > 1;

  const date = new Date(current.created_at).toLocaleDateString('zh-TW');
  const bloomIdx = Math.min(current.bloom_level ?? 0, 5);
  const isWishlist = !current.visited;

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>{current.name}</Text>
        {showDots && (
          <Text style={styles.pageCounter}>{currentIndex + 1} / {places.length}</Text>
        )}
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Photo carousel */}
      <FlatList
        data={places}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.photoWrapper}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.placeholderEmoji}>{CATEGORY_EMOJI[item.category]}</Text>
              </View>
            )}
            {/* Amber overlay for wishlist places — signals "not yet visited" */}
            {!item.visited && (
              <View style={styles.wishlistOverlay} pointerEvents="none" />
            )}
          </View>
        )}
      />

      {/* Dot indicators */}
      {showDots && (
        <View style={styles.dots}>
          {places.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Info — synced to current photo */}
      <View style={[styles.info, isWishlist && styles.infoWishlist]}>
        <Text style={styles.placeMeta}>
          {date} · {(current.region ? (REGION_LABELS[current.region] ?? current.region) : null) ?? CATEGORY_LABELS[current.category]}
        </Text>

        <View style={styles.badges}>
          <View style={[styles.badge, current.visited ? styles.visitedBadge : styles.wishlistBadge]}>
            <Text style={[styles.badgeText, current.visited ? styles.visitedBadgeText : styles.wishlistBadgeText]}>
              {current.visited ? '✓ 去過' : '⭐ 想去'}
            </Text>
          </View>
          {current.visited && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{BLOOM_EMOJIS[bloomIdx]} {BLOOM_LABELS[bloomIdx]}</Text>
            </View>
          )}
          {(current.visit_count ?? 0) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>造訪 {current.visit_count} 次</Text>
            </View>
          )}
        </View>

        {current.note ? <Text style={styles.note} numberOfLines={3}>{current.note}</Text> : null}

        {current.lat && current.lng && (
          <TouchableOpacity
            style={styles.mapsBtn}
            onPress={() => {
              const query = current.address ? `${current.name} ${current.address}` : current.name;
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
            }}
          >
            <Text style={styles.mapsBtnText}>在 Google Maps 開啟</Text>
          </TouchableOpacity>
        )}

        {/* "Add my photos" — only for wishlist places */}
        {isWishlist && (
          <TouchableOpacity style={styles.addPhotoBtn} onPress={() => onAddPhoto(current)}>
            <Text style={styles.addPhotoBtnText}>📷 加入我的照片</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(current)}>
            <Text style={styles.actionText}>✏️ 編輯</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDelete(current)}>
            <Text style={[styles.actionText, styles.deleteText]}>🗑️ 刪除</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FAFAF8',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 10,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#E0D9CE',
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0EBE3',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#2D2A26', flex: 1 },
  pageCounter: { fontSize: 13, color: '#8A8070', fontWeight: '500' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 16, color: '#8A8070' },
  photoWrapper: { width: SCREEN_WIDTH, height: 260 },
  photo: { width: '100%', height: '100%', backgroundColor: '#EEF3EF' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderEmoji: { fontSize: 56 },
  wishlistOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(251, 211, 141, 0.22)',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E0D9CE' },
  dotActive: { width: 18, backgroundColor: '#5C7A5F' },
  info: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 8 },
  infoWishlist: { backgroundColor: '#FFFDF5' },
  placeMeta: { fontSize: 13, color: '#8A8070' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: '#EEF3EF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  visitedBadge: { backgroundColor: '#EEF3EF' },
  wishlistBadge: { backgroundColor: '#FFF3CD' },
  badgeText: { fontSize: 12, color: '#5C7A5F', fontWeight: '500' },
  visitedBadgeText: { color: '#5C7A5F' },
  wishlistBadgeText: { color: '#B8860B' },
  note: { fontSize: 14, color: '#2D2A26', lineHeight: 20 },
  mapsBtn: {
    backgroundColor: '#EEF3EF', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  mapsBtnText: { fontSize: 14, color: '#5C7A5F', fontWeight: '600' },
  addPhotoBtn: {
    backgroundColor: '#FFF3CD', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#F0C040',
  },
  addPhotoBtnText: { fontSize: 14, color: '#B8860B', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: '#F0EBE3',
    borderRadius: 10, paddingVertical: 11, alignItems: 'center',
  },
  actionText: { fontSize: 14, color: '#5C7A5F', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#FBEDEC' },
  deleteText: { color: '#C0392B' },
});
