import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { logOut } from '../../services/apiClient';
import { SessionProvider, useSession } from '@/contexts/session-provider';
import { ThemeProvider } from '@react-navigation/native';
import * as apiClient from  '@/services/apiClient';
import { colors, gradients } from '@/constants/app-theme';

// the document searched for should show on this page.
const document = () => {

    const [loaded, setLoaded] = useState(false);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("idle");
    const [documents, setDocuments] = useState(null);
{
    //"files": [
    //    {
    //        "id": "4085c765-79cd-4988-a044-5a3a514ff44e",
    //        "name": "Docker Deep Dive Zero to Docker in a single book (Nigel Poulton) (z-lib.org)",
    //        "size": 9143851,
    //        "userId": "hicham@gmail.com"
    //    },
    //],
    //"filesCount": 4
}
    //searchDocuments(search)
    const searchDocuments = async (search) =>{
        const response = await apiClient.searchDocument(search);
        if(!response){
            console.log("couldnt fetch any doc ? or netwok error");
            setStatus("error");
        }
        else
            setStatus("success");
        setDocuments(response);
        setLoaded(true); //
    }

    const downloadFile = async (file) => {
        const downloaded = await apiClient.downloadDocument(file.id, file.name);
        if (!downloaded) {
                console.log("download failed");
            return;
        }
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
            console.log("sharing isn't available on this device");
            return;
        }
        await Sharing.shareAsync(downloaded.uri);
    }
    return (
    <View style={styles.container}>
        <ImageBackground
            source={require('../../assets/images/background_login.jpg')}
            resizeMode="cover"
            style={styles.background}
        >
        <LinearGradient
            colors={gradients.scrim}
            style={StyleSheet.absoluteFill}
        />
            <SafeAreaView style={styles.SafeAreaView}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
            <KeyboardAvoidingView>
            <Animated.View
                entering={FadeInDown.duration(600).springify()}
                style={styles.header}
            >
            <View>
            <LinearGradient colors={gradients.accent} style={styles.book}>
            <Ionicons name="book" size={40} color={colors.text} />
            </LinearGradient>
            </View>
            <Text style={styles.title}>Rechercher un document</Text>   
            </Animated.View>
            <Animated.View
                entering={FadeInUp.duration(700).delay(150).springify()}
                style={styles.cardWrap}
            >
            <BlurView intensity={55} tint="dark" style={styles.card}>
                <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Rechercher"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    value={search}
                    onChangeText={setSearch}
                    />
                </View>
            </BlurView>
            <Pressable
                onPress={() => {searchDocuments(search)}}
                style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Rechercher</Text>
            </Pressable>
            {loaded &&
            <Animated.View
                entering={FadeInUp.duration(700).delay(150).springify()}
                style={styles.cardWrap}
            >
            <BlurView intensity={55} tint="dark" style={styles.card}>
            {documents && documents?.filesCount !== 0 && (
                <View style={styles.documents}>
                {documents.files.map((file) =>(
                   <Pressable
                    key={file.id}
                    onPress={() => {downloadFile(file)}}
                    style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}>
                        <Text style={styles.buttonText}>{file.name}</Text>
                </Pressable>))}
                </View>
            )
            }
            {documents && documents?.filesCount === 0 && (
                <View>
                    <Text>Aucun document trouvé.</Text>
                </View>)}
            {status === "error" && (
                <View>
                    <Text>La recherche a échoué. Vérifiez votre connexion.</Text>
                </View>
             )
            }
            </BlurView>
            </Animated.View> 
            }
            </Animated.View>
            </KeyboardAvoidingView>
            </ScrollView>
            </SafeAreaView>
        </ImageBackground>
    </View>
    );
}

const styles = StyleSheet.create({

    documents:{
        flex:1,
        gap: 10
    },    
container
    : {
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
  dropzone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.glassBorderStrong,
    paddingVertical: 28,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  dropzonePressed: {
    borderColor: colors.accent,
    backgroundColor: colors.accentWash,
  },
  fileName: {
    marginTop: 6,
    maxWidth: '90%',
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  dropzoneText: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textStrong,
  },
  dropzoneHint: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textFaint,
  },
  inputRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  progressWrap: {
    marginTop: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  progressText: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textDim,
  },
  successBanner: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successFill,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successText: {
    fontSize: 13,
    color: colors.success,
  },
  errorBanner: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerFill,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  buttonWrap: {
    marginTop: 20,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.accentDeep,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonWrapDisabled: {
    opacity: 0.5,
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
});
export default document;