import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { profileApi } from '@api/profile';

// Comportamiento global de notificaciones en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotifications(isAuthenticated = false) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotifications(isAuthenticated);

    // Listener cuando llega una notificación en foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notificación recibida:', notification);
      },
    );

    // Listener cuando el usuario toca la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notificación tocada:', response);
        // Aquí puedes navegar según response.notification.request.content.data
      },
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);

  async function registerForPushNotifications(authenticated: boolean) {
    // Skip push notifications on web for now
    if (Platform.OS === 'web') {
      return;
    }

    if (!Device.isDevice) {
      setError('Las notificaciones push requieren un dispositivo físico.');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      setError('No se otorgaron permisos para notificaciones push.');
      return;
    }

    // Obtén el Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    setExpoPushToken(token);

    // Registra el token en la API solo si el usuario está autenticado
    if (authenticated) {
      try {
        await profileApi.registerPushToken({
          push_token: token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
      } catch (e) {
        console.warn('No se pudo registrar el push token en la API:', e);
      }
    }

    // Android requiere canal de notificaciones
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F46E5',
      });
    }
  }

  return { expoPushToken, error };
}
