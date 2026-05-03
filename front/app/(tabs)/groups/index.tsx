import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

// ─── Modal Crear Grupo ────────────────────────────────────────────────────────

function CreateGroupModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'El nombre es obligatorio' });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data } = await groupsApi.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(data.data);
      setName('');
      setDescription('');
      onClose();
      Toast.show({ type: 'success', text1: '¡Grupo creado!' });
    } catch {
      Toast.show({ type: 'error', text1: 'No se pudo crear el grupo' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={modalStyles.sheet}
      >
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>Nuevo grupo</Text>

        <Text style={modalStyles.label}>Nombre *</Text>
        <TextInput
          style={modalStyles.input}
          placeholder="Ej. Matemáticas 2024"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
          maxLength={80}
          autoFocus
        />

        <Text style={modalStyles.label}>Descripción (opcional)</Text>
        <TextInput
          style={[modalStyles.input, modalStyles.textarea]}
          placeholder="¿De qué trata el grupo?"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          maxLength={300}
          multiline
          numberOfLines={3}
        />

        <View style={modalStyles.actions}>
          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
            <Text style={modalStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.createBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={modalStyles.createText}>Crear</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  const [showCreate, setShowCreate] = useState(false);

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
    } catch (err: any) {
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

  const handleGroupCreated = (group: Group) => {
    setGroups((prev) => [{ ...group, is_member: true }, ...prev]);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FACC15" />
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
            colors={['#FACC15']}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>Aún no hay grupos</Text>
            <Text style={styles.emptyHint}>Crea uno con el botón +</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <CreateGroupModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleGroupCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchWrapper: { padding: 16, paddingBottom: 0 },
  searchInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F9FAFB',
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#2A2000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupName: { fontWeight: '700', fontSize: 16, color: '#F9FAFB' },
  groupDesc: { color: '#6B7280', fontSize: 13, marginTop: 2 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: { color: '#9CA3AF', fontSize: 13 },
  joinBtn: {
    backgroundColor: '#FACC15',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leaveBtn: { backgroundColor: '#FEE2E2' },
  joinBtnText: { color: '#0F0F0F', fontWeight: '600', fontSize: 13 },
  leaveBtnText: { color: '#DC2626' },
  hint: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2D2D2D' },
  hintText: { color: '#6366F1', fontSize: 12, fontWeight: '500' },
  offlineBanner: { backgroundColor: '#FEF3C7', padding: 10, alignItems: 'center' },
  offlineText: { color: '#92400E', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 80, gap: 6 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#374151', fontSize: 17, fontWeight: '600' },
  emptyHint: { color: '#9CA3AF', fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FACC15',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FACC15',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabIcon: { color: '#0F0F0F', fontSize: 28, lineHeight: 32, fontWeight: '300' },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2D2D2D',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#F9FAFB', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginTop: 8 },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F9FAFB',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
  },
  cancelText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  createBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FACC15',
    alignItems: 'center',
  },
  createText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },
});
