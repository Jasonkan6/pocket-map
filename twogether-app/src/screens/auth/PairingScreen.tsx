import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { createCouple, joinCouple } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function PairingScreen() {
  const { profile, loadProfile } = useAuthStore();
  const [inviteCode, setInviteCode] = useState('');
  const [myCode, setMyCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateInvite() {
    if (!profile) return;
    setLoading(true);
    try {
      const { couple, error } = await createCouple(profile.id);
      if (error || !couple) {
        Alert.alert('Error', String(error));
        return;
      }
      setMyCode(couple.invite_code);
      await loadProfile(profile.id);
    } finally {
      setLoading(false);
    }
  }

  async function handleShareCode() {
    if (!myCode) return;
    await Share.share({
      message: `用這個邀請碼加入 Twogether：${myCode}`,
    });
  }

  async function handleJoin() {
    if (!profile || !inviteCode) return;
    setLoading(true);
    try {
      const { couple, error } = await joinCouple(profile.id, inviteCode);
      if (error || !couple) {
        Alert.alert('配對失敗', String(error));
        return;
      }
      await loadProfile(profile.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>配對你們兩個</Text>
      <Text style={styles.subtitle}>一個人產生邀請碼，另一個人輸入</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>我來產生邀請碼</Text>
        {myCode ? (
          <>
            <View style={styles.codeBox}>
              <Text style={styles.code}>{myCode}</Text>
            </View>
            <TouchableOpacity style={styles.button} onPress={handleShareCode}>
              <Text style={styles.buttonText}>分享給對方</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleCreateInvite} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>產生邀請碼</Text>}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>或</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>我輸入對方的邀請碼</Text>
        <TextInput
          style={styles.input}
          placeholder="6 位邀請碼"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading || !inviteCode}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>配對</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8', padding: 32 },
  title: { fontSize: 28, fontWeight: '700', color: '#2D2A26', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8A8070', marginBottom: 32 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#2D2A26' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0D9CE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    color: '#2D2A26',
  },
  button: {
    backgroundColor: '#5C7A5F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  codeBox: {
    backgroundColor: '#EEF3EF',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  code: { fontSize: 32, fontWeight: '700', color: '#5C7A5F', letterSpacing: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0D9CE' },
  dividerText: { color: '#8A8070', fontSize: 14 },
});
