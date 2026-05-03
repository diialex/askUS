import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Alert,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { groupsApi } from '@api/groups';
import { groupQuestionsApi } from '@api/questions';
import type { GroupQuestion, GroupMember } from '@/types';
import { useAuth } from '@context/AuthContext';

const CATEGORIES = [
  { key: 'picante',  emoji: '🌶️', label: 'Picante',  desc: 'Subidas de tono' },
  { key: 'incomoda', emoji: '😬', label: 'Incómoda', desc: 'Que incomodan' },
  { key: 'graciosa', emoji: '😂', label: 'Graciosa', desc: 'Divertidas' },
  { key: 'general',  emoji: '🎲', label: 'General',  desc: 'Mix de todo' },
];

// ─── Tarjeta historial ────────────────────────────────────────────────────────

function HistoryCard({ item, onPress }: { item: GroupQuestion; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={s.historyCard}>
        <View style={[s.historyBadge, item.status === 'closed' && s.historyBadgeClosed]}>
          <Text style={s.historyBadgeText}>{item.status === 'closed' ? 'Cerrada' : 'Activa'}</Text>
        </View>
        <Text style={s.historyText} numberOfLines={2}>{item.question.text}</Text>
        <Text style={s.historyMeta}>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estado del modal de temática (null=cerrado, 'ad'=anuncio, 'picker'=selector)
  const [modalPhase, setModalPhase] = useState<null | 'ad' | 'picker'>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [adSeconds, setAdSeconds] = useState(10);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const [groupRes, activeRes, historyRes] = await Promise.allSettled([
        groupsApi.getGroup(groupId),
        groupQuestionsApi.getActive(groupId),
        groupQuestionsApi.list(groupId, 1),
      ]);
      if (groupRes.status === 'fulfilled') setGroupName(groupRes.value.data.data.name);
      if (activeRes.status === 'fulfilled') setActiveQuestion(activeRes.value.data.data);
      else setActiveQuestion(null);
      if (historyRes.status === 'fulfilled')
        setHistory(historyRes.value.data.data.filter((q: GroupQuestion) => q.status === 'closed'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [groupId]);

  // Countdown del anuncio
  useEffect(() => {
    if (modalPhase !== 'ad') return;
    setAdSeconds(10);
    const interval = setInterval(() => {
      setAdSeconds(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [modalPhase]);

  const openAd = () => {
    setSelectedCategory(null);
    setModalPhase('ad');
  };

  const closeModal = () => {
    setModalPhase(null);
    setSelectedCategory(null);
  };

  const handleConfirmCategory = async () => {
    if (!selectedCategory) return;
    setIsSaving(true);
    try {
      await groupsApi.voteCategory(groupId, selectedCategory);
      closeModal();
      const labels: Record<string, string> = {
        picante: '🌶️ Picante', incomoda: '😬 Incómoda',
        graciosa: '😂 Graciosa', general: '🎲 General',
      };
      Alert.alert('¡Listo! 🎉', `La próxima pregunta será ${labels[selectedCategory]}`);
    } catch {
      Alert.alert('Error', 'No se pudo guardar la temática. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const goToAnswer = () => {
    if (!activeQuestion) return;
    router.push({
      pathname: '/(tabs)/groups/answer',
      params: { groupId, gqId: activeQuestion.id },
    });
  };

  const goToResults = (gq: GroupQuestion) => {
    router.push({
      pathname: '/(tabs)/groups/results',
      params: { gqId: gq.id, questionText: gq.question.text },
    });
  };

  if (isLoading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#FACC15" /></View>;
  }

  const alreadyAnswered = !!activeQuestion?.my_answer;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/groups')} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{groupName}</Text>
        <TouchableOpacity
          style={s.inviteBtn}
          onPress={() => router.push({ pathname: '/(tabs)/groups/invite', params: { groupId } })}
        >
          <Text style={s.inviteBtnText}>👥 Invitar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { setIsRefreshing(true); load(); }}
            colors={['#FACC15']}
          />
        }
        ListHeaderComponent={
          <>
            {activeQuestion ? (
              <View style={s.activeCard}>
                <View style={s.activePill}>
                  <Text style={s.activePillText}>🕐 Pregunta de hoy</Text>
                </View>
                <Text style={s.activeQuestion}>{activeQuestion.question.text}</Text>
                <View style={s.activeFooter}>
                  <Text style={s.activeMeta}>💬 {activeQuestion.answer_count} respuestas</Text>
                  {alreadyAnswered ? (
                    <TouchableOpacity style={s.resultsBtn} onPress={() => goToResults(activeQuestion)}>
                      <Text style={s.resultsBtnText}>Ver resultados →</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={s.answerBtn} onPress={goToAnswer}>
                      <Text style={s.answerBtnText}>¡Responder!</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={s.noQuestion}>
                <Text style={s.noQuestionIcon}>⏳</Text>
                <Text style={s.noQuestionText}>La pregunta llegará a las 14:00</Text>
              </View>
            )}

            {/* Botón elegir temática */}
            <TouchableOpacity style={s.voteBtn} onPress={openAd} activeOpacity={0.75}>
              <Text style={s.voteBtnIcon}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.voteBtnTitle}>Elige la temática de mañana</Text>
                <Text style={s.voteBtnSub}>Ver un anuncio para elegir</Text>
              </View>
              <Text style={s.voteBtnArrow}>→</Text>
            </TouchableOpacity>

            {history.length > 0 && (
              <Text style={s.sectionTitle}>Preguntas anteriores</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <HistoryCard item={item} onPress={() => goToResults(item)} />
        )}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.emptyHistory}>
            <Text style={s.emptyHistoryText}>Aún no hay preguntas anteriores</Text>
          </View>
        }
      />

      {/* Modal único: fase 'ad' o 'picker' */}
      <Modal visible={modalPhase !== null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={s.overlay}>

          {/* ── Fase anuncio ── */}
          {modalPhase === 'ad' && (
            <View style={s.sheet}>
              <Text style={s.adLabel}>Anuncio {adSeconds > 0 ? `· ${adSeconds}s` : ''}</Text>
              <View style={s.adContent}>
                <Text style={s.adEmoji}>📢</Text>
                <Text style={s.adTitle}>Tu publicidad aquí</Text>
                <Text style={s.adSub}>Espacio reservado para AdMob</Text>
              </View>
              <TouchableOpacity
                style={[s.primaryBtn, adSeconds > 0 && s.primaryBtnDisabled]}
                onPress={() => adSeconds === 0 && setModalPhase('picker')}
                activeOpacity={adSeconds === 0 ? 0.8 : 1}
              >
                <Text style={[s.primaryBtnText, adSeconds > 0 && { color: '#6B7280' }]}>
                  {adSeconds > 0 ? `Espera ${adSeconds}s` : 'Continuar →'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Fase picker ── */}
          {modalPhase === 'picker' && (
            <View style={s.sheet}>
              <Text style={s.pickerTitle}>¿De qué temática quieres{'\n'}la pregunta de mañana?</Text>

              {CATEGORIES.map(cat => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[s.catRow, isSelected && s.catRowSelected]}
                    onPress={() => setSelectedCategory(cat.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.catEmoji}>{cat.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.catLabel, isSelected && s.catLabelSelected]}>{cat.label}</Text>
                      <Text style={s.catDesc}>{cat.desc}</Text>
                    </View>
                    {isSelected && <Text style={s.catCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[s.primaryBtn, { marginTop: 8 }, !selectedCategory && s.primaryBtnDisabled]}
                onPress={handleConfirmCategory}
                disabled={!selectedCategory || isSaving}
                activeOpacity={0.8}
              >
                {isSaving
                  ? <ActivityIndicator color="#0F0F0F" />
                  : <Text style={[s.primaryBtnText, !selectedCategory && { color: '#6B7280' }]}>
                      {selectedCategory ? 'Confirmar temática' : 'Elige una temática'}
                    </Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={closeModal} style={s.cancelLink}>
                <Text style={s.cancelLinkText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
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
    backgroundColor: '#FACC15', borderRadius: 20, padding: 20, marginBottom: 4,
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
  activeMeta: { color: 'rgba(0,0,0,0.5)', fontSize: 13 },
  answerBtn: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  answerBtnText: { color: '#FACC15', fontWeight: '700', fontSize: 14 },
  resultsBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  resultsBtnText: { color: '#0F0F0F', fontWeight: '600', fontSize: 14 },
  noQuestion: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noQuestionIcon: { fontSize: 40 },
  noQuestionText: { color: '#6B7280', fontSize: 15 },

  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#2D2D2D',
  },
  voteBtnIcon: { fontSize: 26 },
  voteBtnTitle: { color: '#F9FAFB', fontWeight: '700', fontSize: 14 },
  voteBtnSub: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  voteBtnArrow: { color: '#FACC15', fontSize: 18, fontWeight: '700' },

  sectionTitle: { fontWeight: '700', fontSize: 15, color: '#9CA3AF', marginTop: 4, marginBottom: 4 },
  historyCard: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14 },
  historyBadge: {
    backgroundColor: '#2A2000', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 8,
  },
  historyBadgeClosed: { backgroundColor: '#1F2937' },
  historyBadgeText: { fontSize: 11, color: '#FACC15', fontWeight: '600' },
  historyText: { fontSize: 14, color: '#F9FAFB', lineHeight: 20, marginBottom: 8 },
  historyMeta: { fontSize: 12, color: '#9CA3AF' },
  emptyHistory: { alignItems: 'center', marginTop: 40 },
  emptyHistoryText: { color: '#9CA3AF', fontSize: 14 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44, gap: 12,
  },

  // Anuncio
  adLabel: { fontSize: 12, color: '#6B7280', textAlign: 'center', fontWeight: '600' },
  adContent: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  adEmoji: { fontSize: 52 },
  adTitle: { fontSize: 20, fontWeight: '700', color: '#F9FAFB' },
  adSub: { fontSize: 14, color: '#6B7280' },

  // Botón principal
  primaryBtn: {
    backgroundColor: '#FACC15', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#2D2D2D' },
  primaryBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 16 },

  // Picker
  pickerTitle: { fontSize: 17, fontWeight: '700', color: '#F9FAFB', textAlign: 'center', lineHeight: 24 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0F0F0F', borderRadius: 14, padding: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  catRowSelected: { borderColor: '#FACC15', backgroundColor: '#2A2000' },
  catEmoji: { fontSize: 28 },
  catLabel: { fontSize: 15, fontWeight: '700', color: '#9CA3AF' },
  catLabelSelected: { color: '#FACC15' },
  catDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  catCheck: { fontSize: 20, color: '#FACC15', fontWeight: '700' },

  cancelLink: { alignItems: 'center', paddingVertical: 4 },
  cancelLinkText: { color: '#6B7280', fontSize: 14 },
});
