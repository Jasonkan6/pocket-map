import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { updatePlace, uploadScreenshot, saveMoment } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Place } from '../../types';

export default function AddVisitPhotoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const place: Place = route.params.place;
  const { profile, couple, session } = useAuthStore();
  const [saving, setSaving] = useState(false);

  async function pickAndSave() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相簿權限', '請在設定中允許 Twogether 讀取相片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;

    const userId = profile?.id ?? session?.user?.id;
    if (!userId) { Alert.alert('尚未登入'); return; }

    setSaving(true);
    try {
      let firstUrl: string | null = null;

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri, [], { compress: 0.85, base64: true },
        );
        const url = await uploadScreenshot(userId, compressed.base64!);
        if (i === 0) firstUrl = url;
        await saveMoment(
          place.id, userId, couple?.id ?? null,
          url, null, null,
          new Date().toISOString(),
        );
      }

      await updatePlace(place.id, {
        visited: true,
        status: 'visited',
        image_url: firstUrl ?? place.image_url,
        visit_count: (place.visit_count ?? 0) + 1,
      });

      Alert.alert('已加入！', `${result.assets.length} 張照片已儲存，地點標記為去過`, [
        { text: '確認', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('上傳失敗', String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>加入我的照片</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={styles.bigEmoji}>📷</Text>
        <Text style={styles.placeName}>{place.name}</Text>
        <Text style={styles.hint}>
          選你去過這裡拍的照片，{'\n'}照片會儲存到雲端，地點也會標為去過
        </Text>

        <TouchableOpacity style={styles.btn} onPress={pickAndSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>選擇照片</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
      </View>
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
  closeBtn: { padding: 4, width: 32 },
  closeText: { fontSize: 18, color: '#8A8070' },
  title: { fontSize: 17, fontWeight: '700', color: '#2D2A26' },
  spacer: { width: 32 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  bigEmoji: { fontSize: 56 },
  placeName: { fontSize: 18, fontWeight: '700', color: '#2D2A26', textAlign: 'center' },
  hint: { fontSize: 14, color: '#8A8070', textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: '#5C7A5F', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 40,
    alignItems: 'center', marginTop: 8, minWidth: 180,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { paddingVertical: 12 },
  cancelText: { fontSize: 14, color: '#8A8070' },
});
