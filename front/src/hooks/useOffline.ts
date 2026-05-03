import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useOffline() {
  const [isOffline, setIsOffline] = useState(false);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    // Comprobación inicial
    NetInfo.fetch().then(handleState);

    // Suscripción a cambios
    const unsubscribe = NetInfo.addEventListener(handleState);
    return unsubscribe;
  }, []);

  function handleState(state: NetInfoState) {
    // Solo usamos isConnected. isInternetReachable hace ping a Google y falla
    // en emuladores y redes locales aunque la API sea accesible.
    const offline = state.isConnected === false;
    setIsOffline(offline);
    setConnectionType(state.type);
  }

  return { isOffline, connectionType };
}
