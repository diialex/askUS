import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { AuthProvider } from '@context/AuthContext';
import { useAuth } from '@context/AuthContext';
import { useNotifications } from '@hooks/useNotifications';

// Componente interno para inicializar notificaciones (necesita estar dentro del árbol)
function NotificationsInit() {
  useNotifications();
  return null;
}

// Componente para mostrar pantalla de carga
function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  );
}

// Componente interno que usa el contexto de Auth
function RootLayoutContent() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <NotificationsInit />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}
