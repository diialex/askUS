import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useOffline } from '@hooks/useOffline';
import { questionsApi } from '@api/questions';
import { getCached, setCached } from '@store/cache';
import { STORAGE_KEYS } from '@utils/constants';
import type { Question } from '@/types';

// ─── Componente de pregunta ───────────────────────────────────────────────────

function QuestionCard({ item }: { item: Question }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.author.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.authorName}>{item.author.name}</Text>
          <Text style={styles.cardDate}>
            {new Date(item.created_at).toLocaleDateString('es-ES')}
          </Text>
        </View>
        <View style={[styles.badge, item.status === 'closed' && styles.badgeClosed]}>
          <Text style={styles.badgeText}>
            {item.status === 'open' ? 'Abierta' : 'Cerrada'}
          </Text>
        </View>
      </View>
      <Text style={styles.questionText}>{item.text}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.answerCount}>💬 {item.answer_count} respuestas</Text>
        {item.my_answer && (
          <Text style={styles.answered}>✅ Ya respondiste</Text>
        )}
      </View>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function QuestionsScreen() {
  const { isOffline } = useOffline();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Para demo: usa el primer grupo disponible. Adapta según tu flujo.
  const GROUP_ID = 'default';

  const loadQuestions = useCallback(
    async (reset = false) => {
      const currentPage = reset ? 1 : page;

      // Si está offline, intenta cargar desde caché
      if (isOffline) {
        const cached = await getCached<Question[]>(STORAGE_KEYS.QUESTIONS_CACHE);
        if (cached) setQuestions(cached);
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await questionsApi.getGroupQuestions(GROUP_ID, currentPage);
        const newItems = data.data;

        if (reset) {
          setQuestions(newItems);
          // Actualiza caché
          await setCached(STORAGE_KEYS.QUESTIONS_CACHE, newItems);
        } else {
          setQuestions((prev) => [...prev, ...newItems]);
        }

        setHasMore(data.meta.current_page < data.meta.last_page);
        setPage(currentPage + 1);
      } catch (err) {
        // Si falla, usa caché
        const cached = await getCached<Question[]>(STORAGE_KEYS.QUESTIONS_CACHE);
        if (cached && reset) setQuestions(cached);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isOffline, page, GROUP_ID],
  );

  useEffect(() => {
    loadQuestions(true);
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    setPage(1);
    loadQuestions(true);
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
      <FlatList
        data={questions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <QuestionCard item={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#4F46E5']}
          />
        }
        onEndReached={() => hasMore && loadQuestions()}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay preguntas aún</Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <ActivityIndicator
              size="small"
              color="#4F46E5"
              style={{ paddingVertical: 16 }}
            />
          ) : null
        }
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#4F46E5', fontWeight: '700', fontSize: 16 },
  cardMeta: { flex: 1, marginLeft: 10 },
  authorName: { fontWeight: '600', color: '#111827', fontSize: 14 },
  cardDate: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeClosed: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#166534' },
  questionText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  answerCount: { color: '#6B7280', fontSize: 13 },
  answered: { color: '#059669', fontSize: 13, fontWeight: '600' },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    alignItems: 'center',
  },
  offlineText: { color: '#92400E', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
});
