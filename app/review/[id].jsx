// A sent report, read by the manager who created its task. Opened from the Revue tab with
// { id: submissionId, taskId, title }.
//
//   report  ← GET  /api/v1/submissions/{id}                 (SubmissionReport, the PDF's data)
//   pdf     ← GET  /api/v1/submissions/{id}/preview + /pdf  (ReportPdf, from the checklist sheet)
//   approve → POST /api/v1/task/{taskId}/approve            (SUBMITTED -> APPROVED)
//   return  → POST /api/v1/task/{taskId}/return             (SUBMITTED -> RETURNED, with a comment)
//
// Laid out like the sheet the technician filled (components/checklist-sheet.jsx), but
// nothing here can be changed: the answers are drawn, not inputs, and photos only shown.
// After a decision the screen closes; the Revue tab reloads on focus, so the task is gone.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as apiClient from '@/services/apiClient';
import { ReportPdf } from '@/components/checklist-sheet';
import { colors, gradients, radius } from '@/constants/app-theme';

const STATUS_INFO = {
  CONFORME: { label: 'Conforme', icon: 'checkmark-done', color: colors.success, border: colors.successBorder, fill: colors.successFill },
  NON_CONFORME: { label: 'Non conforme', icon: 'alert-circle', color: colors.danger, border: colors.dangerBorder, fill: colors.dangerFill },
};

// the server stores Bon / Mauvais in lowercase
const choiceOf = (value) => {
  const v = value?.trim().toLowerCase();
  return v === 'bon' || v === 'mauvais' ? v : null;
};

export default function ReviewReport() {
  const router = useRouter();
  const { id, taskId, title } = useLocalSearchParams();

  const [report, setReport] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const loadReport = useCallback(async () => {
    setLoadError(null);
    const { result, error } = await apiClient.getSubmissionReport(id);
    if (result) setReport(result);
    else setLoadError(error);
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <Screen onBack={router.back}>
      {!report ? (
        <View style={styles.centered}>
          {loadError ? (
            <>
              <Text style={[styles.errorText, styles.centeredText]}>{loadError}</Text>
              <Pressable onPress={loadReport} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
                <Ionicons name="refresh" size={16} color={colors.text} />
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      ) : (
        <>
          <SheetHeader report={report} />

          <BlurView intensity={45} tint="dark" style={styles.card}>
            <ReadOnlyField label="Emplacement" value={report.equipment} />
            <ReadOnlyField label="Date du contrôle" value={report.inspectionDate} />
            <ReadOnlyField label="Technicien" value={report.inspector} />
            <ReadOnlyField label="Envoyé le" value={report.submittedAt} last />
          </BlurView>

          <StatusBanner status={report.status} />

          {(report.answers ?? []).map((row) => (
            <AnswerRow key={row.position} row={row} />
          ))}

          <BlurView intensity={45} tint="dark" style={styles.card}>
            <Text style={styles.fieldLabel}>Remarques</Text>
            <Text style={[styles.valueBox, !report.remarks && styles.emptyValue]}>
              {report.remarks || 'Aucune remarque.'}
            </Text>
          </BlurView>

          <ReportPdf submissionId={id} />

          {taskId ? (
            <ReviewActions taskId={taskId} title={title || report.title} onDecided={router.back} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

// ─── Screen frame: background, back button, keyboard handling ───────────────
function Screen({ onBack, children }) {
  return (
    <View style={styles.flex}>
      <ImageBackground
        source={require('../../assets/images/background_login.jpg')}
        resizeMode="cover"
        style={styles.flex}
      >
        <LinearGradient colors={gradients.scrim} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <SafeAreaView style={styles.flex}>
            <Pressable
              onPress={onBack}
              hitSlop={12}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
              <Text style={styles.backText}>Revue</Text>
            </Pressable>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

// ─── Header: type, version, title, instructions (as on the sheet) ───────────
function SheetHeader({ report }) {
  return (
    <View style={styles.sheetHeader}>
      <View style={styles.sheetTags}>
        <Text style={styles.typeTag}>{report.type}</Text>
        <Text style={styles.version}>v{report.version}</Text>
      </View>
      <Text style={styles.sheetTitle}>{report.title}</Text>
      {report.instructions ? <Text style={styles.instructions}>{report.instructions}</Text> : null}
    </View>
  );
}

function ReadOnlyField({ label, value, last }) {
  return (
    <View style={!last && styles.fieldGap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.lockedRow}>
        <Text style={styles.lockedValue}>{value || '—'}</Text>
        <Ionicons name="lock-closed" size={12} color={colors.textFaint} />
      </View>
    </View>
  );
}

function StatusBanner({ status }) {
  const info = STATUS_INFO[status];
  if (!info) return null;
  return (
    <View style={[styles.statusBanner, { borderColor: info.border, backgroundColor: info.fill }]}>
      <Ionicons name={info.icon} size={20} color={info.color} />
      <Text style={[styles.statusText, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

// ─── One answered question, drawn like the sheet's QuestionRow ──────────────
function AnswerRow({ row }) {
  const choice = choiceOf(row.value);
  const isBad = choice === 'mauvais';

  return (
    <BlurView intensity={45} tint="dark" style={[styles.card, isBad && styles.cardBad]}>
      <View style={styles.questionHead}>
        <View style={styles.position}>
          <Text style={styles.positionText}>{row.position}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.labelFr}>{row.labelFr}</Text>
          {row.labelAr ? <Text style={styles.labelAr}>{row.labelAr}</Text> : null}
          {row.critical && <Text style={styles.critical}>⚠ Critique</Text>}
        </View>
      </View>

      <AnswerValue row={row} choice={choice} />

      {row.comment ? (
        <View style={styles.commentBlock}>
          <Text style={styles.fieldLabel}>Commentaire</Text>
          <Text style={styles.valueBox}>{row.comment}</Text>
        </View>
      ) : null}
    </BlurView>
  );
}

// The report carries no answer type, so it's read from the value: a photo, Bon / Mauvais,
// or typed text. A photo answer whose image couldn't be read has neither value nor photo.
function AnswerValue({ row, choice }) {
  if (row.photo)
    return (
      <View style={styles.photoFrame}>
        <Image
          source={{ uri: row.photo }}
          style={styles.photo}
          resizeMode="contain"
          accessibilityLabel={`Photo du point ${row.position}`}
        />
      </View>
    );

  if (choice)
    return (
      <View style={styles.choices}>
        <ChoiceDisplay label="Bon" good selected={choice === 'bon'} />
        <ChoiceDisplay label="Mauvais" selected={choice === 'mauvais'} />
      </View>
    );

  if (row.value) return <Text style={[styles.valueBox, styles.answerGap]}>{row.value}</Text>;

  return <Text style={[styles.valueBox, styles.answerGap, styles.emptyValue]}>Photo indisponible</Text>;
}

// the sheet's Bon / Mauvais button, as a picture of the answer: nothing to press
function ChoiceDisplay({ label, good, selected }) {
  const toneColor = good ? colors.success : colors.danger;
  return (
    <View
      style={[
        styles.choice,
        selected && { borderColor: toneColor, backgroundColor: good ? colors.successFill : colors.dangerFill },
        !selected && styles.choiceOff,
      ]}
    >
      <Ionicons
        name={good ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={selected ? toneColor : colors.textFaint}
      />
      <Text style={[styles.choiceText, selected && { color: toneColor }]}>{label}</Text>
    </View>
  );
}

// ─── Decision: approve, or send back with what to redo ──────────────────────
function ReviewActions({ taskId, title, onDecided }) {
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(null); // 'approve' | 'return' | null
  const [error, setError] = useState('');

  const send = async (action) => {
    setSending(action);
    setError('');
    const { error: refused } =
      action === 'approve'
        ? await apiClient.approveTask(taskId)
        : await apiClient.returnTask(taskId, comment.trim());
    if (refused) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(refused);
      setSending(null);
      return;
    }
    Haptics.notificationAsync(
      action === 'approve' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    );
    Alert.alert(action === 'approve' ? 'Rapport validé' : 'Rapport renvoyé', `« ${title} »`);
    onDecided();
  };

  // approving closes the task for good, so it's confirmed first
  const approve = () =>
    Alert.alert('Valider le rapport ?', `« ${title} » sera clôturée.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Valider', onPress: () => send('approve') },
    ]);

  const busy = sending !== null;

  return (
    <BlurView intensity={45} tint="dark" style={[styles.card, styles.decisionCard]}>
      <Text style={styles.fieldLabel}>Décision</Text>

      {!returning ? (
        <View style={styles.buttonRow}>
          <ActionButton label="Renvoyer" icon="arrow-undo" variant="danger" disabled={busy} onPress={() => setReturning(true)} />
          <ActionButton
            label="Valider"
            icon="checkmark"
            variant="success"
            busy={sending === 'approve'}
            disabled={busy}
            onPress={approve}
          />
        </View>
      ) : (
        <View style={styles.returnForm}>
          <Text style={styles.fieldLabel}>
            À corriger <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            editable={!busy}
            multiline
            placeholder="Ce que le technicien doit reprendre"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, styles.multiline]}
          />
          <View style={styles.buttonRow}>
            <ActionButton label="Annuler" variant="ghost" disabled={busy} onPress={() => setReturning(false)} />
            <ActionButton
              label="Confirmer le renvoi"
              icon="arrow-undo"
              variant="danger"
              busy={sending === 'return'}
              disabled={busy || !comment.trim()}
              onPress={() => send('return')}
            />
          </View>
        </View>
      )}

      {error ? <Text style={styles.actionError}>{error}</Text> : null}
    </BlurView>
  );
}

const BUTTON_VARIANTS = {
  ghost: { color: colors.textStrong, borderColor: colors.glassBorderStrong, backgroundColor: 'transparent' },
  success: { color: colors.success, borderColor: colors.successBorder, backgroundColor: colors.successFill },
  danger: { color: colors.danger, borderColor: colors.dangerBorder, backgroundColor: colors.dangerFill },
};

// same pill buttons as the accept / decline actions on the Tâches tab
function ActionButton({ label, icon, variant, busy, disabled, onPress }) {
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
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  centeredText: {
    textAlign: 'center',
  },

  // header, same as the sheet
  sheetHeader: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  sheetTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  typeTag: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.accentBubble,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.accent,
  },
  version: {
    fontSize: 12,
    color: colors.textFaint,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  instructions: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // cards and read-only values
  card: {
    marginBottom: 12,
    borderRadius: radius.bubble,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardBad: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerFill,
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: colors.textDim,
  },
  fieldGap: {
    marginBottom: 14,
  },
  required: {
    color: colors.danger,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.glassBorderStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lockedValue: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  valueBox: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  emptyValue: {
    color: colors.textFaint,
    fontStyle: 'italic',
  },
  answerGap: {
    marginTop: 12,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderRadius: radius.banner,
    borderWidth: 1,
    padding: 12,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // one question, same as the sheet
  questionHead: {
    flexDirection: 'row',
    gap: 12,
  },
  position: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBubble,
  },
  positionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  labelFr: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  labelAr: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  critical: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    marginTop: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningFill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  choices: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 12,
  },
  choiceOff: {
    opacity: 0.45,
  },
  choiceText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  // wider than the sheet's: the photo runs to the card's edges, whole (contain) on black
  photoFrame: {
    marginTop: 14,
    marginHorizontal: -16,
    backgroundColor: '#000000',
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  commentBlock: {
    marginTop: 14,
  },

  // decision
  decisionCard: {
    marginTop: 12,
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
  returnForm: {
    gap: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  actionError: {
    marginTop: 10,
    fontSize: 13,
    color: colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
