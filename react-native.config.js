// Native modules left out of the expertise build (constants/app-variant.js): it only has the
// Formulaires tab, and these two are only used by the hidden Importer and Documents tabs.
// ML Kit text recognition alone bundles five script models (Latin, Chinese, Devanagari,
// Japanese, Korean), a large part of the APK.
//
// Read by Expo autolinking when the native project is generated, so EXPO_PUBLIC_APP_VARIANT
// must be set at build time (eas.json's expertise profile does it). platforms: null means
// "don't link it"; the JS side copes with the missing native half:
//   - text-recognition only throws when called, and only upload.jsx calls it
//   - services/documentScanner.js already requires the scanner in a try and falls back to the camera
const EXPERTISE_ONLY = process.env.EXPO_PUBLIC_APP_VARIANT === 'expertise';

const notLinked = { platforms: { android: null, ios: null } };

module.exports = {
  dependencies: EXPERTISE_ONLY
    ? {
        '@react-native-ml-kit/text-recognition': notLinked,
        'react-native-document-scanner-plugin': notLinked,
      }
    : {},
};
