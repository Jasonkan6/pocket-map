import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { extractPlaceFromScreenshot } from '../../lib/gemini';
import { geocodePlaceName } from '../../lib/geocode';
import { savePlace, uploadScreenshot } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

// When geocoding fails, fall back to the centroid of the region Gemini detected
// (better than dropping every unresolved pin in the dead-center of Taiwan).
const REGION_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  north: { lat: 25.04, lng: 121.56 },
  central: { lat: 24.14, lng: 120.68 },
  south: { lat: 22.63, lng: 120.30 },
  east: { lat: 23.99, lng: 121.60 },
  unknown: { lat: 23.5, lng: 121.0 },
};

function fallbackCoords(region?: string) {
  return REGION_CENTROIDS[region ?? 'unknown'] ?? REGION_CENTROIDS.unknown;
}

export default function WishlistAddScreen() {
  const navigation = useNavigation<any>();
  const { profile, couple, session } = useAuthStore();

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [toastMsg, setToastMsg] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;

  function showToastAndExit(msg: string) {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => navigation.goBack());
  }

  async function pickAndSave() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相簿權限', '請在設定中允許 Twogether 讀取相片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled || !result.assets.length) return;

    const userId = profile?.id ?? session?.user?.id;
    if (!userId) return;

    const assets = result.assets;
    setProcessing(true);
    setProgress({ current: 0, total: assets.length });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < assets.length; i++) {
      setProgress({ current: i + 1, total: assets.length });
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          assets[i].uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );

        const info = await extractPlaceFromScreenshot(manipulated.base64!);
        const imageUrl = await uploadScreenshot(userId, manipulated.base64!);
        const geocoded = await geocodePlaceName(info.name, info.address || null);
        const coords = geocoded ?? fallbackCoords(info.region);
        console.log('[wishlist] photo', i + 1, '| geocoded:', geocoded ? `${geocoded.lat},${geocoded.lng}` : '❌ null → using centroid', coords);

        const { error } = await savePlace(userId, couple?.id ?? null, {
          name: info.name,
          category: info.category ?? 'other',
          lat: coords.lat,
          lng: coords.lng,
          region: info.region ?? undefined,
          address: info.address || undefined,
          note: info.note || undefined,
          image_url: imageUrl,
          visited: false,
          status: 'want-to-go',
          source_type: 'screenshot',
        });

        if (error) throw error;
        success++;
      } catch (e) {
        console.error(`Photo ${i + 1} failed:`, e);
        failed++;
      }
    }

    const msg = failed === 0
      ? `✅ 已新增 ${success} 個想去地點`
      : `✅ ${success} 個成功　❌ ${failed} 個無法辨識`;
    showToastAndExit(msg);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新增想去地點</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
          disabled={processing}
        >
          <Text style={[styles.closeText, processing && styles.disabled]}>✕</Text>
        </TouchableOpacity>
      </View>

      {!processing ? (
        <View style={styles.centered}>
          <Text style={styles.bigEmoji}>📷</Text>
          <Text style={styles.hint}>
            選一或多張 Instagram、Threads 截圖，{'\n'}AI 會自動辨識並加到想去清單。
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={pickAndSave}>
            <Text style={styles.primaryBtnText}>選擇截圖</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5C7A5F" />
          <Text style={styles.progressText}>
            正在分析第 {progress.current} / {progress.total} 張…
          </Text>
          <Text style={styles.hint}>請稍候，不要關閉此頁面</Text>
        </View>
      )}

      <Animated.View style={[
        styles.toast,
        {
          opacity: toastAnim,
          transform: [{
            translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
          }],
        },
      ]}>
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0EBE3',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#2D2A26' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 18, color: '#8A8070' },
  disabled: { opacity: 0.3 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  bigEmoji: { fontSize: 56 },
  hint: { fontSize: 14, color: '#8A8070', textAlign: 'center', lineHeight: 22 },
  primaryBtn: {
    backgroundColor: '#5C7A5F', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  progressText: { fontSize: 18, fontWeight: '600', color: '#2D2A26', marginTop: 16 },
  toast: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: '#2D2A26',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
