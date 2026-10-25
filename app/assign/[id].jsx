// Assign screen: a manager fills a task order for one technician and sends it.
// Pushed from the Techniciens tab with { id, name } as params, where id is the
// technician's email: the backend identifies users by email, not by an id.
// Sends TaskController's POST /api/v1/task/new through apiClient.createTask(),
// with the checklist the technician will fill, picked from the active templates
// (GET /api/v1/forms/options, the same list the Forms tab shows).
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as apiClient from '@/services/apiClient';
import { colors, gradients, radius } from '@/constants/app-theme';

// TaskType on the backend
const TASK_TYPES = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'PREVENTIVE', label: 'Préventive' },
  { value: 'CORRECTIVE', label: 'Corrective' },
];

// TaskPriority on the backend, NORMAL being its default; colours match the
// badges on the Tasks tab
const PRIORITIES = [
  { value: 'LOW', label: 'Basse', color: colors.textMuted },
  { value: 'NORMAL', label: 'Normale', color: colors.accent },
  { value: 'HIGH', label: 'Haute', color: colors.warning },
  { value: 'URGENT', label: 'Urgente', color: colors.danger },
];

// ChecklistType badges, same wording and colours as the Forms tab
const TEMPLATE_TYPES = {
  INSPECTION: { label: 'Inspection', color: colors.accent },
  PERMIT: { label: 'Permis', color: colors.warning },
};

// Date ↔ "YYYY-MM-DD" in the user's own timezone, same as the form screen:
// toISOString() would use UTC and could shift the day.
const dateToIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isoToDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const frenchDate = (iso) => iso.split('-').reverse().join('/');

export default function AssignTaskScreen() {
  const router = useRouter();
  const { id: technicianEmail, name } = useLocalSearchParams();

  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState(null);
  const [priority, setPriority] = useState('NORMAL');
  const [templates, setTemplates] = useState(null); // null while loading
  const [templatesError, setTemplatesError] = useState(false);
  const [templateId, setTemplateId] = useState(null);
  const [equipmentId, setEquipmentId] = useState('');
  const [dueDate, setDueDate] = useState(null); // "YYYY-MM-DD", or null for no deadline
  const [instructions, setInstructions] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState([]);

  // only active templates come back, so anything listed can be sent
  const loadTemplates = useCallback(async () => {
    const data = await apiClient.getFormOptions();
    setTemplatesError(!data);
    setTemplates([...(data?.FormItem ?? [])].sort((a, b) => a.title.localeCompare(b.title, 'fr')));
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const retryTemplates = () => {
    setTemplates(null);
    loadTemplates();
  };

  // the fields TaskCreationDto refuses when missing, plus the checklist: optional
  // on the server, but every order sent from here comes with one
  const ready = title.trim() !== '' && taskType !== null && templateId !== null && equipmentId.trim() !== '';

  const submit = async () => {
    setSending(true);
    setErrors([]);
    const { errors: refused } = await apiClient.createTask({
      title: title.trim(),
      taskType,
      priority,
      templateId,
      technicianEmail,
      equipmentId: equipmentId.trim(),
      instructions: instructions.trim() || null,
      dueDate,
    });
    if (refused) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors(refused);
      setSending(false);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Tâche assignée', `« ${title.trim()} » a été envoyée à ${name || technicianEmail}.`);
    router.back();
  };

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
              onPress={router.back}
              hitSlop={12}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
              <Text style={styles.backText}>Techniciens</Text>
            </Pressable>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
                <Text style={styles.title}>Nouvelle tâche</Text>
                <View style={styles.assignee}>
                  <Ionicons name="person-circle-outline" size={20} color={colors.accent} />
                  <View>
                    <Text style={styles.assigneeName}>{name || technicianEmail}</Text>
                    {name ? <Text style={styles.assigneeEmail}>{technicianEmail}</Text> : null}
                  </View>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInUp.duration(700).delay(150).springify()}>
                <BlurView intensity={45} tint="dark" style={styles.card}>
                  <Field label="Titre" required>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      editable={!sending}
                      placeholder="Ex. : Remplacer le joint de la pompe P2"
                      placeholderTextColor={colors.placeholder}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Type d'intervention" required>
                    <Chips options={TASK_TYPES} value={taskType} onChange={setTaskType} disabled={sending} />
                  </Field>

                  <Field label="Priorité">
                    <Chips options={PRIORITIES} value={priority} onChange={setPriority} disabled={sending} />
                  </Field>

                  <Field label="Rapport à remplir" required>
                    <TemplatePicker
                      templates={templates}
                      error={templatesError}
                      value={templateId}
                      onChange={setTemplateId}
                      onRetry={retryTemplates}
                      disabled={sending}
                    />
                  </Field>

                  <Field label="Équipement" required>
                    <TextInput
                      value={equipmentId}
                      onChangeText={setEquipmentId}
                      editable={!sending}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="Ex. : MP1"
                      placeholderTextColor={colors.placeholder}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Échéance">
                    <DueDateField value={dueDate} onChange={setDueDate} disabled={sending} />
                  </Field>

                  <Field label="Instructions" last>
                    <TextInput
                      value={instructions}
                      onChangeText={setInstructions}
                      editable={!sending}
                      multiline
                      placeholder="Ce que le technicien doit savoir avant d'intervenir"
                      placeholderTextColor={colors.placeholder}
                      style={[styles.input, styles.multiline]}
                    />
                  </Field>
                </BlurView>

                {errors.length > 0 && (
                  <View style={styles.errorBanner}>
                    {errors.map((message) => (
                      <Text key={message} style={styles.errorText}>
                        {message}
                      </Text>
                    ))}
                  </View>
                )}

                <Pressable
                  onPress={submit}
                  disabled={!ready || sending}
                  style={({ pressed }) => [styles.submitWrap, (!ready || sending) && styles.disabled, pressed && styles.pressed]}
                >
                  <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                    {sending ? (
                      <ActivityIndicator color={colors.text} />
                    ) : (
                      <Ionicons name="send" size={18} color={colors.text} />
                    )}
                    <Text style={styles.submitText}>Assigner la tâche</Text>
                  </LinearGradient>
                </Pressable>
                {!ready && <Text style={styles.hint}>Titre, type, checklist et équipement sont obligatoires.</Text>}
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const Field = ({ label, required, last, children }) => (
  <View style={[styles.field, last && styles.fieldLast]}>
    <Text style={styles.fieldLabel}>
      {label} {required && <Text style={styles.required}>*</Text>}
    </Text>
    {children}
  </View>
);

// one choice out of a few; the selected chip takes the option's colour
const Chips = ({ options, value, onChange, disabled }) => (
  <View style={styles.chips}>
    {options.map((option) => {
      const selected = value === option.value;
      const tone = option.color ?? colors.accent;
      return (
        <Pressable
          key={option.value}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(option.value);
          }}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
          style={({ pressed }) => [
            styles.chip,
            selected && { borderColor: tone, backgroundColor: colors.accentWash },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.chipText, selected && { color: tone, fontWeight: '600' }]}>{option.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

// The active checklist templates as a list of radio rows, by name. Loading, a failed
// load (with retry) and "none active" each get their own line instead of the list.
function TemplatePicker({ templates, error, value, onChange, onRetry, disabled }) {
  if (templates === null)
    return (
      <View style={styles.templateState}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.templateStateText}>Chargement des checklists…</Text>
      </View>
    );

  if (error)
    return (
      <View style={styles.templateState}>
        <Text style={[styles.templateStateText, { color: colors.danger }]}>
          Les checklists n&apos;ont pas pu être chargées.
        </Text>
        <Pressable onPress={onRetry} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      </View>
    );

  if (templates.length === 0)
    return (
      <View style={styles.templateState}>
        <Text style={styles.templateStateText}>Aucune checklist active pour le moment.</Text>
      </View>
    );

  return (
    <View style={styles.templateList}>
      {templates.map((template) => {
        const selected = value === template.id;
        const type = TEMPLATE_TYPES[template.type];
        return (
          <Pressable
            key={template.id}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(template.id);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.templateRow, selected && styles.templateRowSelected, pressed && styles.pressed]}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={selected ? colors.accent : colors.textFaint}
            />
            <Text style={[styles.templateTitle, selected && { color: colors.text }]} numberOfLines={2}>
              {template.title}
            </Text>
            {type && <Text style={[styles.templateType, { color: type.color }]}>{type.label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

// Optional deadline, never before today. Android opens the system calendar dialog;
// iOS shows its compact inline picker once a date is set. The × clears it again.
function DueDateField({ value, onChange, disabled }) {
  const onPicked = (event, date) => {
    if (event.type === 'set' && date) onChange(dateToIso(date));
  };

  const clear = value ? (
    <Pressable onPress={() => onChange(null)} disabled={disabled} hitSlop={10} style={styles.clear}>
      <Ionicons name="close-circle" size={20} color={colors.textFaint} />
    </Pressable>
  ) : null;

  if (Platform.OS === 'ios' && value) {
    return (
      <View style={styles.dateRow}>
        <DateTimePicker
          value={isoToDate(value)}
          mode="date"
          display="compact"
          minimumDate={new Date()}
          onChange={onPicked}
          disabled={disabled}
          locale="fr-FR"
          themeVariant="dark"
        />
        {clear}
      </View>
    );
  }

  const open = () => {
    if (Platform.OS === 'ios') {
      onChange(dateToIso(new Date())); // shows the inline picker, starting at today
      return;
    }
    DateTimePickerAndroid.open({
      value: value ? isoToDate(value) : new Date(),
      mode: 'date',
      minimumDate: new Date(),
      onChange: onPicked,
    });
  };

  return (
    <View style={styles.dateRow}>
      <Pressable
        onPress={open}
        disabled={disabled}
        style={({ pressed }) => [styles.input, styles.dateButton, pressed && styles.pressed]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textDim} />
        <Text style={[styles.dateText, !value && { color: colors.placeholder }]}>
          {value ? frenchDate(value) : 'Aucune échéance'}
        </Text>
      </Pressable>
      {clear}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  assignee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBubble,
    backgroundColor: colors.accentWash,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  assigneeName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  assigneeEmail: {
    fontSize: 12,
    color: colors.textDim,
  },
  card: {
    borderRadius: radius.bubble,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  field: {
    marginBottom: 18,
  },
  fieldLast: {
    marginBottom: 0,
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
    minHeight: 96,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  templateList: {
    gap: 8,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  templateRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentWash,
  },
  templateTitle: {
    flex: 1,
    fontSize: 15,
    color: colors.textStrong,
  },
  templateType: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  templateState: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 6,
  },
  templateStateText: {
    fontSize: 14,
    color: colors.textFaint,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    color: colors.text,
  },
  clear: {
    padding: 2,
  },
  errorBanner: {
    gap: 4,
    marginTop: 14,
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
  submitWrap: {
    marginTop: 20,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textFaint,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
