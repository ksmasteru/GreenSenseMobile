// Fillable checklist opened from the Forms tab. The sheet itself (template, answers,
// photos, dictation, submit, PDF) is components/checklist-sheet.jsx, shared with a task's
// Report tab; this screen only adds the frame: background, back button, scrolling.
import {
  ImageBackground,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChecklistSheet } from '@/components/checklist-sheet';
import { colors, gradients } from '@/constants/app-theme';

export default function FillForm() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  return (
    <Screen onBack={router.back}>
      <ChecklistSheet templateId={id} closeLabel="Retour aux formulaires" onClose={router.back} />
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
});
