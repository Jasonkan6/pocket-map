import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { getPlaces } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Place } from '../../types';
import PlaceDetailSheet from '../../components/PlaceDetailSheet';

const BLOOM_COLORS: Record<number, string> = {
  0: '#C4B8A8',
  1: '#A8C4A2',
  2: '#7AAF74',
  3: '#4E9647',
  4: '#2D7A26',
  5: '#1A5C14',
};

export default function MapScreen() {
  const { couple } = useAuthStore();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Place | null>(null);

  const loadPlaces = useCallback(async () => {
    if (!couple) return;
    try {
      const data = await getPlaces(couple.id);
      setPlaces(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [couple]);

  useFocusEffect(
    useCallback(() => {
      loadPlaces();
    }, [loadPlaces])
  );

  if (!couple) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>配對後才能看到地圖</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5C7A5F" />
      </View>
    );
  }

  const initialRegion: Region = places.length > 0
    ? { latitude: places[0].lat, longitude: places[0].lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 25.0478, longitude: 121.5319, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion} showsUserLocation>
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            pinColor={BLOOM_COLORS[place.bloom_level]}
            onPress={() => setSelected(place)}
          />
        ))}
      </MapView>

      {selected && (
        <PlaceDetailSheet place={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF8' },
  hint: { color: '#8A8070', fontSize: 15 },
});
