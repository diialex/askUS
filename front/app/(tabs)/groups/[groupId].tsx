import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { groupsApi } from '@api/groups';
import { groupQuestionsApi } from '@api/questions';
import type { GroupQuestion, GroupMember } from '@/types';
import { useAuth } from '@context/AuthContext';

// ─── Tarjeta pregunta del historial ──────────────────────────────────────────

function HistoryCard({ item, onPress }: { item: GroupQuestion; onPress: () => void }) {
  const isClosed = item.status === 'closed';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.historyCard}>
        <View style={[styles.historyBadge, isClosed && styles.historyBadgeClosed]}>
          <Text style={styles.historyBadgeText}>{isClosed ? 'Cerrada' : 'Activa'}</Text>
        </View>
        <Text style={styles.historyText} numberOfLines={2}>{item.question.text}</Text>
        <Text style={styles.historyMeta}>
          💬 {item.answer_count} respuestas · {new Date(item.sent_at).toLocaleDateString('es-ES')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [activeQuestion, setActiveQuestion] = useState<GroupQuestion | null>(null);
  const [history, setHistory] = useState<GroupQuestion[]>([]);
  const [groupName, setGroupName] = useState('Grupo');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const [groupRes, activeRes, historyRes, membersRes] = await Promise.allSettled([
        groupsApi.getGroup(groupId),
        groupQuestionsApi.getActive(groupId),
        groupQuestionsApi.list(groupId, 1),
        groupsApi.getMembers(groupId, 1),
      ]);

      if (groupRes.status === 'fulfilled') {
        setGroupName(groupRes.value.data.data.name);
      }
      if (activeRes.status === 'fulfilled') {
        setActiveQuestion(activeRes.value.data.data);
      } else {
        setActiveQuestion(null);
      }
      if (historyRes.status === 'fulfilled') {
        setHistory(historyRes.value.data.data.filter(q => q.status === 'closed'));
      }
      if (membersRes.status === 'fulfilled') {
        setMembers(membersRes.value.data.data);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [groupId]);

  const goToAnswer = () => {
    if (!activeQuestion) return;
    router.push({
      pathname: '/(tabs)/groups/answer',
      params: { groupId, gqId: activeQuestion.id, gqUuid: activeQuestion.id },
    });
  };

  const goToResults = (gq: GroupQuestion) => {
    router.push({
      pathname: '/(tabs)/groups/results',
      params: { gqId: gq.id, questionText: gq.question.text },
    });
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FACC15" /></View>;
  }

  const alreadyAnswered = !!activeQuestion?.my_answer;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => router.push({ pathname: '/(tabs)/groups/invite', params: { groupId } })}
        >
          <Text style={styles.inviteBtnText}>👥 Invitar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load(); }} colors={['#FACC15']} />}
        ListHeaderComponent={
          <>
            {/* Pregunta activa */}
            {activeQuestion ? (
              <View style={styles.activeCard}>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>🕐 Pregunta de hoy</Text>
                </View>
                <Text style={styles.activeQuestion}>{activeQuestion.question.text}</Text>
                <View style={styles.activeFooter}>
                  <Text style={styles.activeMeta}>💬 {activeQuestion.answer_count} respuestas</Text>
                  {alreadyAnswered ? (
                    <TouchableOpacity style={styles.resultsBtn} onPress={() => goToResults(activeQuestion)}>
                      <Text style={styles.resultsBtnText}>Ver resultados →</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.answerBtn} onPress={goToAnswer}>
                      <Text style={styles.answerBtnText}>¡Responder!</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.noQuestion}>
                <Text style={styles.noQuestionIcon}>⏳</Text>
                <Text style={styles.noQuestionText}>La pregunta llegará a las 14:00</Text>
              </View>
            )}

            {history.length > 0 && (
              <Text style={styles.sectionTitle}>Preguntas anteriores</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <HistoryCard item={item} onPress={() => goToResults(item)} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          activeQuestion ? null : (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryText}>Aún no hay preguntas anteriores</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A1A1A', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#2D2D2D',
  },
  backBtn: { padding: 8 },
  backText: { fontSize: 20, color: '#FACC15' },
  headerTitle: { flex: 1, fontWeight: '700', fontSize: 17, color: '#F9FAFB', marginHorizontal: 8 },
  inviteBtn: {
    backgroundColor: '#2A2000', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  inviteBtnText: { color: '#FACC15', fontWeight: '600', fontSize: 13 },
  list: { padding: 16, gap: 12 },
  activeCard: {
    backgroundColor: '#FACC15', borderRadius: 20, padding: 20,
    marginBottom: 8,
    shadowColor: '#FACC15', shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  activePill: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12,
  },
  activePillText: { color: '#0F0F0F', fontSize: 12, fontWeight: '600' },
  activeQuestion: { color: '#0F0F0F', fontSize: 18, fontWeight: '700', lineHeight: 26, marginBottom: 16 },
  activeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  answerBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  answerBtnText: { color: '#FACC15', fontWeight: '700', fontSize: 14 },
  resultsBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  resultsBtnText: { color: '#0F0F0F', fontWeight: '600', fontSize: 14 },
  noQuestion: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noQuestionIcon: { fontSize: 40 },
  noQuestionText: { color: '#6B7280', fontSize: 15 },
  sectionTitle: { fontWeight: '700', fontSize: 15, color: '#2D2D2D', marginTop: 8, marginBottom: 4 },
  historyCard: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  historyBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 8,
  },
  historyBadgeClosed: { backgroundColor: '#0F0F0F' },
  historyBadgeText: { fontSize: 11, color: '#2D2D2D', fontWeight: '600' },
  historyText: { fontSize: 14, color: '#2D2D2D', lineHeight: 20, marginBottom: 8 },
  historyMeta: { fontSize: 12, color: '#9CA3AF' },
  emptyHistory: { alignItems: 'center', marginTop: 40 },
  emptyHistoryText: { color: '#9CA3AF', fontSize: 14 },
});
