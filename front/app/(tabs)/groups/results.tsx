import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { answersApi } from '@api/questions';
import type { QuestionResults, ResultEntry } from '@/types';

// ─── Colores del gráfico ──────────────────────────────────────────────────────

const COLORS = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

// ─── Pie chart SVG ────────────────────────────────────────────────────────────

function PieChart({ data, size = 220 }: { data: { percentage: number; color: string; label: string }[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

  let cumulAngle = -90; // start from top

  const slices = data.map((entry) => {
    const angle = (entry.percentage / 100) * 360;
    const startAngle = cumulAngle;
    cumulAngle += angle;
    const endAngle = cumulAngle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const largeArc = angle > 180 ? 1 : 0;

    const midAngle = startAngle + angle / 2;
    const labelR = r * 0.65;
    const lx = cx + labelR * Math.cos(toRad(midAngle));
    const ly = cy + labelR * Math.sin(toRad(midAngle));

    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, color: entry.color, lx, ly, pct: Math.round(entry.percentage) };
  });

  return (
    <Svg width={size} height={size}>
      {slices.map((slice, i) => (
        <Path key={i} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth={2} />
      ))}
      {/* Hueco central */}
      <Circle cx={cx} cy={cy} r={r * 0.38} fill="#F3F4F6" />
      {slices.map((slice, i) =>
        slice.pct >= 8 ? (
          <SvgText
            key={`t${i}`}
            x={slice.lx}
            y={slice.ly}
            fill="#fff"
            fontSize={13}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {slice.pct}%
          </SvgText>
        ) : null,
      )}
    </Svg>
  );
}

// ─── Fila de resultado ────────────────────────────────────────────────────────

function ResultRow({
  entry,
  color,
  rank,
}: {
  entry: ResultEntry;
  color: string;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={s.resultRow}>
      <TouchableOpacity style={s.resultRowHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <View style={[s.rankBadge, { backgroundColor: color }]}>
          <Text style={s.rankText}>{rank}</Text>
        </View>
        <View style={s.resultAvatar}>
          <Text style={s.resultAvatarText}>{entry.user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.resultName}>{entry.user.name}</Text>
          <View style={s.barRow}>
            <View style={s.barBg}>
              <View style={[s.barFill, { width: `${entry.percentage}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={s.resultPct}>{entry.percentage}%</Text>
          </View>
        </View>
        <Text style={s.voteCount}>{entry.vote_count} {entry.vote_count === 1 ? 'voto' : 'votos'}</Text>
        <Text style={s.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && entry.voters.length > 0 && (
        <View style={s.voterList}>
          <Text style={s.voterTitle}>Votaron por {entry.user.name}:</Text>
          {entry.voters.map((v) => (
            <View key={v.id} style={s.voterRow}>
              <View style={s.voterAvatar}>
                <Text style={s.voterAvatarText}>{v.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={s.voterName}>{v.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Anuncio placeholder ──────────────────────────────────────────────────────

function AdModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.adOverlay}>
        <View style={s.adCard}>
          <Text style={s.adLabel}>Anuncio</Text>
          <View style={s.adContent}>
            <Text style={s.adEmoji}>📢</Text>
            <Text style={s.adTitle}>Tu publicidad aquí</Text>
            <Text style={s.adSubtitle}>Espacio reservado para AdMob</Text>
          </View>
          <TouchableOpacity style={s.adClose} onPress={onClose}>
            <Text style={s.adCloseText}>Cerrar anuncio →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const { gqId, questionText } = useLocalSearchParams<{ gqId: string; questionText: string }>();
  const router = useRouter();

  const [results, setResults] = useState<QuestionResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await answersApi.getResults(gqId);
        setResults(res.data.data);
        // Mostrar anuncio al llegar
        setTimeout(() => setShowAd(true), 600);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [gqId]);

  if (isLoading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#4F46E5" /></View>;
  }

  const pieData = (results?.results ?? []).map((r, i) => ({
    percentage: r.percentage,
    color: COLORS[i % COLORS.length],
    label: r.user.name,
  }));

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Resultados</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Pregunta */}
        <Text style={s.questionText} numberOfLines={3}>{questionText}</Text>
        <Text style={s.totalVotes}>{results?.total_votes ?? 0} votos en total</Text>

        {/* Gráfica */}
        {results && results.results.length > 0 ? (
          <>
            <View style={s.chartContainer}>
              <PieChart data={pieData} size={220} />
            </View>

            {/* Leyenda */}
            <View style={s.legend}>
              {results.results.map((r, i) => (
                <View key={r.user.id} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: COLORS[i % COLORS.length] }]} />
                  <Text style={s.legendName}>{r.user.name}</Text>
                </View>
              ))}
            </View>

            {/* Detalle */}
            <Text style={s.sectionTitle}>Detalle de votos</Text>
            {results.results.map((entry, i) => (
              <ResultRow
                key={entry.user.id}
                entry={entry}
                color={COLORS[i % COLORS.length]}
                rank={i + 1}
              />
            ))}
          </>
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🗳</Text>
            <Text style={s.emptyText}>Aún no hay votos</Text>
          </View>
        )}
      </ScrollView>

      <AdModal visible={showAd} onClose={() => setShowAd(false)} />
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
  scroll: { padding: 16, paddingBottom: 40 },
  questionText: { fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center', lineHeight: 24 },
  totalVotes: { textAlign: 'center', color: '#6B7280', fontSize: 13, marginTop: 4, marginBottom: 20 },
  chartContainer: { alignItems: 'center', marginBottom: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24, justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontSize: 13, color: '#374151', fontWeight: '500' },
  sectionTitle: { fontWeight: '700', fontSize: 15, color: '#374151', marginBottom: 12 },
  resultRow: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  resultRowHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10,
  },
  rankBadge: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  resultAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  resultAvatarText: { color: '#4F46E5', fontWeight: '700', fontSize: 16 },
  resultName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barBg: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
  resultPct: { fontSize: 11, color: '#6B7280', width: 32 },
  voteCount: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chevron: { fontSize: 10, color: '#9CA3AF', marginLeft: 4 },
  voterList: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  voterTitle: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 8, marginTop: 8 },
  voterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  voterAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  voterAvatarText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  voterName: { fontSize: 13, color: '#374151' },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
  // Ad
  adOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  adCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  adLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  adContent: { alignItems: 'center', gap: 8, marginBottom: 24 },
  adEmoji: { fontSize: 48 },
  adTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  adSubtitle: { fontSize: 14, color: '#6B7280' },
  adClose: {
    backgroundColor: '#4F46E5', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  adCloseText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
