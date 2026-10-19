import { Redirect } from 'expo-router';

import { useSession } from '@/contexts/session-provider';

// The tab group's default route, where the app lands after login. It has no tab
// of its own (href: null in _layout.tsx), so it only sends each user to their
// starting tab: technicians to their tasks, since Upload is hidden for them.
export default function HomeScreen() {
  const { role } = useSession();
  return <Redirect href={role === 'USER' ? '/tasks' : '/upload'} />;
}
