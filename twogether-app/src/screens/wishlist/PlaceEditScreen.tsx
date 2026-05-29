import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { updatePlace } from '../../lib/supabase';
import { geocodePlaceName } from '../../lib/geocode';
import type { Place } from '../../types';

type Category = Place['category'];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'food', label: '🍜 食物' },
  { value: 'cafe', label: '☕ 咖啡' },
  { value: 'attraction', label: '🏛️ 景點' },
  { value: 'accommodation', label: '🛏️ 住宿' },
  { value: 'other', label: '📍 其他' },
];

export default function PlaceEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const place = route.params.place as Place;

  const [name, setName] = useState(place.name);
  const [category, setCategory] = useState<Category>(place.category);
  const [address, setAddress] = useState(place.address ?? '');
  const [note, setNote] = useState(place.note ?? '');
  const [visited, setVisited] = useState(place.visited);
  const [reLocate, setReLocate] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('請填寫地點名稱');
      return;
    }
    setSaving(true);
    try {
      const fields: Parameters<typeof updatePlace>[1] = {
        name: name.trim(),
        category,
        address: address.trim() || null,
        note: note.trim() || null,
        visited,
        status: visited ? 'visited' : 'want-to-go',
      };

      // Re-geocode only when the user asks for it (e.g. to fix a wrong pin).
      if (reLocate) {
        const coords = await geocodePlaceName(name.trim(), address.trim() || null);
        if (coords) {
          fields.lat = coords.lat;
          fields.lng = coords.lng;
        } else {
          Alert.alert('找不到座標', '無法依名稱與地址重新定位，將保留原本的位置。');
        }
      }

      const { error } = await updatePlace(place.id, fields);
      if (error) throw error;
      navigation.goBack();
    } catch (e) {
      Alert.alert('儲存失敗', String(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>編輯地點</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} disabled={saving}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>地點名稱</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="地點名稱" />

          <Text style={styles.label}>分類</Text>
          <View style={styles.row}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, category === c.value && styles.chipActive]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>狀態</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, visited && styles.chipActive]}
              onPress={() => setVisited(true)}
            >
              <Text style={[styles.chipText, visited && styles.chipTextActive]}>去過</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, !visited && styles.chipActive]}
              onPress={() => setVisited(false)}
            >
              <Text style={[styles.chipText, !visited && styles.chipTextActive]}>想去</Text>
            </TouchableOpacity>
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
            style={[styles.chip, styles.reLocateChip, reLocate && styles.chipActive]}
            onPress={() => setReLocate(v => !v)}
          >
            <Text style={[styles.chipText, reLocate && styles.chipTextActive]}>
              {reLocate ? '✓ ' : ''}儲存時依名稱與地址重新定位
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>儲存</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  form: { padding: 20, paddingBottom: 60, gap: 6 },
  label: { fontSize: 13, color: '#8A8070', fontWeight: '600', marginTop: 12 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0D9CE',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: '#2D2A26',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F0EBE3',
  },
  chipActive: { backgroundColor: '#5C7A5F' },
  chipText: { fontSize: 13, color: '#8A8070' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  reLocateChip: { marginTop: 20, alignSelf: 'flex-start' },
  saveBtn: {
    backgroundColor: '#5C7A5F', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
