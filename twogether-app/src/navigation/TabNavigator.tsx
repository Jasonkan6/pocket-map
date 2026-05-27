import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import MapScreen from '../screens/map/MapScreen';
import CameraScreen from '../screens/camera/CameraScreen';
import MemoriesScreen from '../screens/memories/MemoriesScreen';

const Tab = createBottomTabNavigator();

const icon = (label: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{label}</Text>;
  };

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FAFAF8',
          borderTopColor: '#E0D9CE',
        },
        tabBarActiveTintColor: '#5C7A5F',
        tabBarInactiveTintColor: '#8A8070',
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ title: '地圖', tabBarIcon: icon('🗺️') }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{ title: '拍照', tabBarIcon: icon('📷') }}
      />
      <Tab.Screen
        name="Memories"
        component={MemoriesScreen}
        options={{ title: '回憶', tabBarIcon: icon('🌿') }}
      />
    </Tab.Navigator>
  );
}
