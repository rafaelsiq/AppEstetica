import React, { useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import StackNavigator from './StackNavigator';
import { useFonts } from 'expo-font';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Family': require('./src/assets/fonts/Family/Family.otf'),
  });
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }
  return (
    <NavigationContainer>
      <StackNavigator />
      <StatusBar style='dark' />
    </NavigationContainer>
  );
}