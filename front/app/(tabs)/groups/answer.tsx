import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, FlatList, Alert,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { groupsApi } from '@api/groups';
import { groupQuestionsApi, answersApi } from '@api/questions';
import { useAuth } from '@context/AuthContext';
import type { GroupMember, GroupQuestion } from '@/types';

export default function AnswerScreen() {
  const { groupId, gqId } = useLocalSearchParams<{ groupId: string; gqId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [gq, setGq] = useState<GroupQuestion | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [gqRes, membersRes] = await Promise.all([
          groupQuestionsApi.get(gqId),
          groupsApi.getMembers(groupId, 1),
        ]);
        setGq(gqRes.data.data);
        setMembers(membersRes.data.data);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [gqId, groupId]);

  const handleSubmit = async () => {
    if (!selected || !gqId) return;
    setIsSending(true);
    try {
      await answersApi.create({
        group_question_uuid: gqId,
        selected_user_uuid: selected,
      });
      // Navegar a resultados
      router.replace({
        pathname: '/(tabs)/groups/results',
        params: { gqId, questionText: gq?.question.text ?? '' },
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo enviar la respuesta');
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#FACC15" /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Elige a alguien</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Pregunta */}
      <View style={s.questionBox}>
        <Text style={s.questionText}>{gq?.question.text}</Text>
      </View>

      {/* Lista de miembros */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.user_id}
        numColumns={2}
        contentContainerStyle={s.grid}
        columnWrapperStyle={s.row}
        renderItem={({ item }) => {
          const isSelected = selected === item.user_id;
          return (
            <TouchableOpacity
              style={[s.memberCard, isSelected && s.memberCardSelected]}
              onPress={() => setSelected(item.user_id)}
              activeOpacity={0.8}
            >
              <View style={[s.avatar, isSelected && s.avatarSelected]}>
                <Text style={[s.avatarText, isSelected && s.avatarTextSelected]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[s.memberName, isSelected && s.memberNameSelected]} numberOfLines={1}>
                {item.name}
              </Text>
              {isSelected && <Text style={s.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        }}
      />

      {/* Botón confirmar */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.confirmBtn, (!selected || isSending) && s.confirmBtnDisabled]}
          onPress={handleSubmit}
          disabled={!selected || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#0F0F0F" />
          ) : (
            <Text style={s.confirmBtnText}>
              {selected ? `Votar por ${members.find(m => m.user_id === selected)?.name}` : 'Elige a alguien'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  headerTitle: { fontWeight: '700', fontSize: 17, color: '#F9FAFB' },
  questionBox: {
    backgroundColor: '#FACC15', margin: 16, borderRadius: 18,
    padding: 20,
    shadowColor: '#FACC15', shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  questionText: { color: '#0F0F0F', fontSize: 17, fontWeight: '600', lineHeight: 25, textAlign: 'center' },
  grid: { paddingHorizontal: 16, paddingBottom: 100 },
  row: { gap: 12, marginBottom: 12 },
  memberCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 8,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  memberCardSelected: {
    borderColor: '#FACC15', backgroundColor: '#2A2000',
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center',
  },
  avatarSelected: { backgroundColor: '#FACC15' },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#6B7280' },
  avatarTextSelected: { color: '#0F0F0F' },
  memberName: { fontSize: 14, fontWeight: '600', color: '#2D2D2D', textAlign: 'center' },
  memberNameSelected: { color: '#FACC15' },
  checkmark: { fontSize: 18, color: '#FACC15' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, backgroundColor: '#1A1A1A',
    borderTopWidth: 1, borderTopColor: '#2D2D2D',
  },
  confirmBtn: {
    backgroundColor: '#FACC15', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#C7D2FE' },
  confirmBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 16 },
});
