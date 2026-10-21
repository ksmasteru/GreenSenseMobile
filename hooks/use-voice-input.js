// The seam between the screens that take speech and "how do words get out of a
// microphone". ask.jsx drops the result into its `question` state and the
// checklist sheet (app/form/[id].jsx) appends it to a comment; neither ever
// learns whether the text came from a server, from the device, or from a
// fallback. Same idea as services/documentScanner.js hiding native-scanner-vs-
// image-picker behind one API — swapping STT provider, or adding an on-device
// path for some languages later, should touch this file and nothing else.
//
// Route B (record → upload → backend transcribes) was chosen over on-device
// recognition because on-device needs the locale declared BEFORE it starts
// listening and ships no Moroccan Darija model at all. A server-side model
// auto-detects and can code-switch mid-sentence, which is the normal case for
// Darija speakers mixing in French.

import { useCallback, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as apiClient from '@/services/apiClient';

// HIGH_QUALITY is 44.1kHz stereo at 128kbps — built for music. Speech models
// downsample to 16kHz mono anyway, so the extra bytes buy no accuracy and cost
// real upload time on a tethered connection: ~1MB per minute becomes ~240KB.
const SPEECH_QUALITY = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
};

// Shorter than this is a mis-tap, not a question. Uploading it only spends a
// round-trip to be handed an empty string back.
const MIN_DURATION_MS = 700;

// Errors are shown under the mic, in the screen's language. The app is in
// French, so French is the default when no language is passed.
const MESSAGES = {
  en: {
    denied: 'Microphone permission denied.',
    blocked: 'Microphone access is off. Enable it in Settings to ask by voice.',
    startFailed: 'Could not start recording.',
    recordFailed: 'Recording failed.',
    uploadFailed: 'Transcription failed. Check your connection and try again.',
    noSpeech: 'Could not make out any speech. Try again.',
  },
  fr: {
    denied: 'Accès au micro refusé.',
    blocked: "Le micro est désactivé. L'activer dans les Réglages pour dicter.",
    startFailed: "Impossible de démarrer l'enregistrement.",
    recordFailed: "L'enregistrement a échoué.",
    uploadFailed: 'Transcription impossible. Vérifier la connexion et réessayer.',
    noSpeech: 'Aucune parole reconnue. Réessayer.',
  },
};

/**
 * @param {{ language?: string }} [options] ISO-639-1 code sent to the
 *   transcriber ('fr' on the forms screen); omitted, it auto-detects.
 * @returns {{
 *   status: 'idle'|'recording'|'transcribing',
 *   error: string|null,
 *   durationMillis: number,
 *   start: () => Promise<void>,
 *   stop: (context?: string) => Promise<string|null>,
 *   clearError: () => void,
 * }}
 */
export function useVoiceInput({ language } = {}) {
  const t = MESSAGES[language] ?? MESSAGES.fr;
  const recorder = useAudioRecorder(SPEECH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  // Wall-clock rather than recorderState.durationMillis, which is polled on an
  // interval (500ms by default) and so can still read 0 the instant you stop.
  const startedAt = useRef(0);

  const start = useCallback(async () => {
    setError(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(permission.canAskAgain ? t.denied : t.blocked);
        return;
      }

      // iOS keeps audio routed away from the mic until the session is put in
      // recording mode. Android ignores this, but it costs nothing there.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setStatus('recording');
    } catch (e) {
      console.error('useVoiceInput.start failed', e);
      setError(t.startFailed);
      setStatus('idle');
    }
  }, [recorder, t]);

  // Resolves to the transcript, or null when there is nothing usable. This
  // hook never writes the question itself — the caller decides what to do with
  // the text, which is what keeps the transcript editable before it is sent.
  // `context` (optional) describes what was being talked about; see
  // apiClient.transcribeAudio.
  const stop = useCallback(async (context) => {
    if (status !== 'recording') return null;

    const heldFor = Date.now() - startedAt.current;
    try {
      await recorder.stop();
    } catch (e) {
      console.error('useVoiceInput.stop failed', e);
      setStatus('idle');
      setError(t.recordFailed);
      return null;
    } finally {
      // Hand the mic back, or other audio stays stuck in record mode.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    }

    const uri = recorder.uri;
    if (!uri || heldFor < MIN_DURATION_MS) {
      setStatus('idle');
      return null;
    }
    console.log("recorded audio uri is. : ", uri);
    setStatus('transcribing');
    const result = await apiClient.transcribeAudio(uri, language, context);
    setStatus('idle');
    // null means the upload itself failed, which is worth telling apart from
    // "the audio had no words in it".
    if (!result) {
      setError(t.uploadFailed);
      return null;
    }
    // Citations are dropped on purpose: the transcript becomes the question in
    // the text box, and /ask/transcribe never retrieves documents anyway.
    const text = apiClient.parseAiResponse(result).text.trim();
    if (!text) {
      setError(t.noSpeech);
      return null;
    }
    return text;
  }, [recorder, status, language, t]);
  
  // specefic to reports.
  const stopReport = useCallback(async (context) => {
  if (status !== 'recording') return null;

    const heldFor = Date.now() - startedAt.current;
    try {
      await recorder.stop();
    } catch (e) {
      console.error('useVoiceInput.stop failed', e);
      setStatus('idle');
      setError(t.recordFailed);
      return null;
    } finally {
      // Hand the mic back, or other audio stays stuck in record mode.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    }

    const uri = recorder.uri;
    if (!uri || heldFor < MIN_DURATION_MS) {
      setStatus('idle');
      return null;
    }
    console.log("recorded audio uri is. : ", uri);
    setStatus('transcribing');
    const result = await apiClient.transcribeAudioReport(uri, language, context);
    setStatus('idle');
    // null means the upload itself failed, which is worth telling apart from
    // "the audio had no words in it".
    if (!result) {
      setError(t.uploadFailed);
      return null;
    }
    // Citations are dropped on purpose: the transcript becomes the question in
    // the text box, and /ask/transcribe never retrieves documents anyway.
    const text = apiClient.parseAiResponse(result).text.trim();
    if (!text) {
      setError(t.noSpeech);
      return null;
    }
    return text;
  }, [recorder, status, language, t]);
  
  return {
    status,
    error,
    durationMillis: recorderState.durationMillis ?? 0,
    start,
    stop,
    stopReport,
    clearError: useCallback(() => setError(null), []),
  };
}
