import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import {Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as splashScreen from 'expo-splash-screen';
import { SessionProvider, useSession } from '@/contexts/session-provider';
import { ImageBackground, StyleSheet} from 'react-native';
import {useEffect, useRef, useState} from 'react';

splashScreen.preventAutoHideAsync();
export const unstable_settings = {
  anchor: '(tabs)',
};

// RootLayout's only job: mount SessionProvider and hand it RootNavigator as
// a child. It can't call useSession() itself — SessionProvider isn't built
// yet at this point, it's only being described here, not read from.
export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const [splashHidden, setSplashHidden] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const timerRef = useRef(null);
  const loadedBackground = () => {
    setSplashHidden(true);
    splashScreen.hide();
    // set a timer that flip the state of hide
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current  = setTimeout(() => {
      setMinTimePassed(true);
    }, 2000);
  }
  
  const {isAuthenticated, isLoading } = useSession();

  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      {(isLoading || !splashHidden || !minTimePassed) ?
        <ImageBackground
          source={require('../assets/images/background_loading.jpeg')}
          resizeMode="contain"
          style={styles.background}
          onLoadEnd={() => loadedBackground()}
        ></ImageBackground>
        :
      <>
      <Stack>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* pushed over the tabs from the Forms tab; draws its own header */}
          <Stack.Screen name="form/[id]" options={{ headerShown: false }} />
          {/* pushed from the Tasks tab once a task is accepted; has its own tab bar */}
          <Stack.Screen name="task/[id]" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      </>
      }
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    flex:1,
    // background_loading.jpeg is a 1128x191 banner, so "cover" would scale it
    // ~12x to fill a phone screen and leave only a magnified sliver of the
    // logo. It is shown whole instead, on the navy sampled from the banner
    // itself so the bands above and below read as part of the artwork.
    backgroundColor: '#0f1a4e',
  }
})