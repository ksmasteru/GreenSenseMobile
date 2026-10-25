import { EXPERTISE_ONLY } from '@/constants/app-variant';

// Which tabs each role sees, by route name in app/(tabs)/ (UserRole on the backend:
// USER = technician). The first one is where the app opens after login. The bar's order
// is the order of the <Tabs.Screen> list in _layout.tsx, not this one.
//
// This only hides tabs: a hidden route can still be opened by a link, so the backend
// has to refuse what a role may not do.
export const ROLE_TABS = {
  MANAGER: ['task', 'orders', 'review', 'profile'],
  USER: ['tasks', 'ask', 'document', 'profile'],
  ADMIN: ['upload', 'document', 'ask'],
} as const;

export function tabsFor(role: string | null): readonly string[] {
  // the expertise build (constants/app-variant.js) keeps only the Formulaires tab
  if (EXPERTISE_ONLY) return ['forms'];
  // an unknown role gets the technician's tabs, the smallest set
  return ROLE_TABS[role as keyof typeof ROLE_TABS] ?? ROLE_TABS.USER;
}
