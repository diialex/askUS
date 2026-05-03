import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Share, Alert, TextInput,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { groupsApi } from '@api/groups';
import type { InviteInfo } from '@/types';

export default function InviteScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await groupsApi.getInvite(groupId);
        setInvite(res.data.data);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [groupId]);

  const handleShare = async () => {
    if (!invite) return;
    await Share.share({
      message: `¡Únete a mi grupo en AskUs! Usa el código: ${invite.invite_code}\n${invite.invite_url}`,
      title: 'Invitación a grupo AskUs',
    });
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert('Código inválido', 'Introduce el código de invitación completo');
      return;
    }
    setIsJoining(true);
    try {
      await groupsApi.joinByCode(code);
      Alert.alert('¡Genial!', 'Te has unido al grupo correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Código no válido');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#4F46E5" /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Invitar al grupo</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.scroll}>
        {/* QR */}
        <View style={s.qrCard}>
          <Text style={s.qrLabel}>Escanea el QR para unirte</Text>
          {invite && (
            <View style={s.qrBox}>
              <QRCode
                value={invite.invite_url}
                size={180}
                color="#111827"
                backgroundColor="#fff"
              />
            </View>
          )}
          <View style={s.codePill}>
            <Text style={s.codeText}>{invite?.invite_code}</Text>
          </View>
          <Text style={s.codeHint}>O comparte este código directamente</Text>
        </View>

        {/* Botón compartir */}
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnText}>↗ Compartir enlace</Text>
        </TouchableOpacity>

        {/* Separador */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>o únete tú a otro grupo</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Unirse por código */}
        <View style={s.joinCard}>
          <Text style={s.joinTitle}>Tengo un código</Text>
          <TextInput
            style={s.codeInput}
            placeholder="Ej. AB3X9KLM"
            placeholderTextColor="#9CA3AF"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            maxLength={12}
          />
          <TouchableOpacity
            style={[s.joinBtn, isJoining && s.joinBtnDisabled]}
            onPress={handleJoinByCode}
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.joinBtnText}>Unirme al grupo</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8 },
  backText: { fontSize: 20, color: '#4F46E5' },
  headerTitle: { fontWeight: '700', fontSize: 17, color: '#111827' },
  scroll: { padding: 16, gap: 16 },
  qrCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  qrLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  qrBox: { padding: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  codePill: {
    backgroundColor: '#EEF2FF', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  codeText: { fontSize: 28, fontWeight: '800', color: '#4F46E5', letterSpacing: 4 },
  codeHint: { fontSize: 12, color: '#9CA3AF' },
  shareBtn: {
    backgroundColor: '#4F46E5', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#4F46E5', shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  joinCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  joinTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  codeInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, fontWeight: '700', color: '#111827',
    letterSpacing: 3, textAlign: 'center',
  },
  joinBtn: {
    backgroundColor: '#111827', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  joinBtnDisabled: { backgroundColor: '#9CA3AF' },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
