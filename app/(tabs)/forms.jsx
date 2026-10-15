// List of the active forms, the mobile twin of the web app's Forms.jsx.
//
//   options ← GET /api/v1/forms/options   ({ FormItem: [{ id, title, type }], formsCount })
//   tap     → pushes app/form/[id].jsx, which fetches and fills the chosen form
//
// The web page picks a form and shows it underneath on the same page. A phone
// has no room for both, so the sheet opens as its own screen and the Android
// back button returns here.
import { useCallback, useEffect, useState } from 'react';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as apiClient from '@/services/apiClient';
import { colors, gradients, radius } from '@/constants/app-theme';

// how each checklist type is shown in the list (same groups as the web picker)
const TYPE_INFO = {
  INSPECTION: { group: 'Inspections', badge: 'Inspection', icon: 'search', color: colors.accent },
  PERMIT: { group: 'Work permits', badge: 'Permit', icon: 'flame', color: colors.warning },
};

const Forms = () => {
  const router = useRouter();
  const [options, setOptions] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadOptions = useCallback(async () => {
    const data = await apiClient.getFormOptions();
    setLoadError(!data);
    setOptions(data?.formsCount > 0 ? data.FormItem : []);
  }, []);

  // the active forms only need loading once; pull down to reload
  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOptions();
    setRefreshing(false);
  };

  const onRetry = () => {
    setOptions(null);
    loadOptions();
  };

  const openForm = (form) => {
    Haptics.selectionAsync();
    router.push(`/form/${form.id}`);
  };

  // one section per type, skipping the empty ones
  const groups = Object.keys(TYPE_INFO)
    .map((type) => ({ type, forms: (options ?? []).filter((f) => f.type === type) }))
    .filter((g) => g.forms.length > 0);

  const loading = options === null;

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
                  <Ionicons name="clipboard" size={40} color={colors.text} />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Forms</Text>
              <Text style={styles.subtitle}>
                Choose an inspection checklist or a work permit, fill it in, and send it.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(700).delay(150).springify()}>
              {loading && (
                <View style={styles.centered}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.hint}>Loading forms…</Text>
                </View>
              )}

              {!loading && loadError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>
                    The list of forms could not be loaded. Check your connection and try again.
                  </Text>
                  <Pressable
                    onPress={onRetry}
                    style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                  >
                    <Ionicons name="refresh" size={16} color={colors.text} />
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              )}

              {!loading && !loadError && groups.length === 0 && <EmptyState />}

              {groups.map(({ type, forms }) => (
                <View key={type} style={styles.group}>
                  <Text style={styles.groupHeading}>
                    {TYPE_INFO[type].group} · {forms.length}
                  </Text>
                  {forms.map((form) => (
                    <FormCard key={form.id} form={form} onPress={() => openForm(form)} />
                  ))}
                </View>
              ))}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

// one form in the list: type icon, title, badge
const FormCard = ({ form, onPress }) => {
  const info = TYPE_INFO[form.type];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}>
      <BlurView intensity={45} tint="dark" style={styles.card}>
        <View style={[styles.cardIcon, { borderColor: info.color }]}>
          <Ionicons name={info.icon} size={20} color={info.color} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {form.title}
          </Text>
          <Text style={[styles.badge, { color: info.color }]}>{info.badge}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </BlurView>
    </Pressable>
  );
};

const EmptyState = () => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>📋</Text>
    <Text style={styles.emptyTitle}>No active form</Text>
    <Text style={styles.hint}>Forms created on the web app show up here. Pull down to reload.</Text>
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
  group: {
    marginBottom: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.bubble,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassFill,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
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

export default Forms;
