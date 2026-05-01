import {
  View,
  Text,
  FlatList,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@context/AuthContext';
import { groupsApi } from '@api/groups';
import { getCached, setCached } from '@store/cache';
import { STORAGE_KEYS } from '@utils/constants';
import { useOffline } from '@hooks/useOffline';
import type { Group, CreateGroupRequest } from '@/types';
import Toast from 'react-native-toast-message';

// ─── Mock data para desarrollo sin API ───────────────────────────────────────

const MOCK_MY_GROUPS: Group[] = [
  {
    id: '1', name: 'Matemáticas Avanzadas', description: 'Álgebra, cálculo y más',
    member_count: 24, question_count: 12, is_member: true,
    created_by: 'me', created_at: '', updated_at: '',
  },
  {
    id: '2', name: 'Historia Universal', description: 'De la antigüedad al presente',
    member_count: 18, question_count: 8, is_member: true,
    created_by: 'me', created_at: '', updated_at: '',
  },
];

const MOCK_ALL_GROUPS: Group[] = [
  ...MOCK_MY_GROUPS,
  {
    id: '3', name: 'Programación Web', description: 'HTML, CSS, JavaScript y frameworks',
    member_count: 57, question_count: 34, is_member: false,
    created_by: 'other', created_at: '', updated_at: '',
  },
  {
    id: '4', name: 'Biología Molecular', description: 'Genética, proteínas y ADN',
    member_count: 31, question_count: 21, is_member: false,
    created_by: 'other', created_at: '', updated_at: '',
  },
  {
    id: '5', name: 'Filosofía y Ética', description: 'Debates y reflexiones profundas',
    member_count: 14, question_count: 6, is_member: false,
    created_by: 'other', created_at: '', updated_at: '',
  },
];

// ─── Constante de modo dev ────────────────────────────────────────────────────

const USE_MOCK = true; // ← cambia a false cuando la API esté lista

// ─── Colores de grupos (cíclicos) ─────────────────────────────────────────────

const GROUP_COLORS = [
  '#EEF2FF', '#FEF3C7', '#ECFDF5', '#FEE2E2', '#EDE9FE',
  '#E0F2FE', '#FCE7F3',
];
const GROUP_ICON_COLORS = [
  '#4F46E5', '#D97706', '#059669', '#DC2626', '#7C3AED',
  '#0284C7', '#DB2777',
];

function groupColor(index: number) {
  return {
    bg: GROUP_COLORS[index % GROUP_COLORS.length],
    fg: GROUP_ICON_COLORS[index % GROUP_ICON_COLORS.length],
  };
}

// ─── Tarjeta de grupo (mis grupos) ───────────────────────────────────────────

function MyGroupCard({
  item,
  index,
  onLeave,
}: {
  item: Group;
  index: number;
  onLeave: (id: string, name: string) => void;
}) {
  const { bg, fg } = groupColor(index);
  return (
    <TouchableOpacity
      style={styles.myGroupCard}
      onLongPress={() => onLeave(item.id, item.name)}
      activeOpacity={0.85}
    >
      <View style={[styles.myGroupIcon, { backgroundColor: bg }]}>
        <Text style={[styles.myGroupLetter, { color: fg }]}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.myGroupName} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.myGroupMeta}>
        {item.member_count} miembros
      </Text>
      <View style={styles.myGroupQuestions}>
        <Text style={[styles.myGroupQCount, { color: fg }]}>
          {item.question_count}
        </Text>
        <Text style={styles.myGroupQLabel}>preguntas</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Tarjeta de grupo (explorar) ──────────────────────────────────────────────

function ExploreGroupCard({
  item,
  index,
  onJoin,
}: {
  item: Group;
  index: number;
  onJoin: (id: string) => void;
}) {
  const { bg, fg } = groupColor(index);
  return (
    <View style={styles.exploreCard}>
      <View style={[styles.exploreIcon, { backgroundColor: bg }]}>
        <Text style={[styles.exploreLetter, { color: fg }]}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.exploreInfo}>
        <Text style={styles.exploreName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.exploreDesc} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.exploreMeta}>
          👤 {item.member_count} · 💬 {item.question_count} preguntas
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.joinBtn, { backgroundColor: fg }]}
        onPress={() => onJoin(item.id)}
      >
        <Text style={styles.joinBtnText}>Unirse</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Modal crear grupo ────────────────────────────────────────────────────────

function CreateGroupModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: CreateGroupRequest) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Crear grupo</Text>

          <Text style={styles.modalLabel}>Nombre *</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Ej: Matemáticas 2026"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            maxLength={60}
          />

          <Text style={styles.modalLabel}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.modalInput, styles.modalTextarea]}
            placeholder="¿De qué trata este grupo?"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCreate, (!name.trim() || isLoading) && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalCreateText}>Crear</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuth();
  const { isOffline } = useOffline();

  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [exploreGroups, setExploreGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // ── Carga ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (USE_MOCK) {
      setMyGroups(MOCK_MY_GROUPS);
      setExploreGroups(MOCK_ALL_GROUPS.filter((g) => !g.is_member));
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (isOffline) {
      const cached = await getCached<Group[]>(STORAGE_KEYS.GROUPS_CACHE);
      if (cached) {
        setMyGroups(cached.filter((g) => g.is_member));
        setExploreGroups(cached.filter((g) => !g.is_member));
      }
      setIsLoading(false);
      return;
    }

    try {
      const [myRes, allRes] = await Promise.all([
        groupsApi.getMyGroups(),
        groupsApi.getAllGroups(),
      ]);
      const mine = myRes.data.items;
      const all = allRes.data.items;
      const myIds = new Set(mine.map((g) => g.id));
      setMyGroups(mine);
      setExploreGroups(all.filter((g) => !myIds.has(g.id)));
      await setCached(STORAGE_KEYS.GROUPS_CACHE, all);
    } catch {
      const cached = await getCached<Group[]>(STORAGE_KEYS.GROUPS_CACHE);
      if (cached) {
        setMyGroups(cached.filter((g) => g.is_member));
        setExploreGroups(cached.filter((g) => !g.is_member));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isOffline]);

  useEffect(() => { loadData(); }, []);

  const handleSearch = useCallback(async (text: string) => {
    setSearch(text);
    if (!text.trim()) { loadData(); return; }
    if (USE_MOCK) {
      const q = text.toLowerCase();
      setExploreGroups(MOCK_ALL_GROUPS.filter(
        (g) => !g.is_member && g.name.toLowerCase().includes(q)
      ));
      return;
    }
    try {
      const { data } = await groupsApi.searchGroups(text);
      const myIds = new Set(myGroups.map((g) => g.id));
      setExploreGroups(data.items.filter((g) => !myIds.has(g.id)));
    } catch {
      Toast.show({ type: 'error', text1: 'Error al buscar' });
    }
  }, [myGroups, loadData]);

  // ── Unirse ───────────────────────────────────────────────────────────────

  const handleJoin = async (groupId: string) => {
    const group = exploreGroups.find((g) => g.id === groupId);
    if (!group) return;

    if (USE_MOCK) {
      setMyGroups((prev) => [...prev, { ...group, is_member: true }]);
      setExploreGroups((prev) => prev.filter((g) => g.id !== groupId));
      Toast.show({ type: 'success', text1: `Te uniste a "${group.name}"` });
      return;
    }

    try {
      await groupsApi.joinGroup(groupId);
      setMyGroups((prev) => [...prev, { ...group, is_member: true }]);
      setExploreGroups((prev) => prev.filter((g) => g.id !== groupId));
      Toast.show({ type: 'success', text1: `Te uniste a "${group.name}"` });
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: (err as { message?: string })?.message ?? 'No se pudo unir al grupo',
      });
    }
  };

  // ── Salir (pulsación larga) ───────────────────────────────────────────────

  const handleLeave = (groupId: string, groupName: string) => {
    Alert.alert(
      'Salir del grupo',
      `¿Salir de "${groupName}"? Perderás acceso a sus preguntas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            if (USE_MOCK) {
              const group = myGroups.find((g) => g.id === groupId)!;
              setMyGroups((prev) => prev.filter((g) => g.id !== groupId));
              setExploreGroups((prev) => [...prev, { ...group, is_member: false }]);
              return;
            }
            try {
              await groupsApi.leaveGroup(groupId);
              const group = myGroups.find((g) => g.id === groupId)!;
              setMyGroups((prev) => prev.filter((g) => g.id !== groupId));
              setExploreGroups((prev) => [...prev, { ...group, is_member: false }]);
            } catch {
              Toast.show({ type: 'error', text1: 'No se pudo salir del grupo' });
            }
          },
        },
      ],
    );
  };

  // ── Crear grupo ───────────────────────────────────────────────────────────

  const handleCreate = async (data: CreateGroupRequest) => {
    if (USE_MOCK) {
      const newGroup: Group = {
        id: String(Date.now()), ...data,
        member_count: 1, question_count: 0,
        is_member: true, created_by: user?.id ?? 'me',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      setMyGroups((prev) => [newGroup, ...prev]);
      Toast.show({ type: 'success', text1: `Grupo "${data.name}" creado` });
      return;
    }
    const res = await groupsApi.createGroup(data);
    setMyGroups((prev) => [res.data, ...prev]);
    Toast.show({ type: 'success', text1: `Grupo "${data.name}" creado` });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const firstName = user?.name?.split(' ')[0] ?? 'ahí';

  return (
    <View style={styles.container}>
      {/* Banner offline */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 Sin conexión — datos guardados</Text>
        </View>
      )}

      <FlatList
        data={[]}
        keyExtractor={() => 'dummy'}
        renderItem={null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { setIsRefreshing(true); loadData(); }}
            colors={['#4F46E5']}
          />
        }
        ListHeaderComponent={
          <View>
            {/* ── Header saludo ─────────────────────────────────────── */}
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>{greeting()},</Text>
                <Text style={styles.userName}>{firstName} 👋</Text>
              </View>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => setShowCreate(true)}
              >
                <Text style={styles.createBtnText}>+ Nuevo grupo</Text>
              </TouchableOpacity>
            </View>

            {/* ── Mis grupos ────────────────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Mis grupos</Text>
                <Text style={styles.sectionCount}>{myGroups.length}</Text>
              </View>

              {myGroups.length === 0 ? (
                <View style={styles.emptyGroups}>
                  <Text style={styles.emptyIcon}>🏘️</Text>
                  <Text style={styles.emptyTitle}>Aún no perteneces a ningún grupo</Text>
                  <Text style={styles.emptySubtitle}>Únete a uno desde "Explorar" abajo</Text>
                </View>
              ) : (
                <FlatList
                  data={myGroups}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.myGroupsList}
                  renderItem={({ item, index }) => (
                    <MyGroupCard
                      item={item}
                      index={index}
                      onLeave={handleLeave}
                    />
                  )}
                />
              )}
            </View>

            {/* ── Explorar grupos ───────────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Explorar grupos</Text>
                <Text style={styles.sectionCount}>{exploreGroups.length}</Text>
              </View>

              {/* Barra de búsqueda */}
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar grupos..."
                  placeholderTextColor="#9CA3AF"
                  value={search}
                  onChangeText={handleSearch}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => handleSearch('')}>
                    <Text style={styles.clearSearch}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={{ paddingBottom: 32 }}>
            {exploreGroups.length === 0 ? (
              <View style={styles.emptyExplore}>
                <Text style={styles.emptyIcon}>🔎</Text>
                <Text style={styles.emptyTitle}>
                  {search ? 'Sin resultados' : 'No hay más grupos disponibles'}
                </Text>
              </View>
            ) : (
              exploreGroups.map((item, index) => (
                <ExploreGroupCard
                  key={item.id}
                  item={item}
                  index={index}
                  onJoin={handleJoin}
                />
              ))
            )}
          </View>
        }
        style={styles.scroll}
      />

      {/* Modal crear grupo */}
      <CreateGroupModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Banner offline
  offlineBanner: {
    backgroundColor: '#FEF3C7', padding: 10, alignItems: 'center',
  },
  offlineText: { color: '#92400E', fontSize: 13 },

  // Header saludo
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
  },
  greeting: { fontSize: 14, color: '#6B7280' },
  userName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  createBtn: {
    backgroundColor: '#4F46E5', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Sección
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  sectionCount: {
    marginLeft: 8, backgroundColor: '#E0E7FF',
    color: '#4F46E5', fontWeight: '700', fontSize: 12,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },

  // Mis grupos — scroll horizontal
  myGroupsList: { paddingRight: 8, gap: 12 },
  myGroupCard: {
    width: 130, backgroundColor: '#fff', borderRadius: 18,
    padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  myGroupIcon: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  myGroupLetter: { fontSize: 24, fontWeight: '800' },
  myGroupName: {
    fontSize: 13, fontWeight: '700', color: '#111827',
    textAlign: 'center', marginBottom: 4,
  },
  myGroupMeta: { fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
  myGroupQuestions: { alignItems: 'center' },
  myGroupQCount: { fontSize: 20, fontWeight: '800' },
  myGroupQLabel: { fontSize: 10, color: '#9CA3AF' },

  // Grupos vacíos
  emptyGroups: {
    alignItems: 'center', paddingVertical: 28,
    backgroundColor: '#fff', borderRadius: 18,
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
  },
  emptyExplore: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  // Barra de búsqueda
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  clearSearch: { color: '#9CA3AF', fontSize: 16, paddingLeft: 8 },

  // Tarjeta explorar
  exploreCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 20, marginTop: 10, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  exploreIcon: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  exploreLetter: { fontSize: 20, fontWeight: '800' },
  exploreInfo: { flex: 1 },
  exploreName: { fontWeight: '700', fontSize: 14, color: '#111827' },
  exploreDesc: { color: '#6B7280', fontSize: 12, marginTop: 1 },
  exploreMeta: { color: '#9CA3AF', fontSize: 11, marginTop: 3 },
  joinBtn: {
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8,
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Modal crear grupo
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', marginBottom: 16,
  },
  modalTextarea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancel: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalCancelText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  modalCreate: {
    flex: 1, backgroundColor: '#4F46E5',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalCreateText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
});
