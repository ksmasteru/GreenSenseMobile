import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { colors } from '@/constants/app-theme';
import { useSession } from '@/contexts/session-provider';

// Icons come from Ionicons rather than IconSymbol because every screen in this
// app already draws its icons with Ionicons — mixing SF Symbols into the tab
// bar was the main thing making it read as a different app than the screens
// above it. Each tab shows the filled glyph when active and the outline when
// not, so the selected tab is legible without relying on tint alone.
const ICONS = {
  document: ['document-text', 'document-text-outline'],
  profile: ['person', 'person-outline'],
  upload: ['cloud-upload', 'cloud-upload-outline'],
  ask: ['chatbubbles', 'chatbubbles-outline'],
  forms: ['clipboard', 'clipboard-outline'],
  tasks: ['checkbox', 'checkbox-outline'],
} as const;

function tabIcon(name: keyof typeof ICONS) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={ICONS[name][focused ? 0 : 1]} size={24} color={color} />
  );
}

export default function TabLayout() {
  // Technicians (role USER) work from their tasks: uploading documents and the
  // standalone Forms list are for managers and admins. href: null removes the
  // tab from the bar; it does not protect the route — the backend still has to.
  const { role } = useSession();
  const managerOnly = role === 'USER' ? null : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        // scrimBottom is the last stop of the gradient every screen lays over
        // its background photo, so the bar reads as a continuation of the
        // screen rather than a separate chrome strip pasted underneath.
        tabBarStyle: {
          backgroundColor: colors.scrimBottom,
          borderTopColor: colors.glassBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          // The default elevation draws a light shadow that shows as a seam
          // against a dark bar on Android.
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}>
      <Tabs.Screen
        name="document"
        options={{ title: 'Documents', tabBarIcon: tabIcon('document') }}
      />
    
      <Tabs.Screen
        name="upload"
        options={{ title: 'Importer', tabBarIcon: tabIcon('upload'), href: managerOnly }}
      />
      <Tabs.Screen
        name="ask"
        options={{ title: 'Assistant', tabBarIcon: tabIcon('ask') }}
      />
      <Tabs.Screen
        name="forms"
        options={{ title: 'Formulaires', tabBarIcon: tabIcon('forms')}}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: 'Tâches', tabBarIcon: tabIcon('tasks') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: tabIcon('profile') }}
      />
      {/* Expo Router turns every file in this directory into a route, and any
          route without an explicit <Tabs.Screen> still gets its own tab. These
          three are leftovers — index re-renders Upload, explore is untouched
          template, about is a stub — so they are hidden rather than deleted:
          the group still needs an index route to resolve as its default. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="about" options={{ href: null }} />
    </Tabs>
  );
}
