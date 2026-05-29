import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useProcessingStore } from '../../stores/processingStore';
import { useAuthStore } from '../../stores/authStore';

export default function WishlistAddScreen() {
  const navigation = useNavigation<any>();
  const { profile, couple, session } = useAuthStore();
  const enqueue = useProcessingStore(s => s.enqueue);

  async function pickAndEnqueue() {
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

    // Hand off to the background store and dismiss immediately.
    enqueue(result.assets, userId, couple?.id ?? null);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新增想去地點</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.centered}>
        <Text style={styles.bigEmoji}>📷</Text>
        <Text style={styles.hint}>
          選一或多張 Instagram、Threads 截圖，{'\n'}AI 會自動辨識並在背景加到想去清單。
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={pickAndEnqueue}>
          <Text style={styles.primaryBtnText}>選擇截圖</Text>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#2D2A26' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 18, color: '#8A8070' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  bigEmoji: { fontSize: 56 },
  hint: { fontSize: 14, color: '#8A8070', textAlign: 'center', lineHeight: 22 },
  primaryBtn: {
    backgroundColor: '#5C7A5F', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
