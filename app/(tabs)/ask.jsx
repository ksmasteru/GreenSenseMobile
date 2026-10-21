import { colors, gradients } from '@/constants/app-theme';
import * as apiClient from '@/services/apiClient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import * as Audio from '../../hooks/use-voice-input.js';

const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = 120;

// Upload status -> the glyph that stands for it. Module scope so the object
// isn't rebuilt on every render, and so an unknown status is a missing key
// (renders nothing) rather than four silently-false comparisons.
const STATUS_ICON = {
    idle: { name: 'ellipse-outline', color: colors.glassBorderStrong, label: 'Aucune photo jointe' },
    uploading: { name: 'cloud-upload-outline', color: colors.accent, label: 'Envoi de la photo' },
    success: { name: 'checkmark-circle', color: colors.success, label: 'Photo envoyée' },
    error: { name: 'alert-circle', color: colors.danger, label: "Échec de l'envoi" },
};

// General "ask about your data" tab — no fileId/fileName scoping, no
// streaming (single await response.json() per question). Mirrors the web
// app's AskChat.jsx layout/behavior otherwise: empty-state prompt until
// the first message, then a scrolling message list + bottom composer.
const ask = () => {
    const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', text }
    const [question, setQuestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState(null);
    const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
    const [image, setImage] = useState(null);
    const [Status, setStatus] = useState('idle'); // idle | uploading |success | error
    const [recording, setRecording] = useState(false);
    //const recorder = Audio.useAudioRecorder(AudioModule.RecordingPresets.HIGH_QUALITY)
    //const recorderState = Audio.useAudioRecorderState(recorder);
    const recordingStats = Audio.useVoiceInput();
    const scrollRef = useRef(null);


    const startRecording = async () => {
        await recordingStats.start();
        setRecording(true);
    }

    const stopRecording = async () => {
        const text = await recordingStats.stop();
        if (text)
            setQuestion(text);
        setRecording(false);
    }

    const uploadImage = async () => {
        setStatus("uploading");
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.granted === false)
        {
            Alert.alert('Accès à la caméra refusé.');
            setStatus("error");
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'], // Modern SDK 54 syntax
            allowsEditing: true,    // Crop/rotate interface after capturing
            quality: 1,            // Compressed image quality factor (0.0 to 1.0)
        });
        if (!result.canceled) {
            setImage(result.assets[0]);
            setStatus("success")}
        else {
            setStatus("error");
        }
    }

    const sendQuestion = async () => {
        const trimmed = question.trim();
        if ((!trimmed && !image) || isLoading) return;

        setErrorMessage(null);
        setQuestion('');
        setMessages((prev) => [...prev, { role: 'user', text: trimmed || 'Photo' }, { role: 'assistant', text: '' }]);
        setIsLoading(true);

        let response = null;
        if (image)
            response = await apiClient.askImageQuestion(image);
        else
            response = await apiClient.askQuestion(trimmed);
        if (!response) {
            setErrorMessage("Impossible d'obtenir une réponse. Réessayez.");
            setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant placeholder
        } else {
            const { text} = apiClient.parseAiResponse(response);
            // /ask/image sends an empty citations string, so only add the line
            // when there is a source to show.
            setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', text: text };
                return next;
            });
        }
        setIsLoading(false);
    };

    const isEmpty = messages.length === 0;

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
        <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {isEmpty ? (
                <View style={styles.emptyState}>
                    <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
                        <LinearGradient colors={gradients.accent} style={styles.icon}>
                            <Ionicons name="sparkles" size={36} color={colors.text} />
                        </LinearGradient>
                        <Text style={styles.title}>Que voulez-vous savoir ?</Text>
                        <Text style={styles.subtitle}>
                            Posez vos questions sur les pompes, la maintenance ou PHOVA : les réponses s&apos;appuient sur la documentation.
                        </Text>
                    </Animated.View>
                    <Animated.View entering={FadeInUp.duration(700).delay(150).springify()} style={styles.composerWrap}>
                        <Composer
                            recording={recording}
                            startRecording={startRecording}
                            stopRecording={stopRecording}
                            image={image}
                            uploadImage={uploadImage}
                            question={question}
                            setQuestion={setQuestion}
                            onSend={sendQuestion}
                            isLoading={isLoading}
                            inputHeight={inputHeight}
                            setInputHeight={setInputHeight}
                            Status={Status}
                        />
                    </Animated.View>
                </View>
            ) : (
                <>
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={styles.messagesContent}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.map((message, index) => {
                        const isLast = index === messages.length - 1;
                        const isPendingAssistant = message.role === 'assistant' && isLast && isLoading && !message.text;
                        return (
                            <View
                                key={index}
                                style={[
                                    styles.messageRow,
                                    message.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
                                ]}
                            >
                                {message.role === 'user' ? (
                                    <View style={styles.userBubble}>
                                        <Text style={styles.userText}>{message.text}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.assistantBubble}>
                                        {isPendingAssistant ? (
                                            <ActivityIndicator size="small" color={colors.accent} />
                                        ) : (
                                            <Text style={styles.assistantText}>{message.text}</Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
                <View style={styles.composerBar}>
                    {errorMessage && (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        </View>
                    )}
                    <Composer
                        recording={recording}
                        startRecording={startRecording}
                        stopRecording={stopRecording}
                        image={image}
                        uploadImage={uploadImage}
                        question={question}
                        setQuestion={setQuestion}
                        onSend={sendQuestion}
                        isLoading={isLoading}
                        inputHeight={inputHeight}
                        setInputHeight={setInputHeight}
                        Status={Status}
                    />
                </View>
                </>
            )}
        </KeyboardAvoidingView>
        </SafeAreaView>
        </ImageBackground>
    </View>
    );
};

function Composer({ recording, startRecording, stopRecording, image, uploadImage, question, setQuestion, onSend, isLoading, inputHeight, setInputHeight, Status }) {
    // Sendable when something is attached OR typed — an image on its own is a
    // valid question, since the backend OCRs it into one.
    const canSend = !isLoading && (question.trim().length > 0 || !!image);
    return (
        <>
        <View style={styles.context_bar}>
        <Pressable
            onPress={recording ? stopRecording : startRecording}
            hitSlop={8}
            style={({ pressed }) => [styles.uploadChip, pressed && styles.buttonPressed]}
        >
            <Ionicons
                name={recording ? 'stop-circle' : 'mic-outline'}
                size={16}
                color={recording ? colors.danger : colors.textStrong}
            />
            <Text style={styles.uploadChipText}>{recording ? 'Arrêter' : 'Dicter'}</Text>
        </Pressable>
        <Pressable
            onPress={uploadImage}
            hitSlop={8}
            style={({ pressed }) => [styles.uploadChip, pressed && styles.buttonPressed]}
        >
            <Ionicons name="image-outline" size={16} color={colors.textStrong} />
            <Text style={styles.uploadChipText}>Ajouter une photo</Text>
        </Pressable>
        <View style={styles.statusSlot}>
            {STATUS_ICON[Status] && (
                <Ionicons
                    name={STATUS_ICON[Status].name}
                    size={18}
                    color={STATUS_ICON[Status].color}
                    accessibilityLabel={STATUS_ICON[Status].label}
                />
            )}
        </View>
        </View>
        <BlurView intensity={55} tint="dark" style={styles.card}>
            <View style={styles.inputRow}>
                <TextInput
                    style={[styles.input, { height: inputHeight }]}
                    placeholder="Posez votre question…"
                    placeholderTextColor={colors.placeholder}
                    value={question}
                    onChangeText={setQuestion}
                    onContentSizeChange={(e) =>
                        setInputHeight(
                            Math.min(Math.max(MIN_INPUT_HEIGHT, e.nativeEvent.contentSize.height), MAX_INPUT_HEIGHT)
                        )
                    }
                    multiline
                    editable={!isLoading}
                />
                <Pressable
                    onPress={onSend}
                    disabled={!canSend}
                    style={({ pressed }) => [
                        styles.sendButton,
                        !canSend && styles.sendButtonDisabled,
                        pressed && styles.buttonPressed,
                    ]}
                >
                    <Ionicons name="arrow-up" size={20} color={colors.text} />
                </Pressable>
            </View>
        </BlurView>
        </>
    );
}

const styles = StyleSheet.create({
    topWrapper:{flex: 1},
    context_bar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    uploadChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: colors.glassFill,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    statusSlot: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadChipText: {
        color: colors.textStrong,
        fontSize: 13,
        fontWeight: '600',
    },
  container: { flex: 1 },
  background: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  composerWrap: {
    width: '100%',
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: colors.accentBubble,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: {
    color: colors.text,
    fontSize: 15,
  },
  assistantBubble: {
    maxWidth: '85%',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  assistantText: {
    color: colors.textStrong,
    fontSize: 15,
    lineHeight: 21,
  },
  composerBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  card: {
    borderRadius: 24,
    padding: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  errorBanner: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerFill,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
});

export default ask;
