// app.json holds the whole config; this file only adjusts it per build variant
// (constants/app-variant.js). EAS sets EXPO_PUBLIC_APP_VARIANT from the profile's env
// in eas.json before reading this file.
//
// The expertise build gets its own name and Android package, so Android treats it as a
// separate app: it installs next to the full app instead of replacing it.
const EXPERTISE = process.env.EXPO_PUBLIC_APP_VARIANT === 'expertise';

module.exports = ({ config }) => {
  if (!EXPERTISE) return config;
  return {
    ...config,
    name: 'GreenSense Expertise',
    android: {
      ...config.android,
      package: `${config.android.package}.expertise`,
    },
  };
};
