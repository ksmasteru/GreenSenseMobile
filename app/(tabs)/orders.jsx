// Work orders the signed-in manager assigned, still in progress on the technicians' side.
//
//   list ← GET /api/v1/task/assigned   ({ tasks: [...], tasksCount }, each with technicianEmail)
//
// Same layout as the Techniciens tab: tap a card to open it in place and read its
// instructions. Reloaded every time the tab comes into view, so an order just created on
// the assign screen shows up without pulling to refresh.
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
import { useFocusEffect } from 'expo-router';
import * as apiClient from '@/services/apiClient';
import { colors, gradients, radius } from '@/constants/app-theme';

// highest first; matches TaskPriority on the backend
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

const PRIORITY_LABEL = { URGENT: 'Urgente', HIGH: 'Haute', NORMAL: 'Normale', LOW: 'Basse' };

// badge colours, from the theme's status triples (same as the Tâches tab)
const PRIORITY_STYLE = {
  URGENT: { color: colors.danger, borderColor: colors.dangerBorder, backgroundColor: colors.dangerFill },
  HIGH: { color: colors.warning, borderColor: colors.warningBorder, backgroundColor: colors.warningFill },
  NORMAL: { color: colors.accent, borderColor: colors.accentBubble, backgroundColor: colors.accentWash },
  LOW: { color: colors.textMuted, borderColor: colors.glassBorder, backgroundColor: colors.glassFill },
};

// what the manager needs to notice: blocked and returned orders stand out
const STATUS_INFO = {
  ASSIGNED: { label: 'Assignée', icon: 'ellipse-outline', color: colors.textDim },
  STARTED: { label: 'En cours', icon: 'play-circle-outline', color: colors.success },
  BLOCKED: { label: 'Bloquée', icon: 'hand-left-outline', color: colors.warning },
  RETURNED: { label: 'À corriger', icon: 'arrow-undo-outline', color: colors.danger },
};

// fallback for a status missing above: "IN_PROGRESS" -> "In progress"
const humanize = (value) =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—';

// by priority, then earliest due date (orders without a due date last)
const byPriority = (a, b) => {
  const rank = (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
  if (rank !== 0) return rank;
  if (!a.dueDate) return b.dueDate ? 1 : 0;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
};

const Orders = () => {
  const [orders, setOrders] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState(null); // the server's message, or null
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState(null);

  const loadOrders = useCallback(async () => {
    const { result, error } = await apiClient.getAssignedTasks();
    setLoadError(error ?? null);
    setOrders([...(result?.tasks ?? [])].sort(byPriority));
  }, []);

  // useFocusEffect instead of useEffect: a tab stays mounted, so useEffect would only
  // load once. It needs a stable callback, which is why loadOrders is a useCallback.
  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const onRetry = () => {
    setOrders(null);
    loadOrders();
  };

  const toggle = (id) => {
    Haptics.selectionAsync();
    setOpenId((current) => (current === id ? null : id));
  };

  const loading = orders === null;

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
                  <Ionicons name="list" size={40} color={colors.text} />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Ordres de travail</Text>
              <Text style={styles.subtitle}>Les tâches que vous avez assignées</Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(700).delay(150).springify()}>
              {loading && (
                <View style={styles.centered}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.hint}>Chargement des ordres…</Text>
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

              {!loading && !loadError && orders.length === 0 && <EmptyState />}

              {!loading && orders.length > 0 && (
                <Text style={styles.groupHeading}>Ordres actifs · {orders.length}</Text>
              )}

              {!loading &&
                orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isOpen={openId === order.id}
                    onPress={() => toggle(order.id)}
                  />
                ))}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

// one order: title + priority badge, who it's for, equipment, due date and where it stands;
// opens in place to show the instructions
const OrderCard = ({ order, isOpen, onPress }) => {
  const priority = PRIORITY_STYLE[order.priority] ?? PRIORITY_STYLE.LOW;
  const status = STATUS_INFO[order.status];

  return (
    <Animated.View layout={LinearTransition} exiting={FadeOut} style={styles.cardWrap}>
      <BlurView intensity={45} tint="dark" style={[styles.card, isOpen && styles.cardOpen]}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={isOpen ? undefined : 2}>
              {order.title}
            </Text>
            <Text style={[styles.priority, priority]}>{PRIORITY_LABEL[order.priority] ?? order.priority}</Text>
          </View>

          <View style={styles.meta}>
            <Meta icon="person-outline" text={order.technicianEmail ?? '—'} />
            <Meta icon="construct-outline" text={order.equipmentId} />
            <Meta icon="calendar-outline" text={order.dueDate ?? 'Sans échéance'} />
            <Meta
              icon={status?.icon ?? 'ellipse-outline'}
              text={status?.label ?? humanize(order.status)}
              color={status?.color}
            />
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
            <Text style={styles.sectionLabel}>Consignes</Text>
            <Text style={styles.instructions}>{order.instructions || 'Aucune consigne.'}</Text>
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

const EmptyState = () => (
  <View style={styles.empty}>
    <Text style={styles.emptyIcon}>📋</Text>
    <Text style={styles.emptyTitle}>Aucun ordre en cours</Text>
    <Text style={styles.hint}>
      Assignez une tâche depuis l&apos;onglet Tâche. Tirez vers le bas pour actualiser.
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

export default Orders;
