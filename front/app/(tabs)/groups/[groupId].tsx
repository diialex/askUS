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

// ─── Categorías disponibles ───────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'picante',  label: '🌶️ Picante',   desc: 'Preguntas subidas de tono' },
  { key: 'incomoda', label: '😬 Incómoda',   desc: 'Preguntas que incomodan' },
  { key: 'graciosa', label: '😂 Graciosa',   desc: 'Preguntas divertidas' },
  { key: 'general',  label: '🎲 General',    desc: 'Mix de todo' },
];

// ─── Modal de anuncio recompensado ────────────────────────────────────────────

function RewardedAdModal({
  visible,
  onAdFinished,
  onClose,
}: {
  visible: boolean;
  onAdFinished: () => void;
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(10);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSeconds(10);
    setCanClose(false);
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.adOverlay}>
        <View style={s.adCard}>
          <Text style={s.adLabel}>Anuncio · {seconds > 0 ? `${seconds}s` : 'Puedes cerrar'}</Text>
          <View style={s.adContent}>
            <Text style={s.adEmoji}>📢</Text>
            <Text style={s.adTitle}>Tu publicidad aquí</Text>
            <Text style={s.adSubtitle}>Espacio reservado para AdMob</Text>
          </View>
          <TouchableOpacity
            style={[s.adClose, !canClose && s.adCloseDisabled]}
            onPress={() => { if (canClose) { onClose(); onAdFinished(); } }}
            disabled={!canClose}
          >
            <Text style={s.adCloseText}>
              {canClose ? 'Continuar →' : `Espera ${seconds}s`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal selector de categoría ─────────────────────────────────────────────

function CategoryPickerModal({
  visible,
  groupId,
  onClose,
}: {
  visible: boolean;
  groupId: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await groupsApi.voteCategory(groupId, selected);
      Alert.alert(
        '¡Listo! 🎉',
        `La próxima pregunta será de la temática seleccionada.`,
        [{ text: 'OK', onPress: onClose }],
      );
    } catch {
      Alert.alert('Error', 'No se pudo guardar la temática');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.pickerOverlay}>
        <View style={s.pickerCard}>
          <Text style={s.pickerTitle}>¿De qué temática quieres la pregunta de mañana?</Text>
          <View style={s.categoryGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[s.categoryBtn, selected === cat.key && s.categoryBtnSelected]}
                onPress={() => setSelected(cat.key)}
                activeOpacity={0.8}
              >
                <Text style={s.categoryEmoji}>{cat.label.split(' ')[0]}</Text>
                <Text style={[s.categoryLabel, selected === cat.key && s.categoryLabelSelected]}>
                  {cat.label.split(' ').slice(1).join(' ')}
                </Text>
                <Text style={s.categoryDesc}>{cat.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.confirmBtn, (!selected || isSaving) && s.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!selected || isSaving}
          >
            {isSaving
              ? <ActivityIndicator color="#0F0F0F" />
              : <Text style={s.confirmBtnText}>Confirmar temática</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={s.cancelLink}>
            <Text style={s.cancelLinkText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Tarjeta pregunta del historial ──────────────────────────────────────────

function HistoryCard({ item, onPress }: { item: GroupQuestion; onPress: () => void }) {
  const isClosed = item.status === 'closed';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={s.historyCard}>
        <View style={[s.historyBadge, isClosed && s.historyBadgeClosed]}>
          <Text style={s.historyBadgeText}>{isClosed ? 'Cerrada' : 'Activa'}</Text>
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
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

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
    return <View style={s.centered}><ActivityIndicator size="large" color="#FACC15" /></View>;
  }

  const alreadyAnswered = !!activeQuestion?.my_answer;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
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
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load(); }} colors={['#FACC15']} />}
        ListHeaderComponent={
          <>
            {/* Pregunta activa */}
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
            <TouchableOpacity style={s.voteBtn} onPress={() => setShowAd(true)} activeOpacity={0.8}>
              <Text style={s.voteBtnIcon}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.voteBtnTitle}>Elige la temática de mañana</Text>
                <Text style={s.voteBtnSub}>Ver un anuncio para elegir la categoría</Text>
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
          activeQuestion ? null : (
            <View style={s.emptyHistory}>
              <Text style={s.emptyHistoryText}>Aún no hay preguntas anteriores</Text>
            </View>
          )
        }
      />

      {/* Anuncio recompensado */}
      <RewardedAdModal
        visible={showAd}
        onAdFinished={() => setShowPicker(true)}
        onClose={() => setShowAd(false)}
      />

      {/* Selector de categoría */}
      <CategoryPickerModal
        visible={showPicker}
        groupId={groupId}
        onClose={() => setShowPicker(false)}
      />
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

  // Pregunta activa
  activeCard: {
    backgroundColor: '#FACC15', borderRadius: 20, padding: 20, marginBottom: 8,
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

  // Botón elegir temática
  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#2D2D2D',
  },
  voteBtnIcon: { fontSize: 28 },
  voteBtnTitle: { color: '#F9FAFB', fontWeight: '700', fontSize: 14 },
  voteBtnSub: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  voteBtnArrow: { color: '#FACC15', fontSize: 18, fontWeight: '700' },

  // Historial
  sectionTitle: { fontWeight: '700', fontSize: 15, color: '#9CA3AF', marginTop: 8, marginBottom: 4 },
  historyCard: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
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

  // Ad modal
  adOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  adCard: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  adLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  adContent: { alignItems: 'center', gap: 8, marginBottom: 24 },
  adEmoji: { fontSize: 48 },
  adTitle: { fontSize: 18, fontWeight: '700', color: '#F9FAFB' },
  adSubtitle: { fontSize: 14, color: '#6B7280' },
  adClose: {
    backgroundColor: '#FACC15', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  adCloseDisabled: { backgroundColor: '#2D2D2D' },
  adCloseText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },

  // Category picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerCard: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 16,
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', textAlign: 'center' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryBtn: {
    width: '47%', backgroundColor: '#0F0F0F', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 6, borderWidth: 2, borderColor: '#2D2D2D',
  },
  categoryBtnSelected: { borderColor: '#FACC15', backgroundColor: '#2A2000' },
  categoryEmoji: { fontSize: 32 },
  categoryLabel: { fontSize: 15, fontWeight: '700', color: '#9CA3AF' },
  categoryLabelSelected: { color: '#FACC15' },
  categoryDesc: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  confirmBtn: {
    backgroundColor: '#FACC15', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#2D2D2D' },
  confirmBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 16 },
  cancelLink: { alignItems: 'center', paddingVertical: 8 },
  cancelLinkText: { color: '#6B7280', fontSize: 14 },
});
