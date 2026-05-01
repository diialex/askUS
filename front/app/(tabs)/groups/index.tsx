import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { groupsApi } from '@api/groups';
import { getCached, setCached } from '@store/cache';
import { STORAGE_KEYS } from '@utils/constants';
import { useOffline } from '@hooks/useOffline';
import type { Group } from '@/types';
import Toast from 'react-native-toast-message';

// ─── Card de grupo ────────────────────────────────────────────────────────────

function GroupCard({
  item,
  onJoin,
  onLeave,
  onPress,
}: {
  item: Group;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => item.is_member && onPress(item.id)}
      activeOpacity={item.is_member ? 0.7 : 1}
    >
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.groupIcon}>
            <Text style={{ fontSize: 22 }}>👥</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.groupName}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.groupDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.memberCount}>👤 {item.member_count} miembros</Text>
          <TouchableOpacity
            style={[styles.joinBtn, item.is_member && styles.leaveBtn]}
            onPress={(e) => {
              e.stopPropagation();
              item.is_member ? onLeave(item.id) : onJoin(item.id);
            }}
          >
            <Text style={[styles.joinBtnText, item.is_member && styles.leaveBtnText]}>
              {item.is_member ? 'Salir' : 'Unirse'}
            </Text>
          </TouchableOpacity>
        </View>
        {item.is_member && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>Toca para ver preguntas →</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function GroupsScreen() {
  const router = useRouter();
  const { isOffline } = useOffline();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadGroups = useCallback(async () => {
    if (isOffline) {
      const cached = await getCached<Group[]>(STORAGE_KEYS.GROUPS_CACHE);
      if (cached) setGroups(cached);
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await groupsApi.getMyGroups();
      setGroups(data.data);
      await setCached(STORAGE_KEYS.GROUPS_CACHE, data.data);
    } catch {
      const cached = await getCached<Group[]>(STORAGE_KEYS.GROUPS_CACHE);
      if (cached) setGroups(cached);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isOffline]);

  useEffect(() => {
    loadGroups();
  }, []);

  const handleSearch = useCallback(
    async (text: string) => {
      setSearch(text);
      if (!text.trim()) {
        loadGroups();
        return;
      }
      try {
        const { data } = await groupsApi.searchGroups(text);
        setGroups(data.data);
      } catch {
        Toast.show({ type: 'error', text1: 'Error al buscar grupos' });
      }
    },
    [loadGroups],
  );

  const handleJoin = async (groupId: string) => {
    try {
      await groupsApi.joinGroup(groupId);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, is_member: true, member_count: g.member_count + 1 }
            : g,
        ),
      );
      Toast.show({ type: 'success', text1: '¡Te uniste al grupo!' });
    } catch {
      Toast.show({ type: 'error', text1: 'No se pudo unir al grupo' });
    }
  };

  const handleLeave = async (groupId: string) => {
    try {
      await groupsApi.leaveGroup(groupId);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, is_member: false, member_count: g.member_count - 1 }
            : g,
        ),
      );
      Toast.show({ type: 'success', text1: 'Saliste del grupo' });
    } catch {
      Toast.show({ type: 'error', text1: 'No se pudo salir del grupo' });
    }
  };

  const handleSelectGroup = (groupId: string) => {
    router.push(`/(tabs)/groups/${groupId}`);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 Sin conexión — mostrando datos guardados</Text>
        </View>
      )}
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar grupos..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={handleSearch}
        />
      </View>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupCard
            item={item}
            onJoin={handleJoin}
            onLeave={handleLeave}
            onPress={handleSelectGroup}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadGroups();
            }}
            colors={['#4F46E5']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay grupos disponibles</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchWrapper: { padding: 16, paddingBottom: 0 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', marginBottom: 12 },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupName: { fontWeight: '700', fontSize: 16, color: '#111827' },
  groupDesc: { color: '#6B7280', fontSize: 13, marginTop: 2 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: { color: '#9CA3AF', fontSize: 13 },
  joinBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leaveBtn: { backgroundColor: '#FEE2E2' },
  joinBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  leaveBtnText: { color: '#DC2626' },
  hint: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  hintText: { color: '#6366F1', fontSize: 12, fontWeight: '500' },
  offlineBanner: { backgroundColor: '#FEF3C7', padding: 10, alignItems: 'center' },
  offlineText: { color: '#92400E', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
});
