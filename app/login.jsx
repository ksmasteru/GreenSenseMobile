import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import {useSession} from '@/contexts/session-provider'
import { useRouter } from 'expo-router';
import * as apiClient from  '@/services/apiClient';
import { colors, gradients } from '@/constants/app-theme';
  const Login = () => {
  const {signIn, signOut} = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const handleLogin = async (email, password) => {
    setLoading(true);
    const gotted = await apiClient.login(email, password);
    if (gotted)
    {
      setData(gotted);
      signIn(gotted);  
    }
    else
      Alert.alert("couldnt login");// we should show the correct message .
    setLoading(false);
  }
  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/images/background_login.jpg')}
        resizeMode="cover"
        style={styles.background}
      >
        <LinearGradient
          colors={gradients.scrim}
          style={StyleSheet.absoluteFill}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <SafeAreaView style={styles.safeArea}>
            <Animated.View
              entering={FadeInDown.duration(600).springify()}
              style={styles.header}
            >
              <View style={styles.logoRing}>
                <LinearGradient
                  colors={gradients.accent}
                  style={styles.logo}
                >
                  <Ionicons name="person" size={44} color={colors.text} />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to keep going</Text>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.duration(700).delay(150).springify()}
              style={styles.cardWrap}
            >
              <BlurView intensity={45} tint="dark" style={styles.card}>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-outline" size={20} color={colors.textDim} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textDim} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textDim}
                    />
                  </Pressable>
                </View>

                <Pressable hitSlop={8} style={styles.forgotWrap}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleLogin(email, password);
                  }}
                  disabled={loading}
                  style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}
                >
                  <LinearGradient
                    colors={gradients.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.text} />
                    ) : (
                      <Text style={styles.buttonText}>Log In</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </BlurView>

              <Text style={styles.footerText}>
                Don&apos;t have an account? <Text style={styles.footerLink}>Sign up</Text>
              </Text>
            </Animated.View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 32,
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
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: colors.textMuted,
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.glassBorder,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: 20,
  },
  forgotText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  buttonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.accentDeep,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  button: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footerText: {
    textAlign: 'center',
    marginTop: 20,
    color: colors.textDim,
    fontSize: 13,
  },
  footerLink: {
    color: colors.text,
    fontWeight: '700',
  },
});

export default Login;
