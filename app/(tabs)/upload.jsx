
// !! TO ADD ; when adocument alread yexists (same name, size);
// warn the uploade that uploading a document hat already exist will 'spoil'
// the response.
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { uploadFile, uploadScannedTextFile } from '../../services/apiClient';
import * as ImagePicker from 'expo-image-picker'
import { colors, gradients } from '@/constants/app-theme';
import { hasNativeScanner, scanDocument } from '../../services/documentScanner';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as FileSystem from "expo-file-system";

// Same accepted types as the web app's <input accept=".pdf,.txt,.md,.csv,.xls,.xlsx">.
const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const STATUS_ICON = {
    idle: { name: 'ellipse-outline', color: colors.glassBorderStrong, label: 'No photo attached' },
    uploading: { name: 'cloud-upload-outline', color: colors.accent, label: 'Uploading photo' },
    success: { name: 'checkmark-circle', color: colors.success, label: 'Photo uploaded' },
    error: { name: 'alert-circle', color: colors.danger, label: 'Upload failed' },
};

const Upload = () => {
  
  const [image, setImage] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [file, setFile] = useState(null); // { uri, name, size, mimeType }
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [scannedImage, setScannedImage] = useState();
  const [scannedText, setScannedText] = useState();
  const [uploadedScannedName, setUploadedScannedName] = useState();
  
  async function uploadScannedText(scannedText)
  {
    if (!scannedText) return;
    // upload. a test to the backend return status.
    // expects list<FIleInfo>, filesCount.
    const response = await uploadScannedTextFile(scannedText);
    if (response)
    {
      if (response.filesCount != 0)
        setUploadedScannedName(response.Files[0].name);
    }
    else{
      Alert.alert("file wasnt uploaded");
      setUploadedScannedName(null);
    }
  }
  
  async function handleScan() {
    
    try {
      const { canceled, images } = await scanDocument();
      if (canceled) return;
      const scannedUri = images[0];
      setScannedImage(scannedUri);
      // here we have the image time to convert it to text.
      // ML Kit hands back { text, blocks }; `text` is every block already
      // joined in reading order, so there is nothing to join ourselves.
      const { text } = await TextRecognition.recognize(scannedUri);
      if (!text || text.trim().length === 0) {
          Alert.alert(
            "No text found in the scanned document. " +
            "Make sure the document is well-lit and the text is clear."
          );
      }
      else{
          setScannedText(text);
          // now we convert this text into file.
          // or do we just create a new endpoint where the backend converts this text into file. 
          // go with the latter separate logic, less bugs
      }
    }
    catch (err) {
      Alert.alert('Scan failed', err.message);
    }
  }

  function pickFile(asset) {
    if (!asset) return;
    setFile(asset);
    if (!title) {
      setTitle(asset.name.replace(/\.[^/.]+$/, ''));
    }
  }

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    pickFile(result.assets?.[0]);
  }

   
  async function handlePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted === false)
    {
      Alert.alert('camera permission denied');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], // Modern SDK 54 syntax
      allowsEditing: true,    // Crop/rotate interface after capturing
      quality: 1,            // Compressed image quality factor (0.0 to 1.0)
      });
     if (!result.canceled) {
      setImage(result);
      setImageUri(result.assets[0].uri);
      console.log('Captured Image URI:', result.assets[0].uri);
    }
  }


  // i think this should be in the ask chat : answer the questions in this image.
  // if an image is set an additional context is given.
  /*async function handleuploadImage(){
    if (!image || status === 'uploading') return;
    setStatus('uploadin');
    setErrorMessage(null);
    setProgress(0);

    try {
       await uploadImage({})
    }
  }*/
  async function handleSubmit() {
    if (!file || status === 'uploading') return;

    setStatus('uploading');
    setErrorMessage(null);
    setProgress(0);

    try {
      await uploadFile({
        file,
        title,
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus('success');
      setFile(null);
      setTitle('');
      setProgress(0);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStatus('error');
      if (err.response?.status === 403) {
        setErrorMessage(
          "Forbidden — your session may lack permission for this action, or the token wasn't accepted."
        );
      } else if (err.response?.status === 413) {
        setErrorMessage('That file is too large.');
      } else {
        setErrorMessage('Upload failed. Check the file and try again.');
      }
    }
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View
                entering={FadeInDown.duration(600).springify()}
                style={styles.header}
              >
                <View style={styles.logoRing}>
                  <LinearGradient colors={gradients.accent} style={styles.logo}>
                    <Ionicons name="cloud-upload-outline" size={40} color={colors.text} />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>Upload a Document</Text>
                <Text style={styles.subtitle}>
                  PDFs and text documents are indexed for search after upload.
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInUp.duration(700).delay(150).springify()}
                style={styles.cardWrap}
              >
                <BlurView intensity={95} tint="dark" style={styles.card}>
                  <Pressable
                    onPress={handlePick}
                    style={({ pressed }) => [styles.dropzone, pressed && styles.dropzonePressed]}
                  >
                    <Ionicons
                      name={file ? 'document-text-outline' : 'cloud-upload-outline'}
                      size={26}
                      color={colors.textStrong}
                    />
                    {file ? (
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.dropzoneText}>Tap to choose a file</Text>
                        <Text style={styles.dropzoneHint}>
                          PDF, TXT, CSV, EXCEL or MD — up to 25MB
                        </Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={handlePhoto}
                    style={({pressed}) => [styles.dropzon, pressed && styles.dropezonePressed]}
                  >
                    <Ionicons
                      name='image'
                      size={26}
                      color={colors.textStrong}
                    />
                    {image ? (
                      <Text style={styles.dropzoneText}></Text>
                      ):
                      (
                        <>
                        <Text style={styles.dropzoneText}>Tap to choose an image</Text>
                        </>
                      )
                      }
                  </Pressable>
                  <Pressable
                    onPress={handleScan}
                    style={({ pressed }) => [styles.dropzone, pressed && styles.dropzonePressed]}
                  >
                    <Ionicons name="scan-outline" size={26} color={colors.textStrong} />
                    <Text style={styles.dropzoneText}>Scan a document</Text>
                    <Text style={styles.dropzoneHint}>
                      {hasNativeScanner
                        ? 'Auto edge detection and cropping'
                        : 'Expo Go: camera + manual crop'}
                    </Text>
                  </Pressable>

                  {scannedText && (
                    <Pressable   
                      onPress={uploadScannedText}
                      style={({ pressed }) => [styles.dropzone, pressed && styles.dropzonePressed]}
                    >
                    <Text style={styles.dropzoneText}>upload scan</Text>
                    </Pressable>
                  )}
                  {
                    uploadedScannedName && (
                      <Text>{uploadedScannedName}</Text>
                    )
                  }
                  <View style={styles.inputRow}>
                    <Ionicons name="text-outline" size={20} color={colors.textDim} />
                    <TextInput
                      style={styles.input}
                      placeholder=""
                      placeholderTextColor={colors.placeholder}
                      value={title}
                      onChangeText={setTitle}
                    />
                  </View>

                  {/* No tags field — DocumentController's /upload only accepts
                      file + title right now. Add it here once the backend's
                      FileEntity/uploadFile actually supports tags. */}

                  {status === 'uploading' && (
                    <View style={styles.progressWrap}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{progress}%</Text>
                    </View>
                  )}

                  {status === 'success' && (
                    <View style={styles.successBanner}>
                      <Text style={styles.successText}>
                        Uploaded. It&apos;ll show up in search shortly.
                      </Text>
                    </View>
                  )}

                  {status === 'error' && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                  )}

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleSubmit();
                    }}
                    disabled={!file || status === 'uploading'}
                    style={({ pressed }) => [
                      styles.buttonWrap,
                      (!file || status === 'uploading') && styles.buttonWrapDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <LinearGradient
                      colors={gradients.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.button}
                    >
                      {status === 'uploading' ? (
                        <ActivityIndicator color={colors.text} />
                      ) : (
                        <Text style={styles.buttonText}>Upload document</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </BlurView>
              </Animated.View>
            </ScrollView>
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
  scanPreview: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    marginBottom: 18,
    backgroundColor: colors.glassFill,
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

export default Upload;
