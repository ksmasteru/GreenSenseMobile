// Work screen for one accepted task. See TASK_FLOW_DESIGN.md: one screen per task with three
// tabs, pushed above (tabs) so the app's own tab bar is hidden.
//
//   header   ← task title, equipment, status, work timer
//   Details  ← instructions and facts about the job, Block lives here
//   Ask      ← the chat, scoped to this task
//   Report   ← the checklist the manager picked (templateId), equipment taken from the task;
//              Submit lives here only
//
// The title / equipment / location / due date / instructions / templateId come from the Tasks
// list as route params. The Report tab is the real sheet (components/checklist-sheet.jsx, the
// same one the Forms tab opens); the rest is still placeholder data (MOCK_*) and its buttons
// (Bloquer, the chat) send nothing yet.
import { useState } from 'react';
import {
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
import { ChecklistSheet } from '@/components/checklist-sheet';
import { colors, gradients, radius } from '@/constants/app-theme';

// stands in for anything the list didn't pass
const MOCK_TASK = {
  title: 'Fuite garniture 23AP08',
  equipmentId: '2503523',
  location: 'Hall B · Station de pompage',
  dueDate: '2026-10-21',
  priority: 'HIGH',
  status: 'STARTED',
  instructions:
    'Fuite constatée au niveau de la garniture mécanique.\n' +
    '1. Consigner la pompe avant intervention.\n' +
    '2. Vérifier le serrage du presse-étoupe.\n' +
    '3. Remplacer la garniture si la fuite persiste.',
  acceptedAt: "Aujourd'hui, 09:14",
  timer: '0:42',
};

const MOCK_MESSAGES = [
  { role: 'user', text: 'Quel couple de serrage pour le presse-étoupe de la 23AP08 ?' },
  {
    role: 'assistant',
    text:
      'Serrer les écrous du presse-étoupe en croix, à 25 N·m, en deux passes. ' +
      'Une légère fuite goutte à goutte est normale au démarrage.',
    sources: ['Manuel P-200 · p.42', 'Procédure MP-07'],
  },
];

const TABS = [
  { key: 'details', label: 'Détails', icon: ['document-text', 'document-text-outline'] },
  { key: 'ask', label: 'Assistant', icon: ['chatbubbles', 'chatbubbles-outline'] },
  { key: 'report', label: 'Rapport', icon: ['clipboard', 'clipboard-outline'] },
];

const PRIORITY_LABEL = { URGENT: 'Urgente', HIGH: 'Haute', NORMAL: 'Normale', LOW: 'Basse' };

const PRIORITY_STYLE = {
  URGENT: { color: colors.danger, borderColor: colors.dangerBorder, backgroundColor: colors.dangerFill },
  HIGH: { color: colors.warning, borderColor: colors.warningBorder, backgroundColor: colors.warningFill },
  NORMAL: { color: colors.accent, borderColor: colors.accentBubble, backgroundColor: colors.accentWash },
  LOW: { color: colors.textMuted, borderColor: colors.glassBorder, backgroundColor: colors.glassFill },
};

export default function TaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // route params arrive as strings, "" when the list had no value
  const passed = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  const task = { ...MOCK_TASK, ...passed };

  const [tab, setTab] = useState('details');
  // what the sheet reports back: { template, answered, total, submitted }, null until it loads
  const [report, setReport] = useState(null);

  const reportBadge =
    report?.total && !report.submitted ? `${report.answered}/${report.total}` : null;

  const switchTab = (key) => {
    if (key === tab) return;
    Haptics.selectionAsync();
    setTab(key);
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
            <TaskHeader task={task} onBack={() => router.back()} />

            {/* all three stay mounted so a chat or a half-filled report survives a tab switch */}
            <View style={styles.flex}>
              <View style={[styles.flex, tab !== 'details' && styles.hidden]}>
                <DetailsTab task={task} reportTitle={report?.template?.title} />
              </View>
              <View style={[styles.flex, tab !== 'ask' && styles.hidden]}>
                <AskTab />
              </View>
              <View style={[styles.flex, tab !== 'report' && styles.hidden]}>
                <ScrollView contentContainerStyle={styles.reportContent} keyboardShouldPersistTaps="handled">
                  {task.templateId ? (
                    <ChecklistSheet
                      templateId={task.templateId}
                      taskId={task.id}
                      fixedEquipment={task.equipmentId}
                      closeLabel="Retour aux tâches"
                      onClose={router.back}
                      onStatus={setReport}
                    />
                  ) : (
                    <NoReport />
                  )}
                </ScrollView>
              </View>
            </View>

            <ActionBar tab={tab} onOpenReport={() => switchTab('report')} />
            <TaskTabBar
              active={tab}
              onChange={switchTab}
              reportBadge={reportBadge}
              reportDone={report?.submitted === true}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

// ─── Header: back, title, equipment · status · timer ────────────────────────
function TaskHeader({ task, onBack }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={styles.backText}>Tâches</Text>
      </Pressable>

      <Text style={styles.headerTitle} numberOfLines={2}>
        {task.title}
      </Text>

      <View style={styles.headerMeta}>
        <View style={styles.metaChip}>
          <Ionicons name="construct-outline" size={13} color={colors.textDim} />
          <Text style={styles.metaChipText}>{task.equipmentId}</Text>
        </View>
        <View style={[styles.metaChip, styles.statusChip]}>
          <View style={styles.liveDot} />
          <Text style={[styles.metaChipText, { color: colors.success }]}>En cours</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="time-outline" size={13} color={colors.textDim} />
          <Text style={[styles.metaChipText, styles.timer]}>{task.timer}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Details tab ────────────────────────────────────────────────────────────
function DetailsTab({ task, reportTitle }) {
  const priority = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.LOW;
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.factGrid}>
        <Fact icon="flag-outline" label="Priorité">
          <Text style={[styles.priority, priority]}>{PRIORITY_LABEL[task.priority] ?? task.priority}</Text>
        </Fact>
        <Fact icon="calendar-outline" label="Échéance" value={task.dueDate} />
        <Fact icon="location-outline" label="Emplacement" value={task.location} />
        <Fact icon="checkmark-done-outline" label="Acceptée" value={task.acceptedAt} />
      </View>

      <BlurView intensity={45} tint="dark" style={styles.card}>
        <Text style={styles.sectionLabel}>Consignes</Text>
        <Text style={styles.bodyText}>{task.instructions}</Text>
      </BlurView>

      <BlurView intensity={45} tint="dark" style={[styles.card, styles.rowCard]}>
        <View style={styles.rowIcon}>
          <Ionicons name="clipboard-outline" size={20} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.sectionLabel}>Rapport à remplir</Text>
          {task.templateId ? (
            <>
              <Text style={styles.rowTitle}>{reportTitle ?? 'Chargement…'}</Text>
              <Text style={styles.hint}>Choisi par votre manager à la création de la tâche</Text>
            </>
          ) : (
            <Text style={styles.rowTitle}>Aucun rapport pour cette tâche</Text>
          )}
        </View>
      </BlurView>
    </ScrollView>
  );
}

// ─── Report tab without a checklist ─────────────────────────────────────────
// tasks created before templateId existed, or by a manager who didn't pick one
function NoReport() {
  return (
    <View style={styles.noReport}>
      <Ionicons name="clipboard-outline" size={28} color={colors.textFaint} />
      <Text style={styles.rowTitle}>Aucun rapport pour cette tâche</Text>
      <Text style={[styles.hint, styles.centeredText]}>
        Votre manager n&apos;a pas rattaché de checklist à cette tâche.
      </Text>
    </View>
  );
}

function Fact({ icon, label, value, children }) {
  return (
    <BlurView intensity={45} tint="dark" style={styles.fact}>
      <View style={styles.factLabelRow}>
        <Ionicons name={icon} size={13} color={colors.textFaint} />
        <Text style={styles.factLabel}>{label}</Text>
      </View>
      {children ?? (
        <Text style={styles.factValue} numberOfLines={2}>
          {value ?? '—'}
        </Text>
      )}
    </BlurView>
  );
}

// ─── Ask tab ────────────────────────────────────────────────────────────────
function AskTab() {
  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.chatContent}>
        <View style={styles.contextPill}>
          <Ionicons name="link-outline" size={14} color={colors.accent} />
          <Text style={styles.contextText}>Les questions posées ici sont rattachées à cette tâche</Text>
        </View>

        {MOCK_MESSAGES.map((m, i) =>
          m.role === 'user' ? (
            <View key={i} style={[styles.messageRow, styles.messageRowUser]}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{m.text}</Text>
              </View>
            </View>
          ) : (
            <View key={i} style={styles.messageRow}>
              <View style={styles.assistantBubble}>
                <Text style={styles.assistantText}>{m.text}</Text>
                <View style={styles.sources}>
                  {m.sources.map((s) => (
                    <View key={s} style={styles.sourceChip}>
                      <Ionicons name="document-text-outline" size={12} color={colors.accent} />
                      <Text style={styles.sourceText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )
        )}
      </ScrollView>

      <View style={styles.composerBar}>
        <BlurView intensity={55} tint="dark" style={styles.composer}>
          <Pressable hitSlop={8} style={({ pressed }) => [styles.composerIcon, pressed && styles.pressed]}>
            <Ionicons name="camera-outline" size={20} color={colors.textStrong} />
          </Pressable>
          <TextInput
            style={styles.composerInput}
            placeholder="Une question sur cette intervention…"
            placeholderTextColor={colors.placeholder}
            multiline
          />
          <Pressable hitSlop={8} style={({ pressed }) => [styles.composerIcon, pressed && styles.pressed]}>
            <Ionicons name="mic-outline" size={20} color={colors.textStrong} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
            <Ionicons name="arrow-up" size={20} color={colors.text} />
          </Pressable>
        </BlurView>
      </View>
    </View>
  );
}

// ─── Action bar: what the current tab lets you do ───────────────────────────
function ActionBar({ tab, onOpenReport }) {
  // the chat's composer is its own action bar, and the report sheet has its own Envoyer button
  if (tab !== 'details') return null;

  return (
    <View style={styles.actionBar}>
      <BarButton label="Bloquer" icon="hand-left-outline" variant="warning" />
      <BarButton label="Ouvrir le rapport" icon="arrow-forward" variant="primary" iconRight onPress={onOpenReport} />
    </View>
  );
}

const BAR_VARIANTS = {
  warning: { color: colors.warning, borderColor: colors.warningBorder, backgroundColor: colors.warningFill },
};

function BarButton({ label, icon, variant, iconRight, disabled, onPress }) {
  const content = (color) => (
    <>
      {!iconRight && <Ionicons name={icon} size={18} color={color} />}
      <Text style={[styles.barButtonText, { color }]}>{label}</Text>
      {iconRight && <Ionicons name={icon} size={18} color={color} />}
    </>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.barButtonWrap, styles.flex, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.barButton}
        >
          {content(colors.text)}
        </LinearGradient>
      </Pressable>
    );
  }

  const v = BAR_VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.barButtonWrap,
        styles.barButton,
        styles.barButtonOutline,
        { borderColor: v.borderColor, backgroundColor: v.backgroundColor },
        pressed && styles.pressed,
      ]}
    >
      {content(v.color)}
    </Pressable>
  );
}

// ─── Bottom tab bar: Details · Ask · Report ─────────────────────────────────
function TaskTabBar({ active, onChange, reportBadge, reportDone }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const focused = active === t.key;
        const color = focused ? colors.accent : colors.textFaint;
        const showCheck = t.key === 'report' && reportDone;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            style={styles.tabItem}
          >
            <View>
              <Ionicons name={t.icon[focused ? 0 : 1]} size={24} color={color} />
              {t.key === 'report' && reportBadge && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{reportBadge}</Text>
                </View>
              )}
              {showCheck && (
                <View style={[styles.tabBadge, styles.tabBadgeDone]}>
                  <Ionicons name="checkmark" size={10} color={colors.text} />
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, { color }]}>{t.label}</Text>
            {focused && <View style={styles.tabIndicator} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },

  // header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginLeft: -6,
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },
  headerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChip: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successFill,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDim,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  timer: {
    fontVariant: ['tabular-nums'],
    color: colors.textStrong,
  },

  // shared
  tabContent: {
    padding: 20,
    gap: 12,
  },
  // the sheet spaces its own cards, so no gap here
  reportContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  noReport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  centeredText: {
    textAlign: 'center',
  },
  card: {
    borderRadius: radius.bubble,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  bodyText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textStrong,
  },
  hint: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textFaint,
  },

  // details
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fact: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
    borderRadius: radius.banner,
    padding: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  factLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  factValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  priority: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassFill,
  },
  rowTitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  // ask
  chatContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentWash,
    borderWidth: 1,
    borderColor: colors.accentBubble,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  contextText: {
    fontSize: 12,
    color: colors.accent,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: colors.accentBubble,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: {
    color: colors.text,
    fontSize: 15,
  },
  assistantBubble: {
    maxWidth: '88%',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  assistantText: {
    color: colors.textStrong,
    fontSize: 15,
    lineHeight: 21,
  },
  sources: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  sourceText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  composerBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    borderRadius: 24,
    padding: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  composerIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // action bar
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
    backgroundColor: colors.scrimMid,
  },
  barButtonWrap: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  barButtonOutline: {
    borderWidth: 1,
  },
  barButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // tab bar — same look as app/(tabs)/_layout.tsx
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.scrimBottom,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingBottom: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabIndicator: {
    position: 'absolute',
    top: -8,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -16,
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentDeep,
  },
  tabBadgeDone: {
    right: -8,
    minWidth: 16,
    backgroundColor: '#10b981',
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text,
  },
});
