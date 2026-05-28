import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { extractPlaceFromScreenshot } from '../../lib/gemini';
import { geocodePlaceName } from '../../lib/geocode';
import { savePlace, uploadScreenshot } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Place } from '../../types';

type Step = 'pick' | 'analyzing' | 'review' | 'saving';
type Category = Place['category'];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'food', label: '🍜 食物' },
  { value: 'cafe', label: '☕ 咖啡' },
  { value: 'attraction', label: '🏛️ 景點' },
  { value: 'accommodation', label: '🛏️ 住宿' },
  { value: 'other', label: '📍 其他' },
];

// Center of Taiwan — used when geocoding finds nothing so the pin still appears.
const FALLBACK_COORDS = { lat: 23.5, lng: 121.0 };

export default function WishlistAddScreen() {
  const navigation = useNavigation<any>();
  const { profile, couple, session } = useAuthStore();

  const [step, setStep] = useState<Step>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [region, setRegion] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  async function pickAndAnalyze() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相簿權限', '請在設定中允許 Twogether 讀取相片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const picked = result.assets[0].uri;
    setStep('analyzing');

    try {
      // Resize before sending to Gemini / uploading — keeps payload small.
      const manipulated = await ImageManipulator.manipulateAsync(
        picked,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      setImageUri(manipulated.uri);
      setImageBase64(manipulated.base64!);

      const info = await extractPlaceFromScreenshot(manipulated.base64!);
      setName(info.name ?? '');
      setCategory(info.category ?? 'other');
      setRegion(info.region ?? null);
      setAddress(info.address ?? '');
      setNote(info.note ?? '');
      setStep('review');
    } catch (e) {
      Alert.alert('AI 分析失敗', String(e));
      setStep('pick');
    }
  }

  async function handleSave() {
    const userId = profile?.id ?? session?.user?.id;
    if (!userId || !imageBase64) return;
    if (!name.trim()) {
      Alert.alert('請填寫地點名稱');
      return;
    }

    setStep('saving');
    try {
      const imageUrl = await uploadScreenshot(userId, imageBase64);
      const coords = await geocodePlaceName(name.trim(), address.trim() || null);

      if (!coords) {
        Alert.alert('找不到座標', '這個地點暫時無法定位，會先標在台灣中心，你之後可以再調整。');
      }

      const { error } = await savePlace(userId, couple?.id ?? null, {
        name: name.trim(),
        category,
        lat: (coords ?? FALLBACK_COORDS).lat,
        lng: (coords ?? FALLBACK_COORDS).lng,
        region: region ?? undefined,
        address: address.trim() || undefined,
        note: note.trim() || undefined,
        image_url: imageUrl,
        visited: false,
        status: 'want-to-go',
        source_type: 'screenshot',
      });

      if (error) throw error;
      navigation.goBack();
    } catch (e) {
      Alert.alert('儲存失敗', String(e));
      setStep('review');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新增想去地點</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {step === 'pick' && (
        <View style={styles.centered}>
          <Text style={styles.bigEmoji}>📷</Text>
          <Text style={styles.hint}>
            選一張 Instagram、Threads 或地圖的截圖，{'\n'}AI 會自動辨識地點資訊。
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={pickAndAnalyze}>
            <Text style={styles.primaryBtnText}>選擇截圖</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'analyzing' && (
        <View style={styles.centered}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />}
          <ActivityIndicator size="large" color="#5C7A5F" style={{ marginTop: 24 }} />
          <Text style={styles.hint}>AI 分析中…</Text>
        </View>
      )}

      {(step === 'review' || step === 'saving') && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />}

            <Text style={styles.label}>地點名稱</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="地點名稱" />

            <Text style={styles.label}>分類</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.catChip, category === c.value && styles.catChipActive]}
                  onPress={() => setCategory(c.value)}
                >
                  <Text style={[styles.catText, category === c.value && styles.catTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>地址</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="地址（選填）" />

            <Text style={styles.label}>備註</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={note}
              onChangeText={setNote}
              placeholder="備註（選填）"
              multiline
            />

            <TouchableOpacity
              style={[styles.primaryBtn, styles.saveBtn]}
              onPress={handleSave}
              disabled={step === 'saving'}
            >
              {step === 'saving'
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>儲存為想去地點</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  bigEmoji: { fontSize: 56 },
  hint: { fontSize: 14, color: '#8A8070', textAlign: 'center', lineHeight: 22, marginTop: 8 },
  primaryBtn: {
    backgroundColor: '#5C7A5F', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', marginTop: 8,
  },
  saveBtn: { marginTop: 24 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  preview: {
    width: '100%', height: 220, borderRadius: 12,
    backgroundColor: '#EEF3EF',
  },
  form: { padding: 20, paddingBottom: 60, gap: 6 },
  label: { fontSize: 13, color: '#8A8070', fontWeight: '600', marginTop: 12 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0D9CE',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: '#2D2A26',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F0EBE3',
  },
  catChipActive: { backgroundColor: '#5C7A5F' },
  catText: { fontSize: 13, color: '#8A8070' },
  catTextActive: { color: '#fff', fontWeight: '600' },
});
