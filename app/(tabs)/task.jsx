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
//lets make this page show available user

// make it assign a new task.
const Task = () => {
    const [technicians, setTechnicians] = useState(null);
    
    const [loadError, setLoadErrors] = useState(null);
    
    const [refreshing, setRefreshing] = useState(false);
    
    const [openId, setOpenId] = useState(null);

    const loadTechnicians = useCallback(async () => {
        const data = await apiClient.fetchTechnicians();
        setLoadErrors(!data);
        setTechnicians([...data?.technicianInfo ?? []]);
    }, []);

    useEffect(() => {
        loadTechnicians();
    }, [loadTechnicians]) //design principal, if later we add
    // dependencies to loadTechinacins we wont change much code :)

    const onRefresh = async () => {
        setRefreshing(true);
        await loadTechnicians();
        setRefreshing(false);
    }
    
    const onRetry = () => {
        setTechnicians(null);
        loadTechnicians();
    }

  const toggle = (id) => {
    Haptics.selectionAsync();//effect 'tick'
    setOpenId((current) => (current === id ? null : id));
  };
  const loading = technicians === null;
  const router = useRouter();

  // a manager clicking "Assigner une tâche": the assign screen is keyed by email,
  // which is how the backend identifies users; the name is only for its header
  const assignTask = (technician) => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/assign/[id]',
      params: { id: technician.email, name: technician.name ?? '' },
    });
  };
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
                <Text style={styles.title}>Liste des techniciens</Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.duration(700).delay(150).springify()}>
                {loading && (
                  <View style={styles.centered}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.hint}>Chargement des techniciens…</Text>
                  </View>
                )}

                {!loading && loadError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>
                      La liste n&apos;a pas pu être chargée. Vérifiez votre connexion et réessayez.
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

                {!loading && !loadError && technicians.length === 0 && <EmptyState />}

                {!loading && technicians.length > 0 && (
                  <Text style={styles.groupHeading}>Techniciens disponibles · {technicians.length}</Text>
                )}
                {!loading &&
                  technicians.map((technician) => (
                    <TechnicianCard
                        key={technician.email}
                        technician={technician}
                        isOpen={openId === technician.email}
                        onPress={() => toggle(technician.email)}
                        onAssign={() => assignTask(technician)}
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


// one TechnicianCard: name + worksite + location; not tappable yet
const TechnicianCard = ({technician, isOpen, onPress, onAssign}) => {
    return (
    <Animated.View layout={LinearTransition} exiting={FadeOut} style={styles.cardWrap}>
      <BlurView
        intensity={45}
        tint="dark"
        style={[styles.card, isOpen && styles.cardOpen]}
      >
        <Pressable
            onPress= {onPress}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityState={{ expanded: isOpen }}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>
              {technician.name}
            </Text>
        </View>
          <View style={styles.meta}>
            <Meta icon="construct-outline" text={technician.worksite} />
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
            <Text style={styles.sectionLabel}>{technician.email}</Text>
            <Pressable
              onPress={onAssign}
              style={({ pressed }) => [styles.assignButton, pressed && styles.pressed]}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.assignText}>Assigner une tâche</Text>
            </Pressable>
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

/*
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
*/
const EmptyState = () => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>👷</Text>
    <Text style={styles.emptyTitle}>Aucun technicien n&apos;est disponible pour le moment</Text>
    <Text style={styles.hint}>Les techniciens disponibles apparaissent ici. Tirez vers le bas pour actualiser.</Text>
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
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    marginTop: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBubble,
    backgroundColor: colors.accentWash,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  assignText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
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

export default Task;
