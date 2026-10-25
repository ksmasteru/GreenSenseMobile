// Which app a build is. Set at build time by the EAS profile (eas.json → env), so the
// value is baked into the bundle: EXPO_PUBLIC_* variables are inlined, not read at runtime.
//
//   (unset)     the full app
//   expertise   the technician build: only the Formulaires tab, listing only the
//               expertise report (eas build --profile expertise)
export const EXPERTISE_ONLY = process.env.EXPO_PUBLIC_APP_VARIANT === 'expertise';

// the one form the expertise build shows, matched on its title in the forms list
export const EXPERTISE_FORM_TITLE = "Rapport d'expertise";
