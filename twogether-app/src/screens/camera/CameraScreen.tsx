import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Placeholder — full implementation in Stage 2 (B1 GPS photo)
export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>📷</Text>
      <Text style={styles.label}>拍照功能</Text>
      <Text style={styles.hint}>Stage 2 實作（GPS 拍照）</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' },
  text: { fontSize: 64, marginBottom: 12 },
  label: { fontSize: 20, fontWeight: '600', color: '#fff' },
  hint: { fontSize: 14, color: '#888', marginTop: 8 },
});
