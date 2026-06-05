import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import { getPlaces, savePlace, updatePlace, saveMoment, uploadScreenshot } from '../../lib/supabase';
import { haversineMeters } from '../../lib/distance';
import { useAuthStore } from '../../stores/authStore';

type GeoPhoto = {
  asset: MediaLibrary.Asset;
  latitude: number;
  longitude: number;
  localUri: string;  // file:// URI — ph:// URIs cannot be displayed by Image
};

export default function PhotoSyncScreen() {
  const navigation = useNavigation<any>();
  const { profile, couple, session } = useAuthStore();
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [importing, setImporting] = useState(false);

  const scanPhotos = useCallback(async () => {
    setScanning(true);
    setPhotos([]);
    setSelected(new Set());
    setScanProgress('');
    const results: GeoPhoto[] = [];
    try {
      // Paginate through the entire album
      let cursor: string | undefined;
      let totalScanned = 0;
      while (true) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: MediaLibrary.SortBy.creationTime,
          first: 100,
          after: cursor,
        });

        // Fetch location info in parallel batches of 10
        const batchSize = 10;
        for (let i = 0; i < page.assets.length; i += batchSize) {
          const batch = page.assets.slice(i, i + batchSize);
          const infos = await Promise.all(batch.map(a => MediaLibrary.getAssetInfoAsync(a.id)));
          for (let j = 0; j < batch.length; j++) {
            const info = infos[j];
            if (info.location?.latitude && info.location?.longitude && info.localUri) {
              results.push({
                asset: batch[j],
                latitude: info.location.latitude,
                longitude: info.location.longitude,
                localUri: info.localUri,  // file:// path, safe for Image component
              });
            }
          }
        }

        totalScanned += page.assets.length;
        setScanProgress(`已掃描 ${totalScanned} 張，找到 ${results.length} 張有位置`);
        setPhotos([...results]);

        if (!page.hasNextPage) break;
        cursor = page.endCursor;
      }
    } catch (e) {
      Alert.alert('掃描失敗', String(e));
    } finally {
      setScanning(false);
      setScanProgress('');
    }
  }, []);

  async function handleImport() {
    const userId = profile?.id ?? session?.user?.id;
    if (!userId || selected.size === 0) {
      Alert.alert('無法匯入', '請先登入後再試');
      return;
    }
    setImporting(true);
    let newCount = 0;
    let matchCount = 0;
    let lastError: unknown = null;
    try {
      // Load wishlist places once to check for proximity matches
      const allPlaces = await getPlaces(couple?.id ?? null, userId);
      const wishlistPlaces = allPlaces.filter(p => !p.visited);

      for (const id of selected) {
        const photo = photos.find(p => p.asset.id === id);
        if (!photo) continue;

        // Find the closest wishlist place within 200m
        let bestMatch: (typeof wishlistPlaces)[0] | null = null;
        let bestDist = 200;
        for (const place of wishlistPlaces) {
          const dist = haversineMeters(photo.latitude, photo.longitude, place.lat, place.lng);
          if (dist < bestDist) {
            bestDist = dist;
            bestMatch = place;
          }
        }

        // Upload to cloud storage so the URL is shareable with partner
        let cloudUrl: string;
        try {
          const compressed = await ImageManipulator.manipulateAsync(
            photo.localUri, [], { compress: 0.8, base64: true },
          );
          cloudUrl = await uploadScreenshot(userId, compressed.base64!);
        } catch (uploadErr) {
          lastError = uploadErr;
          continue;
        }

        if (bestMatch) {
          const { error } = await updatePlace(bestMatch.id, {
            visited: true,
            status: 'visited',
            image_url: cloudUrl,
            visit_count: (bestMatch.visit_count ?? 0) + 1,
          });
          if (!error) {
            await saveMoment(
              bestMatch.id, userId, couple?.id ?? null,
              cloudUrl, photo.latitude, photo.longitude,
              new Date(photo.asset.creationTime).toISOString(),
            );
            matchCount++;
          } else {
            lastError = error;
          }
        } else {
          const date = new Date(photo.asset.creationTime).toLocaleDateString('zh-TW');
          const { error } = await savePlace(userId, couple?.id ?? null, {
            name: `📸 ${date}`,
            category: 'other',
            lat: photo.latitude,
            lng: photo.longitude,
            image_url: cloudUrl,
          });
          if (!error) newCount++;
          else lastError = error;
        }
      }

      const total = newCount + matchCount;
      if (total > 0) {
        setSelected(new Set());
        setPhotos([]);
        const parts: string[] = [];
        if (newCount > 0) parts.push(`✅ ${newCount} 個新地點`);
        if (matchCount > 0) parts.push(`🗺 ${matchCount} 個想去地點已更新`);
        Alert.alert('匯入完成', parts.join('　'), [
          { text: '前往地圖', onPress: () => navigation.navigate('Map') },
        ]);
      } else {
        Alert.alert('匯入失敗', `錯誤：${JSON.stringify(lastError)}`);
      }
    } finally {
      setImporting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#5C7A5F" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>🖼️</Text>
        <Text style={styles.title}>需要相簿權限</Text>
        <Text style={styles.hint}>Twogether 需要讀取你的照片，才能取得拍攝地點</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>允許存取相簿</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>同步相簿</Text>
        <Text style={styles.headerSub}>掃描全部照片，找出有 GPS 位置的</Text>
      </View>

      {photos.length === 0 && !scanning && (
        <View style={styles.center}>
          <Text style={styles.icon}>📍</Text>
          <Text style={styles.title}>尋找有地點的照片</Text>
          <Text style={styles.hint}>只有開啟定位的照片才會顯示</Text>
          <TouchableOpacity style={styles.btn} onPress={scanPhotos}>
            <Text style={styles.btnText}>開始掃描</Text>
          </TouchableOpacity>
        </View>
      )}

      {scanning && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5C7A5F" />
          <Text style={styles.scanningText}>{scanProgress || '掃描中...'}</Text>
        </View>
      )}

      {!scanning && photos.length > 0 && (
        <>
          <Text style={styles.found}>找到 {photos.length} 張有位置的照片</Text>
          <FlatList
            data={photos}
            keyExtractor={item => item.asset.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => {
              const isSelected = selected.has(item.asset.id);
              return (
                <TouchableOpacity
                  style={[styles.thumb, isSelected && styles.thumbSelected]}
                  onPress={() => toggleSelect(item.asset.id)}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: item.localUri }} style={styles.thumbImg} />
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={styles.rescanBtn} onPress={scanPhotos}>
              <Text style={styles.rescanText}>重新掃描</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importBtn, (selected.size === 0 || importing) && styles.importBtnDisabled]}
              onPress={handleImport}
              disabled={selected.size === 0 || importing}
            >
              {importing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.importText}>匯入 {selected.size} 張</Text>
              }
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#2D2A26' },
  headerSub: { fontSize: 13, color: '#8A8070', marginTop: 4 },
  icon: { fontSize: 48 },
  title: { fontSize: 17, fontWeight: '600', color: '#2D2A26', textAlign: 'center' },
  hint: { fontSize: 13, color: '#8A8070', textAlign: 'center' },
  btn: {
    backgroundColor: '#5C7A5F', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 28, marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  scanningText: { fontSize: 14, color: '#8A8070', marginTop: 12 },
  found: { fontSize: 13, color: '#8A8070', paddingHorizontal: 16, paddingVertical: 8 },
  grid: { paddingHorizontal: 4, paddingBottom: 100 },
  thumb: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbSelected: { borderColor: '#5C7A5F' },
  thumbImg: { width: '100%', height: '100%' },
  checkmark: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22,
    backgroundColor: '#5C7A5F',
    borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  checkmarkText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10,
    padding: 16, paddingBottom: 24,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1, borderTopColor: '#E0D9CE',
  },
  rescanBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', backgroundColor: '#F0EBE3',
  },
  rescanText: { fontSize: 14, color: '#5C7A5F', fontWeight: '600' },
  importBtn: {
    flex: 2, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', backgroundColor: '#5C7A5F',
  },
  importBtnDisabled: { backgroundColor: '#B0BDB1' },
  importText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
