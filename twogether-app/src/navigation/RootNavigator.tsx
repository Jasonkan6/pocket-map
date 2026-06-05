import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import LoginScreen from '../screens/auth/LoginScreen';
import PairingScreen from '../screens/auth/PairingScreen';
import TabNavigator from './TabNavigator';
import WishlistAddScreen from '../screens/wishlist/WishlistAddScreen';
import PlaceEditScreen from '../screens/wishlist/PlaceEditScreen';
import AddVisitPhotoScreen from '../screens/wishlist/AddVisitPhotoScreen';
import type { Place } from '../types';

export type RootStackParamList = {
  Login: undefined;
  Pairing: undefined;
  Main: undefined;
  WishlistAdd: undefined;
  PlaceEdit: { place: Place };
  AddVisitPhoto: { place: Place };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { session, couple, isLoading, skippedPairing, setSession, loadProfile } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF8' }}>
        <ActivityIndicator size="large" color="#5C7A5F" />
      </View>
    );
  }

  const showMain = !!session && (!!couple || skippedPairing);
  const showPairing = !!session && !couple && !skippedPairing;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : showPairing ? (
        <Stack.Screen name="Pairing" component={PairingScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen
            name="WishlistAdd"
            component={WishlistAddScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="PlaceEdit"
            component={PlaceEditScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="AddVisitPhoto"
            component={AddVisitPhotoScreen}
            options={{ presentation: 'modal' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
