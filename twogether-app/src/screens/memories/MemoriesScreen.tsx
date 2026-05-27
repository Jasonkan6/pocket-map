import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Placeholder — full implementation in Stage 2 (photo gallery + bloom visualization)
export default function MemoriesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🌿</Text>
      <Text style={styles.label}>回憶</Text>
      <Text style={styles.hint}>Stage 2 實作（照片回顧）</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF8' },
  text: { fontSize: 64, marginBottom: 12 },
  label: { fontSize: 20, fontWeight: '600', color: '#2D2A26' },
  hint: { fontSize: 14, color: '#8A8070', marginTop: 8 },
});
