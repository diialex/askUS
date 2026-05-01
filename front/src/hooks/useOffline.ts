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
    setIsOffline(!state.isConnected || !state.isInternetReachable);
    setConnectionType(state.type);
  }

  return { isOffline, connectionType };
}
