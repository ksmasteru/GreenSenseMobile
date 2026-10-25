import { Redirect } from 'expo-router';
import { tabsFor } from '@/constants/role-tabs';
import { useSession } from '@/contexts/session-provider';

// The tab group's default route. It has no tab of its own (href: null in _layout.tsx);
// the app lands on the role's first tab after login (initialRouteName in _layout.tsx),
// and a link to "/" goes there too.
export default function HomeScreen() {
  const { role } = useSession();
  return <Redirect href={`/${tabsFor(role)[0]}` as never} />;
}
