// Reports waiting for the signed-in manager's review: their tasks a technician has submitted.
//
//   list ← GET /api/v1/task/review   ({ tasks: [...], tasksCount }, ReviewTasks in the backend's
//                                     API.md: each task joined to its latest report)
//
//
// An opened card leads to the report page (app/review/[id].jsx), where the manager reads the
// answers and approves or returns the task. A decided task is no longer SUBMITTED, so it's
// gone the next time this tab reloads, which it does every time it comes into view. Same
// layout as the Ordres tab.
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import * as apiClient from '@/services/apiClient';
import { colors, gradients, radius } from '@/constants/app-theme';

const PRIORITY_LABEL = { URGENT: 'Urgente', HIGH: 'Haute', NORMAL: 'Normale', LOW: 'Basse' };

// badge colours, from the theme's status triples (same as the Tâches tab)
const PRIORITY_STYLE = {
  URGENT: { color: colors.danger, borderColor: colors.dangerBorder, backgroundColor: colors.dangerFill },
  HIGH: { color: colors.warning, borderColor: colors.warningBorder, backgroundColor: colors.warningFill },
  NORMAL: { color: colors.accent, borderColor: colors.accentBubble, backgroundColor: colors.accentWash },
  LOW: { color: colors.textMuted, borderColor: colors.glassBorder, backgroundColor: colors.glassFill },
};

const TASK_TYPE_LABEL = { MAINTENANCE: 'Maintenance', PREVENTIVE: 'Préventive', CORRECTIVE: 'Corrective' };

// the report's verdict, decided by the server: NON_CONFORME when a critical point is MAUVAIS
const CONFORMITY = {
  CONFORME: { label: 'Conforme', icon: 'checkmark-circle', color: colors.success },
  NON_CONFORME: { label: 'Non conforme', icon: 'close-circle', color: colors.danger },
};

// "2026-10-25" → "25/10/2026"
const frenchDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

// Date → "YYYY-MM-DD" in the phone's timezone, to compare an instant with a due date
const localIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ISO instant → "24/10/2026 à 17:40", in the phone's timezone
const frenchDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${frenchDate(localIso(d))} à ${time}`;
};

// 9000 → "2 h 30", 900 → "15 min"
const formatWorked = (seconds) => {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};

// sent after the day it was due
const isLate = (task) =>
  Boolean(task.dueDate && task.submittedAt && localIso(new Date(task.submittedAt)) > task.dueDate);

const Review = () => {
  const [reviews, setReviews] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState(null); // the server's message, or null
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState(null);

  // the server already sorts them oldest submission first, the order to review them in
  const loadReviews = useCallback(async () => {
    const { result, error } = await apiClient.getReviewTasks();
    setLoadError(error ?? null);
    setReviews(result?.tasks ?? []);
  }, []);

  // a tab stays mounted, so useEffect would load once; this reloads on every visit
  useFocusEffect(
    useCallback(() => {
      loadReviews();
    }, [loadReviews])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  const onRetry = () => {
    setReviews(null);
    loadReviews();
  };

  const toggle = (id) => {
    Haptics.selectionAsync();
    setOpenId((current) => (current === id ? null : id));
  };

  const loading = reviews === null;

  return (
    <View style={styles.flex}>
      <ImageBackground
        source={require('../../assets/images/background_login.jpg')}
        resizeMode="cover"
        style={styles.flex}
      >
        <LinearGradient colors={gradients.scrim} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accentDeep]}
              />
            }
          >
            <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
              <View style={styles.logoRing}>
                <LinearGradient colors={gradients.accent} style={styles.logo}>
                  <Ionicons name="checkmark-done" size={40} color={colors.text} />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Rapports à valider</Text>
              <Text style={styles.subtitle}>Les tâches terminées par vos techniciens</Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(700).delay(150).springify()}>
              {loading && (
                <View style={styles.centered}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.hint}>Chargement des rapports…</Text>
                </View>
              )}

              {!loading && loadError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{loadError}</Text>
                  <Pressable
                    onPress={onRetry}
                    style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                  >
                    <Ionicons name="refresh" size={16} color={colors.text} />
                    <Text style={styles.retryText}>Réessayer</Text>
                  </Pressable>
                </View>
              )}

              {!loading && !loadError && reviews.length === 0 && <EmptyState />}

              {!loading && reviews.length > 0 && (
                <Text style={styles.groupHeading}>En attente · {reviews.length}</Text>
              )}

              {!loading &&
                reviews.map((task) => (
                  <ReviewCard
                    key={task.taskId}
                    task={task}
                    isOpen={openId === task.taskId}
                    onPress={() => toggle(task.taskId)}
                  />
                ))}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

// one submitted task: title + priority, the report's verdict, who sent it and when;
// opens in place to show the rest of the task, and a way to its report
const ReviewCard = ({ task, isOpen, onPress }) => {
  const priority = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.LOW;
  const conformity = CONFORMITY[task.submissionStatus];
  const late = isLate(task);

  return (
    <Animated.View layout={LinearTransition} exiting={FadeOut} style={styles.cardWrap}>
      <BlurView
        intensity={45}
        tint="dark"
        style={[styles.card, isOpen && styles.cardOpen, task.submissionStatus === 'NON_CONFORME' && styles.cardBad]}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={isOpen ? undefined : 2}>
              {task.title}
            </Text>
            <Text style={[styles.priority, priority]}>{PRIORITY_LABEL[task.priority] ?? task.priority}</Text>
          </View>

          <View style={styles.meta}>
            {conformity ? (
              <Meta icon={conformity.icon} text={conformity.label} color={conformity.color} />
            ) : (
              <Meta icon="help-circle-outline" text="Rapport introuvable" />
            )}
            <Meta icon="person-outline" text={task.technicianEmail ?? '—'} />
            <Meta icon="construct-outline" text={task.equipmentId} />
            <Meta
              icon="send-outline"
              text={frenchDateTime(task.submittedAt)}
              color={late ? colors.warning : undefined}
            />
            {late && <Meta icon="alarm-outline" text="En retard" color={colors.warning} />}
          </View>

          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textFaint}
            style={styles.chevron}
          />
        </Pressable>

        {isOpen && (
          <View style={styles.details}>
            <View style={styles.facts}>
              <Fact label="Rapport" value={task.templateTitle ?? '—'} />
              <Fact label="Type" value={TASK_TYPE_LABEL[task.taskType] ?? task.taskType ?? '—'} />
              <Fact label="Assignée le" value={frenchDateTime(task.assignedAt)} />
              <Fact label="Échéance" value={task.dueDate ? frenchDate(task.dueDate) : 'Sans échéance'} />
              <Fact label="Intervention le" value={frenchDate(task.inspectionDate)} />
              <Fact label="Temps passé" value={formatWorked(task.workedSeconds)} />
            </View>

            <Text style={[styles.sectionLabel, styles.instructionsLabel]}>Consignes</Text>
            <Text style={styles.instructions}>{task.instructions || 'Aucune consigne.'}</Text>

            <OpenReport task={task} />
          </View>
        )}
      </BlurView>
    </Animated.View>
  );
};

// Under the opened card: opens the report page, where the manager reads the answers and
// approves or returns the task. A task submitted before it kept its report's id has none.
const OpenReport = ({ task }) => {
  const router = useRouter();

  if (!task.submissionId)
    return <Text style={[styles.hint, styles.actions]}>Le rapport de cette tâche n&apos;est pas disponible.</Text>;

  const open = () => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/review/[id]',
      params: { id: task.submissionId, taskId: task.taskId, title: task.title ?? '' },
    });
  };

  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.openReport, pressed && styles.pressed]}>
      <Ionicons name="document-text-outline" size={16} color={colors.accent} />
      <Text style={styles.openReportText}>Voir le rapport</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.accent} />
    </Pressable>
  );
};

const Meta = ({ icon, text, color = colors.textDim }) => (
  <View style={styles.metaItem}>
    <Ionicons name={icon} size={14} color={color} />
    <Text style={[styles.metaText, { color }]}>{text}</Text>
  </View>
);

// one label / value pair of the opened card, two per row
const Fact = ({ label, value }) => (
  <View style={styles.fact}>
    <Text style={styles.sectionLabel}>{label}</Text>
    <Text style={styles.factValue}>{value}</Text>
  </View>
);

const EmptyState = () => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>✅</Text>
    <Text style={styles.emptyTitle}>Aucun rapport à valider</Text>
    <Text style={styles.hint}>
      Les rapports envoyés par vos techniciens apparaissent ici. Tirez vers le bas pour actualiser.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 4,
    borderWidth: 2,
    borderColor: colors.glassBorderStrong,
    marginBottom: 16,
  },
  logo: {
    flex: 1,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  centered: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  hint: {
    fontSize: 13,
    color: colors.textFaint,
    textAlign: 'center',
  },
  groupHeading: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  cardWrap: {
    marginBottom: 10,
  },
  card: {
    borderRadius: radius.bubble,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardOpen: {
    borderColor: colors.glassBorderStrong,
  },
  cardBad: {
    borderColor: colors.dangerBorder,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  priority: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
    marginTop: 10,
    paddingRight: 24, // room for the chevron
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  chevron: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  details: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorderStrong,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  fact: {
    width: '50%',
    paddingRight: 8,
    gap: 3,
  },
  factValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textStrong,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  instructionsLabel: {
    marginTop: 16,
  },
  instructions: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textStrong,
  },
  actions: {
    marginTop: 16,
  },
  openReport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBubble,
    backgroundColor: colors.accentWash,
    paddingVertical: 10,
  },
  openReportText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
  errorBanner: {
    gap: 10,
    borderRadius: radius.banner,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerFill,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.glassBorderStrong,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textStrong,
  },
});

export default Review;
