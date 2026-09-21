// Document scanning, with an Expo Go fallback.
//
// react-native-document-scanner-plugin ships its own Android/iOS source (it wraps
// Google ML Kit's scanner on Android and VNDocumentCameraViewController on iOS), so
// the native side only exists in a binary you compiled yourself — a development
// build. Expo Go is a pre-built app: its binary contains the Expo SDK modules and
// nothing else, so the plugin's native half is simply absent there.
//
// Worse, the plugin's entry point ends in
//   TurboModuleRegistry.getEnforcing('DocumentScanner')
// which throws at *import* time, not at call time. A plain top-level import of it
// therefore takes down the whole screen in Expo Go before it ever renders. Hence
// the guarded require below.
import * as ImagePicker from 'expo-image-picker';

let nativeScanner = null;
try {
  nativeScanner = require('react-native-document-scanner-plugin').default;
} catch {
  // Expo Go, or any binary built without the plugin. Fall back to the camera.
  nativeScanner = null;
}

/** True in a development build with the plugin compiled in; false in Expo Go. */
export const hasNativeScanner = nativeScanner != null;

/**
 * Opens the document scanner and returns the captured page URIs.
 *
 * In a development build this is the real edge-detecting, auto-cropping scanner.
 * In Expo Go it degrades to expo-image-picker's camera with the crop UI enabled —
 * same shape of result, manual cropping instead of automatic.
 *
 * @returns {Promise<{ canceled: boolean, images: string[], usedFallback: boolean }>}
 */
export async function scanDocument(options = {}) {
  if (nativeScanner) {
    const { scannedImages = [] } = await nativeScanner.scanDocument({
      croppedImageQuality: 100,
      ...options,
    });
    // The plugin reports a cancel as an empty scannedImages array.
    return { canceled: scannedImages.length === 0, images: scannedImages, usedFallback: false };
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // the closest Expo Go gets to the scanner's crop step
    quality: 1,
  });
  if (result.canceled) {
    return { canceled: true, images: [], usedFallback: true };
  }
  return {
    canceled: false,
    images: result.assets.map((asset) => asset.uri),
    usedFallback: true,
  };
}
