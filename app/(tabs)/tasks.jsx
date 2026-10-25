// Tasks assigned to the signed-in technician, the mobile twin of the web app's Tasks.jsx.
//
//   list    ← GET  /api/v1/task/mine          ({ tasks: [...] })
//   accept  → POST /api/v1/task/{id}/start    (ASSIGNED -> STARTED)
//   decline → POST /api/v1/task/{id}/decline  ({ reason, comment })
//
// Tapping a card opens it in place to show the instructions and, for ASSIGNED
// tasks, the accept / decline actions — same accordion as the web page.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as apiClient from '@/services/apiClient';
import { colors, gradients, radius } from '@/constants/app-theme';

// highest first; matches TaskPriority on the backend
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

// badge colours, from the theme's status triples
const PRIORITY_STYLE = {
  URGENT: { color: colors.danger, borderColor: colors.dangerBorder, backgroundColor: colors.dangerFill },
  HIGH: { color: colors.warning, borderColor: colors.warningBorder, backgroundColor: colors.warningFill },
  NORMAL: { color: colors.accent, borderColor: colors.accentBubble, backgroundColor: colors.accentWash },
  LOW: { color: colors.textMuted, borderColor: colors.glassBorder, backgroundColor: colors.glassFill },
};

// StatusReason values meant for decline
const DECLINE_REASONS = [
  { value: 'ON_LEAVE', label: 'En congé' },
  { value: 'WRONG_TASK', label: 'Mauvaise tâche' },
  { value: 'NO_ISSUE_FOUND', label: 'Pas de panne constatée' },
];

// by priority, then earliest due date (tasks without a due date last)
const byPriority = (a, b) => {
  const rank = (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
  if (rank !== 0) return rank;
  if (!a.dueDate) return b.dueDate ? 1 : 0;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
};

const PRIORITY_LABEL = { URGENT: 'Urgente', HIGH: 'Haute', NORMAL: 'Normale', LOW: 'Basse' };

const STATUS_LABEL = {
  ASSIGNED: 'Assignée',
  STARTED: 'En cours',
  BLOCKED: 'Bloquée',
  RETURNED: 'À corriger',
};

// fallback for a status missing above: "IN_PROGRESS" -> "In progress"
const humanize = (value) =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—';

const Tasks = () => {
  const router = useRouter();
  const [tasks, setTasks] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState(null);

  const loadTasks = useCallback(async () => {
    const data = await apiClient.getMyTasks();
    setLoadError(!data);
    setTasks([...(data?.tasks ?? [])].sort(byPriority));
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const onRetry = () => {
    setTasks(null);
    loadTasks();
  };

  const toggle = (id) => {
    Haptics.selectionAsync();
    setOpenId((current) => (current === id ? null : id));
  };

  // an accepted task is worked on in its own screen (app/task/[id].jsx)
  const openTask = (task) => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/task/[id]',
      params: {
        id: task.id,
        title: task.title ?? '',
        equipmentId: task.equipmentId ?? '',
        location: task.location ?? '',
        dueDate: task.dueDate ?? '',
        priority: task.priority ?? '',
        instructions: task.instructions ?? '',
        templateId: task.templateId ?? '',
      },
    });
  };

  // once started the card stops expanding and opens the task screen instead, so fold it
  const markStarted = (id) => {
    setTasks((current) => current.map((t) => (t.id === id ? { ...t, status: 'STARTED' } : t)));
    setOpenId(null);
  };

  // a declined task is no longer active, so it leaves the list
  const removeTask = (id) => {
    setTasks((current) => current.filter((t) => t.id !== id));
    setOpenId(null);
  };

  const loading = tasks === null;

  return (
    <View style={styles.flex}>
      <ImageBackground
        source={require('../../assets/images/background_login.jpg')}
        resizeMode="cover"
        style={styles.flex}
      >
        <LinearGradient colors={gradients.scrim} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView behavior="padding" style={styles.flex}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
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
                    <Ionicons name="checkbox" size={40} color={colors.text} />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>Mes tâches</Text>
                <Text style={styles.subtitle}>
                  Ouvrez une tâche pour lire ses consignes, puis acceptez-la ou refusez-la.
                </Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.duration(700).delay(150).springify()}>
                {loading && (
                  <View style={styles.centered}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.hint}>Chargement des tâches…</Text>
                  </View>
                )}

                {!loading && loadError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>
                      Vos tâches n&apos;ont pas pu être chargées. Vérifiez votre connexion et réessayez.
                    </Text>
                    <Pressable
                      onPress={onRetry}
                      style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                    >
                      <Ionicons name="refresh" size={16} color={colors.text} />
                      <Text style={styles.retryText}>Réessayer</Text>
                    </Pressable>
                  </View>
                )}

                {!loading && !loadError && tasks.length === 0 && <EmptyState />}

                {!loading && tasks.length > 0 && (
                  <Text style={styles.groupHeading}>Assignées · {tasks.length}</Text>
                )}

                {!loading &&
                  tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOpen={openId === task.id}
                      opensScreen={task.status === 'STARTED'}
                      onPress={task.status === 'STARTED' ? () => openTask(task) : () => toggle(task.id)}
                      onAccepted={markStarted}
                      onDeclined={removeTask}
                    />
                  ))}
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

// one task: title + priority badge + meta row; opens in place to show the details
const TaskCard = ({ task, isOpen, opensScreen, onPress, onAccepted, onDeclined }) => {
  const priority = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.LOW;

  return (
    <Animated.View layout={LinearTransition} exiting={FadeOut} style={styles.cardWrap}>
      <BlurView
        intensity={45}
        tint="dark"
        style={[styles.card, isOpen && styles.cardOpen]}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={opensScreen ? undefined : { expanded: isOpen }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={isOpen ? undefined : 2}>
              {task.title}
            </Text>
            <Text
              style={[
                styles.priority,
                { color: priority.color, borderColor: priority.borderColor, backgroundColor: priority.backgroundColor },
              ]}
            >
              {PRIORITY_LABEL[task.priority] ?? task.priority}
            </Text>
          </View>

          <View style={styles.meta}>
            <Meta icon="construct-outline" text={task.equipmentId} />
            {task.location ? <Meta icon="location-outline" text={task.location} /> : null}
            <Meta icon="calendar-outline" text={task.dueDate ?? '—'} />
            <Meta
              icon={task.status === 'STARTED' ? 'play-circle-outline' : 'ellipse-outline'}
              text={STATUS_LABEL[task.status] ?? humanize(task.status)}
              color={task.status === 'STARTED' ? colors.success : undefined}
            />
          </View>

          <Ionicons
            name={opensScreen ? 'chevron-forward' : isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textFaint}
            style={styles.chevron}
          />
        </Pressable>

        {isOpen && (
          <View style={styles.details}>
            <Text style={styles.sectionLabel}>Consignes</Text>
            <Text style={styles.instructions}>{task.instructions || 'Aucune consigne.'}</Text>

            {task.status === 'ASSIGNED' && (
              <AssignedActions task={task} onAccepted={onAccepted} onDeclined={onDeclined} />
            )}
          </View>
        )}
      </BlurView>
    </Animated.View>
  );
};

const Meta = ({ icon, text, color = colors.textDim }) => (
  <View style={styles.metaItem}>
    <Ionicons name={icon} size={14} color={color} />
    <Text style={[styles.metaText, { color }]}>{text}</Text>
  </View>
);

// buttons shown under the instructions; only ASSIGNED tasks have actions for now
const AssignedActions = ({ task, onAccepted, onDeclined }) => {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState(DECLINE_REASONS[0].value);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // accepting = starting the task on the backend (ASSIGNED -> STARTED)
  const accept = async () => {
    setSending(true);
    setError('');
    const ok = await apiClient.startTask(task.id);
    setSending(false);
    if (!ok) {
      setError("Impossible d'accepter la tâche. Réessayez.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAccepted(task.id);
  };

  const decline = async () => {
    setSending(true);
    setError('');
    const ok = await apiClient.declineTask(task.id, reason, comment.trim() || null);
    if (!ok) {
      setError("Impossible de refuser la tâche. Réessayez.");
      setSending(false);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDeclined(task.id);
  };

  return (
    <View style={styles.actions}>
      {!declining && (
        <View style={styles.buttonRow}>
          <ActionButton label="Refuser" icon="close" variant="ghost" disabled={sending} onPress={() => setDeclining(true)} />
          <ActionButton label="Accepter" icon="checkmark" variant="success" busy={sending} disabled={sending} onPress={accept} />
        </View>
      )}

      {declining && (
        <View style={styles.declineForm}>
          <Text style={styles.sectionLabel}>Motif</Text>
          <View style={styles.chips}>
            {DECLINE_REASONS.map((r) => {
              const selected = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReason(r.value);
                  }}
                  disabled={sending}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Commentaire (facultatif)</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            editable={!sending}
            multiline
            placeholder="Une information utile pour le planificateur"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
          />

          <View style={styles.buttonRow}>
            <ActionButton label="Annuler" variant="ghost" disabled={sending} onPress={() => setDeclining(false)} />
            <ActionButton label="Confirmer le refus" icon="close-circle" variant="danger" busy={sending} disabled={sending} onPress={decline} />
          </View>
        </View>
      )}

      {error ? <Text style={styles.actionError}>{error}</Text> : null}
    </View>
  );
};

const BUTTON_VARIANTS = {
  ghost: { color: colors.textStrong, borderColor: colors.glassBorderStrong, backgroundColor: 'transparent' },
  success: { color: colors.success, borderColor: colors.successBorder, backgroundColor: colors.successFill },
  danger: { color: colors.danger, borderColor: colors.dangerBorder, backgroundColor: colors.dangerFill },
};

const ActionButton = ({ label, icon, variant, busy, disabled, onPress }) => {
  const v = BUTTON_VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { borderColor: v.borderColor, backgroundColor: v.backgroundColor },
        pressed && styles.pressed,
        disabled && !busy && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={v.color} />
      ) : (
        icon && <Ionicons name={icon} size={16} color={v.color} />
      )}
      <Text style={[styles.buttonText, { color: v.color }]}>{label}</Text>
    </Pressable>
  );
};

const EmptyState = () => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>✅</Text>
    <Text style={styles.emptyTitle}>Aucune tâche ne vous est assignée</Text>
    <Text style={styles.hint}>Les nouvelles tâches apparaissent ici. Tirez vers le bas pour actualiser.</Text>
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textFaint,
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  declineForm: {
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerFill,
  },
  chipText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.danger,
    fontWeight: '600',
  },
  input: {
    minHeight: 72,
    marginBottom: 6,
    borderRadius: radius.banner,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
  },
  actionError: {
    marginTop: 10,
    fontSize: 13,
    color: colors.danger,
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

export default Tasks;
