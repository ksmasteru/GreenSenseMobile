// Fillable checklist, the mobile twin of the web app's InspectionForm.jsx.
//
//   template   ← GET  /api/v1/forms/inspectionForm/{id}   (title, instructions, questions)
//   answers    ← local state, keyed by question id: { [questionId]: { value, comment } }
//   submit     → POST /api/v1/submissions                 (SubmissionRequest → { id, status })
//
// The server re-checks everything (all questions answered, critical MAUVAIS has a comment,
// valid values) and decides the status. The checks here only help the technician.
//
// Every free-text field can be dictated in French through the same recorder as the Ask tab
// (hooks/use-voice-input.js). The transcript is appended, so typing and dictating mix.
//
// Not ported yet: the inspector's email (mobile doesn't keep the user yet) and photos.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
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
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as apiClient from '@/services/apiClient';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { colors, gradients, radius } from '@/constants/app-theme';

// Put in front of every dictation context so the transcriber expects the faults a technician reports
// on pumps, hoists and similar equipment. Written the way they speak — short everyday phrases, no
// jargon — since Whisper copies the prompt's style. Whisper only reads the last 224 tokens of its
// prompt and the backend keeps the last 1000 characters, so this stays around 130 tokens: the
// item-specific part goes after it, closest to the audio, and is what survives when a long context
// gets cut.
const MAINTENANCE_VOCABULARY =
  "Bruit anormal. Fuite d'huile. Fuite d'eau. Usure du câble, câble effiloché. Ça vibre beaucoup. " +
  'Le moteur chauffe. Odeur de brûlé. Boulons desserrés. Pièce cassée, fissure. Rouille, corrosion. ' +
  'Il y a du jeu. Ça frotte. Bloqué, grippé. Encrassé, bouché. Manque de graisse. Joint abîmé. ' +
  "Pression faible. Ne démarre pas. S'arrête tout seul. Crochet déformé. Fil électrique abîmé. " +
  'À remplacer.';

// a dictated sentence goes after what's already typed, never over it
const appendText = (current, text) => (current?.trim() ? `${current.trimEnd()} ${text}` : text);

// 7400 → "0:07"
const formatDuration = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Date ↔ "YYYY-MM-DD", both in the user's own timezone. toISOString() would use UTC and
// could shift the day; new Date("2026-10-12") would parse it as UTC midnight.
const dateToIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isoToDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const todayLocal = () => dateToIso(new Date());

// "2026-10-12" → "12/10/2026", the way the paper sheets write it
const frenchDate = (iso) => iso.split('-').reverse().join('/');

const TYPE_LABELS = {
  INSPECTION: 'Inspection',
  PERMIT: 'Permis',
};

const STATUS_INFO = {
  DRAFT: { label: 'Brouillon', color: colors.textMuted, border: colors.glassBorder, fill: colors.glassFill },
  CONFORME: { label: 'Conforme', color: colors.success, border: colors.successBorder, fill: colors.successFill },
  NON_CONFORME: { label: 'Non conforme', color: colors.danger, border: colors.dangerBorder, fill: colors.dangerFill },
  VALIDATED: { label: 'Validé', color: colors.accent, border: colors.glassBorderStrong, fill: colors.accentBubble },
};

export default function FillForm() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // the blank form, fetched from the backend
  const [template, setTemplate] = useState(null);
  const [loadError, setLoadError] = useState(false);

  // what the technician fills in
  const [answers, setAnswers] = useState({});
  const [equipment, setEquipment] = useState('');
  const [inspectionDate, setInspectionDate] = useState(todayLocal);
  const [remarks, setRemarks] = useState('');

  // sending + outcome
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // SubmissionResponse { id, status }
  const [errors, setErrors] = useState([]); // messages shown above the button

  // one recorder for the whole sheet; dictatingField is the field that last used it,
  // which is where its "recording…" line and errors show
  const voice = useVoiceInput({ language: 'fr' });
  const [dictatingField, setDictatingField] = useState(null);
  // the take in progress: where its text goes, and what it's about
  const take = useRef({ deliver: null, context: null });

  const loadTemplate = useCallback(async () => {
    setLoadError(false);
    const data = await apiClient.getInspectionForm(id);
    if (data) setTemplate(data);
    else setLoadError(true);
  }, [id]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  // replace state, never modify it: copy the old answers, then overwrite one
  const onAnswer = (questionId, value) =>
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], value } }));

  const onComment = (questionId, comment) =>
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], comment } }));

  // transcripts land after the recording ends, so these read the latest state, not a copy
  const dictateInto = (questionId, key) => (text) =>
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], [key]: appendText(prev[questionId]?.[key], text) },
    }));

  const dictateRemarks = (text) => setRemarks((prev) => appendText(prev, text));

  // Any mic stops the current take, and the text still goes to the field that started it.
  // Otherwise switching an answer back to Bon mid-recording would hide the only stop button.
  const toggleDictation = async (field, onTranscript, context) => {
    if (voice.status === 'transcribing') return;
    if (voice.status === 'recording') {
      const { deliver, context: about } = take.current;
      const text = await voice.stopReport(about);
      if (text) deliver?.(text);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    take.current = { deliver: onTranscript, context };
    setDictatingField(field);
    await voice.start();
  };

  const dictation = {
    field: dictatingField,
    status: voice.status,
    error: voice.error,
    durationMillis: voice.durationMillis,
    toggle: toggleDictation,
  };

  if (!template) {
    return (
      <Screen onBack={router.back}>
        <View style={styles.centered}>
          {loadError ? (
            <>
              <Text style={styles.errorText}>Le formulaire n&apos;a pas pu être chargé.</Text>
              <Pressable
                onPress={loadTemplate}
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              >
                <Ionicons name="refresh" size={16} color={colors.text} />
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      </Screen>
    );
  }

  const questions = [...(template.questions ?? [])].sort((a, b) => a.position - b.position);
  const answeredCount = questions.filter((q) => answers[q.id]?.value?.trim()).length;
  const submitted = result !== null;
  const locked = submitted || sending;

  // What each mic is about, sent with the audio so the transcriber expects the item's own
  // words (linguet, moufle, élingue…) instead of guessing. Written as the text that would
  // come just before the technician's sentence, which is how Whisper reads it.
  const itemContext = (q, lead) =>
    `${MAINTENANCE_VOCABULARY} ${template.title}. Point ${q.position} : ${q.labelFr}. ${lead}`;
  // general remarks are most likely about what was found wrong
  const flagged = questions.filter((q) => answers[q.id]?.value === 'MAUVAIS');
  const listed = (flagged.length ? flagged : questions).map((q) => q.labelFr).join(' ; ');
  const remarksContext = `${MAINTENANCE_VOCABULARY} ${template.title}. ${
    flagged.length ? 'Points non conformes' : 'Points contrôlés'
  } : ${listed}. Remarques :`;

  // comfort checks before sending (the server checks again)
  const findProblems = () => {
    const problems = [];
    if (!equipment.trim()) problems.push("Renseigner l'emplacement / l'équipement.");
    // the picker caps at today, but a sheet left open past midnight can still drift
    if (inspectionDate > todayLocal()) problems.push('La date du contrôle ne peut pas être dans le futur.');
    for (const q of questions) {
      const a = answers[q.id];
      if (!a?.value?.trim()) problems.push(`Question ${q.position} : pas de réponse.`);
      else if (q.critical && a.value === 'MAUVAIS' && !a.comment?.trim())
        problems.push(`Question ${q.position} : commentaire obligatoire (point critique non conforme).`);
    }
    return problems;
  };

  const onSubmit = async () => {
    const problems = findProblems();
    if (problems.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors(problems);
      return;
    }
    setErrors([]);
    setSending(true);
    // the state is an object keyed by id; the backend expects a list
    const { result: saved, errors: refused } = await apiClient.submitChecklist({
      templateId: template.id,
      equipment: equipment.trim(),
      inspectionDate, // "YYYY-MM-DD" → LocalDate on the server
      remarks,
      answers: questions.map((q) => ({
        itemId: q.id,
        value: answers[q.id].value,
        comment: answers[q.id].comment || null,
      })),
    });
    setSending(false);
    if (saved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(saved);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors(refused);
    }
  };

  return (
    <Screen onBack={router.back}>
      <SheetHeader template={template} />

      <BlurView intensity={45} tint="dark" style={styles.card}>
        <Text style={styles.fieldLabel}>
          Emplacement <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={equipment}
          onChangeText={setEquipment}
          editable={!locked}
          placeholder="ex. MP1"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <DateField value={inspectionDate} onChange={setInspectionDate} locked={locked} />
      </BlurView>

      <ProgressBar answered={answeredCount} total={questions.length} />

      {questions.map((q) => (
        <QuestionRow
          key={q.id}
          question={q}
          answer={answers[q.id]}
          locked={locked}
          onAnswer={onAnswer}
          onComment={onComment}
          dictation={dictation}
          onDictateComment={dictateInto(q.id, 'comment')}
          onDictateValue={dictateInto(q.id, 'value')}
          commentContext={itemContext(q, 'Anomalie constatée :')}
          valueContext={itemContext(q, 'Valeur relevée :')}
        />
      ))}

      <BlurView intensity={45} tint="dark" style={styles.card}>
        <Text style={styles.fieldLabel}>Remarques</Text>
        <DictationInput
          field="remarks"
          dictation={dictation}
          onTranscript={dictateRemarks}
          context={remarksContext}
          locked={locked}
          style={styles.multiline}
          value={remarks}
          onChangeText={setRemarks}
          multiline
          placeholder="Observations générales…"
        />
      </BlurView>

      {errors.length > 0 && <ErrorList errors={errors} />}

      {submitted ? (
        <>
          <ResultBanner status={result.status} />
          <ReportPdf submissionId={result.id} />
          <SubmitButton label="Retour aux formulaires" icon="arrow-back" onPress={router.back} />
        </>
      ) : (
        // a transcript still on its way would miss the submission
        <SubmitButton
          label={voice.status === 'idle' ? 'Envoyer' : 'Dictée en cours…'}
          icon="send"
          loading={sending}
          disabled={sending || voice.status !== 'idle'}
          onPress={onSubmit}
        />
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
              <Text style={styles.backText}>Formulaires</Text>
            </Pressable>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

// ─── Header: type, version, title, instructions ─────────────────────────────
function SheetHeader({ template }) {
  return (
    <View style={styles.sheetHeader}>
      <View style={styles.sheetTags}>
        <Text style={styles.typeTag}>{TYPE_LABELS[template.type] ?? template.type}</Text>
        <Text style={styles.version}>v{template.version}</Text>
      </View>
      <Text style={styles.sheetTitle}>{template.title}</Text>
      {template.instructions ? <Text style={styles.instructions}>{template.instructions}</Text> : null}
    </View>
  );
}

// Date of the inspection, today by default. Android opens the system calendar dialog;
// iOS shows its compact inline picker. maximumDate because the server refuses a future date.
function DateField({ value, onChange, locked }) {
  const onPicked = (event, date) => {
    if (event.type === 'set' && date) onChange(dateToIso(date));
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.dateField, styles.dateFieldIos]}>
        <Text style={styles.fieldLabel}>
          Date du contrôle <Text style={styles.required}>*</Text>
        </Text>
        <DateTimePicker
          value={isoToDate(value)}
          mode="date"
          display="compact"
          maximumDate={new Date()}
          onChange={onPicked}
          disabled={locked}
          locale="fr-FR"
          themeVariant="dark"
        />
      </View>
    );
  }

  const open = () =>
    DateTimePickerAndroid.open({
      value: isoToDate(value),
      mode: 'date',
      maximumDate: new Date(),
      onChange: onPicked,
    });

  return (
    <View style={styles.dateField}>
      <Text style={styles.fieldLabel}>
        Date du contrôle <Text style={styles.required}>*</Text>
      </Text>
      <Pressable
        onPress={open}
        disabled={locked}
        style={({ pressed }) => [styles.input, styles.dateButton, pressed && styles.pressed]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textDim} />
        <Text style={styles.dateText}>
          {frenchDate(value)}
          {value === todayLocal() ? "  · aujourd'hui" : ''}
        </Text>
        {!locked && <Ionicons name="chevron-down" size={18} color={colors.textFaint} />}
      </Pressable>
    </View>
  );
}

function ProgressBar({ answered, total }) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <View style={styles.progress}>
      <View style={styles.progressLabels}>
        <Text style={styles.metaText}>Points de contrôle</Text>
        <Text style={styles.metaText}>
          {answered} / {total} renseignés
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

// ─── One question ───────────────────────────────────────────────────────────
function QuestionRow({
  question,
  answer,
  locked,
  onAnswer,
  onComment,
  dictation,
  onDictateComment,
  onDictateValue,
  commentContext,
  valueContext,
}) {
  const isBad = answer?.value === 'MAUVAIS';
  const commentRequired = isBad && question.critical;

  return (
    <BlurView intensity={45} tint="dark" style={[styles.card, isBad && styles.cardBad]}>
      <View style={styles.questionHead}>
        <View style={styles.position}>
          <Text style={styles.positionText}>{question.position}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.labelFr}>{question.labelFr}</Text>
          {question.labelAr ? <Text style={styles.labelAr}>{question.labelAr}</Text> : null}
          {question.critical && <Text style={styles.critical}>⚠ Critique</Text>}
        </View>
      </View>

      <AnswerControl
        question={question}
        answer={answer}
        locked={locked}
        onAnswer={onAnswer}
        dictation={dictation}
        onDictate={onDictateValue}
        dictationContext={valueContext}
      />

      {isBad && (
        <View style={styles.commentBlock}>
          <Text style={styles.fieldLabel}>
            Commentaire{' '}
            {commentRequired ? <Text style={styles.required}>(obligatoire)</Text> : '(optionnel)'}
          </Text>
          <DictationInput
            field={`comment:${question.id}`}
            dictation={dictation}
            onTranscript={onDictateComment}
            context={commentContext}
            locked={locked}
            style={styles.multiline}
            value={answer?.comment ?? ''}
            onChangeText={(text) => onComment(question.id, text)}
            multiline
            placeholder="Décrire l'anomalie constatée…"
          />
          {commentRequired && (
            <Text style={styles.warningText}>
              Point critique non conforme : ne pas commencer les travaux, prévenir le responsable.
            </Text>
          )}
        </View>
      )}
    </BlurView>
  );
}

// Picks the input to draw from the question's answerType
function AnswerControl({ question, answer, locked, onAnswer, dictation, onDictate, dictationContext }) {
  switch (question.answerType) {
    case 'BON_MAUVAIS':
      return (
        <View style={styles.choices}>
          <ChoiceButton
            label="Bon"
            tone="good"
            selected={answer?.value === 'BON'}
            disabled={locked}
            onPress={() => onAnswer(question.id, 'BON')}
          />
          <ChoiceButton
            label="Mauvais"
            tone="bad"
            selected={answer?.value === 'MAUVAIS'}
            disabled={locked}
            onPress={() => onAnswer(question.id, 'MAUVAIS')}
          />
        </View>
      );
    case 'TEXT':
      return (
        <View style={styles.answerInput}>
          <DictationInput
            field={`value:${question.id}`}
            dictation={dictation}
            onTranscript={onDictate}
            context={dictationContext}
            locked={locked}
            value={answer?.value ?? ''}
            onChangeText={(text) => onAnswer(question.id, text)}
            placeholder="Saisir une valeur…"
          />
        </View>
      );
    case 'IMAGE':
      // photo upload isn't built yet (needs its own backend endpoint)
      return (
        <View style={styles.photoSoon}>
          <Text style={styles.metaText}>📷 Photo : bientôt disponible</Text>
        </View>
      );
    default:
      return <Text style={styles.metaText}>Type de réponse inconnu</Text>;
  }
}

function ChoiceButton({ label, tone, selected, disabled, onPress }) {
  const good = tone === 'good';
  const toneColor = good ? colors.success : colors.danger;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.choice,
        selected && {
          borderColor: toneColor,
          backgroundColor: good ? colors.successFill : colors.dangerFill,
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={good ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={selected ? toneColor : colors.textFaint}
      />
      <Text style={[styles.choiceText, selected && { color: toneColor }]}>{label}</Text>
    </Pressable>
  );
}

// A text field with a mic beside it. `field` names it so the sheet's single recorder
// knows which field the "recording…" line and errors belong to; `context` says what
// the technician is describing, for the transcriber.
function DictationInput({ field, dictation, onTranscript, context, locked, style, ...inputProps }) {
  const mine = dictation.field === field;
  const recording = mine && dictation.status === 'recording';
  const transcribing = mine && dictation.status === 'transcribing';

  return (
    <View>
      <View style={styles.dictationRow}>
        <TextInput
          editable={!locked}
          placeholderTextColor={colors.placeholder}
          {...inputProps}
          style={[styles.input, styles.flex, style]}
        />
        <Pressable
          onPress={() => dictation.toggle(field, onTranscript, context)}
          disabled={locked || dictation.status === 'transcribing'}
          hitSlop={8}
          style={({ pressed }) => [
            styles.mic,
            recording && styles.micRecording,
            (pressed || locked) && styles.pressed,
          ]}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons
              name={recording ? 'stop' : 'mic'}
              size={20}
              color={recording ? colors.danger : colors.textStrong}
            />
          )}
        </Pressable>
      </View>
      {recording && (
        <Text style={styles.dictationHint}>
          ● Enregistrement {formatDuration(dictation.durationMillis)} · toucher ■ pour arrêter
        </Text>
      )}
      {transcribing && <Text style={styles.dictationHint}>Transcription…</Text>}
      {mine && dictation.error ? <Text style={styles.warningText}>{dictation.error}</Text> : null}
    </View>
  );
}

// ─── Errors, outcome and button ─────────────────────────────────────────────
function ErrorList({ errors }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={[styles.errorText, styles.bold]}>Le formulaire ne peut pas être envoyé :</Text>
      {errors.map((e, i) => (
        <Text key={i} style={styles.errorText}>
          • {e}
        </Text>
      ))}
    </View>
  );
}

// The PDF of the sent sheet. Its pages are shown in place, as images the server renders
// (the app has no PDF viewer); the buttons get the real file. It's rebuilt from the saved
// submission on each request — nothing about the PDF is stored.
function ReportPdf({ submissionId }) {
  const [pages, setPages] = useState(null); // base64 PNGs; null while loading
  const [previewError, setPreviewError] = useState(false);
  const [busy, setBusy] = useState(null); // 'save' | 'share' | null
  const [message, setMessage] = useState(null); // { ok, text } under the buttons
  const downloaded = useRef(null); // the PDF File, fetched once for both buttons

  const loadPreview = useCallback(async () => {
    setPreviewError(false);
    setPages(null);
    const data = await apiClient.getSubmissionPreview(submissionId);
    if (data?.pages?.length) setPages(data.pages);
    else setPreviewError(true);
  }, [submissionId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const pdfFile = async () => {
    if (!downloaded.current) downloaded.current = await apiClient.downloadSubmissionPdf(submissionId);
    return downloaded.current;
  };

  // Android opens its folder picker (Téléchargements, Drive…): an app may only write
  // into shared storage where the user points it.
  const onSave = async () => {
    setBusy('save');
    setMessage(null);
    const file = await pdfFile();
    if (!file) {
      setMessage({ ok: false, text: 'Téléchargement impossible. Vérifier la connexion et réessayer.' });
      setBusy(null);
      return;
    }
    let folder;
    try {
      folder = await Directory.pickDirectoryAsync();
    } catch {
      setBusy(null); // picker closed without choosing a folder
      return;
    }
    try {
      folder.createFile(file.name, 'application/pdf').write(await file.bytes());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage({ ok: true, text: `Enregistré : ${file.name}` });
    } catch (e) {
      console.error('saving the pdf failed', e);
      setMessage({ ok: false, text: "Impossible d'enregistrer dans ce dossier. En choisir un autre." });
    }
    setBusy(null);
  };

  const onShare = async () => {
    setBusy('share');
    setMessage(null);
    const file = await pdfFile();
    if (!file) {
      setMessage({ ok: false, text: 'Téléchargement impossible. Vérifier la connexion et réessayer.' });
    } else if (!(await Sharing.isAvailableAsync())) {
      setMessage({ ok: false, text: "Le partage n'est pas disponible sur cet appareil." });
    } else {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Partager le rapport',
      });
    }
    setBusy(null);
  };

  return (
    <BlurView intensity={45} tint="dark" style={[styles.card, styles.reportCard]}>
      <Text style={styles.fieldLabel}>Rapport PDF</Text>

      {pages === null && !previewError && (
        <View style={styles.reportLoading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.metaText}>Génération du rapport…</Text>
        </View>
      )}

      {previewError && (
        <View style={styles.reportLoading}>
          <Text style={styles.errorText}>L&apos;aperçu n&apos;a pas pu être chargé.</Text>
          <Pressable
            onPress={loadPreview}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Ionicons name="refresh" size={16} color={colors.text} />
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      )}

      {pages?.map((page, i) => (
        <View key={i} style={styles.reportPage}>
          <Image
            source={{ uri: `data:image/png;base64,${page}` }}
            style={styles.reportPageImage}
            resizeMode="contain"
            accessibilityLabel={`Page ${i + 1} du rapport`}
          />
        </View>
      ))}
      {pages?.length > 1 && (
        <Text style={[styles.metaText, styles.centeredText]}>{pages.length} pages</Text>
      )}

      <View style={styles.reportActions}>
        <Pressable
          onPress={onSave}
          disabled={busy !== null}
          style={({ pressed }) => [styles.reportButton, (pressed || busy) && styles.pressed]}
        >
          {busy === 'save' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons name="download-outline" size={18} color={colors.text} />
          )}
          <Text style={styles.reportButtonText}>Télécharger</Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          disabled={busy !== null}
          style={({ pressed }) => [styles.reportButton, (pressed || busy) && styles.pressed]}
        >
          {busy === 'share' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons name="share-social-outline" size={18} color={colors.text} />
          )}
          <Text style={styles.reportButtonText}>Partager</Text>
        </Pressable>
      </View>

      {message && (
        <Text style={[styles.reportMessage, { color: message.ok ? colors.success : colors.danger }]}>
          {message.text}
        </Text>
      )}
    </BlurView>
  );
}

function ResultBanner({ status }) {
  const info = STATUS_INFO[status] ?? STATUS_INFO.DRAFT;
  return (
    <View style={[styles.resultBanner, { borderColor: info.border, backgroundColor: info.fill }]}>
      <Ionicons name="checkmark-done" size={20} color={info.color} />
      <Text style={[styles.resultText, { color: info.color }]}>
        Envoyé · {info.label ?? status}
      </Text>
    </View>
  );
}

function SubmitButton({ label, icon, loading, disabled, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.buttonWrap, (pressed || disabled) && styles.pressed]}
    >
      <LinearGradient
        colors={gradients.accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Ionicons name={icon} size={18} color={colors.text} />
            <Text style={styles.buttonText}>{label}</Text>
          </>
        )}
      </LinearGradient>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
  required: {
    color: colors.danger,
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
    // Android centres multiline text vertically by default
    textAlignVertical: 'top',
  },
  answerInput: {
    marginTop: 12,
  },
  dictationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
  },
  micRecording: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerFill,
  },
  dictationHint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textDim,
  },
  dateField: {
    marginTop: 14,
  },
  dateFieldIos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  metaText: {
    fontSize: 13,
    color: colors.textDim,
  },
  progress: {
    marginTop: 4,
    marginBottom: 14,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
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
  choiceText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  photoSoon: {
    marginTop: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.glassBorderStrong,
    paddingVertical: 12,
  },
  commentBlock: {
    marginTop: 14,
  },
  warningText: {
    marginTop: 6,
    fontSize: 12,
    color: colors.danger,
  },
  errorBanner: {
    gap: 4,
    marginBottom: 12,
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
  bold: {
    fontWeight: '700',
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
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.banner,
    borderWidth: 1,
    padding: 12,
  },
  reportCard: {
    marginTop: 12,
    marginBottom: 0,
  },
  reportLoading: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  // a sheet of paper: white whatever the theme, A4 proportions like the PDF
  reportPage: {
    marginBottom: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  reportPageImage: {
    width: '100%',
    aspectRatio: 210 / 297,
  },
  centeredText: {
    textAlign: 'center',
  },
  reportActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  reportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    backgroundColor: colors.glassFill,
    paddingVertical: 12,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  reportMessage: {
    marginTop: 10,
    fontSize: 13,
  },
  resultText: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonWrap: {
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.accentDeep,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  button: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
