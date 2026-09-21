// Single source of truth for the app's visual language.
//
// Every screen (login, ask, upload, profile, document) renders the same way: a
// photo background, a three-stop dark scrim over it, and translucent "glass"
// cards on top. Those values were copy-pasted into five separate StyleSheets
// and had already drifted — two different greens for the same success state,
// four near-identical white alphas — so they live here now.
//
// This is deliberately not wired to useColorScheme: the design is dark-only by
// construction, since every screen sits on a dark scrim over a photo. A light
// variant would need different artwork, not just different tokens.

export const colors = {
  // Brand accent. `accent` is the lighter end used for icons, links and
  // progress fills; `accentDeep` is the darker end, only ever seen as the far
  // stop of a gradient or a solid button fill.
  accent: '#5aa4ff',
  accentDeep: '#1e56ff',
  accentWash: 'rgba(90,164,255,0.08)',
  accentBubble: 'rgba(90,164,255,0.18)',

  // Text on the scrim, in descending emphasis.
  text: '#ffffff',
  textStrong: 'rgba(255,255,255,0.9)',
  textMuted: 'rgba(255,255,255,0.7)',
  textDim: 'rgba(255,255,255,0.65)',
  textFaint: 'rgba(255,255,255,0.5)',
  placeholder: 'rgba(255,255,255,0.45)',

  // Glass surfaces: a hairline border plus a barely-there fill is what reads
  // as "frosted" once a BlurView sits underneath.
  glassBorder: 'rgba(255,255,255,0.18)',
  glassBorderStrong: 'rgba(255,255,255,0.35)',
  glassFill: 'rgba(255,255,255,0.10)',
  track: 'rgba(255,255,255,0.15)',

  // The scrim itself, top to bottom. The bottom stop is near-opaque so the
  // tab bar can continue it seamlessly.
  scrimTop: 'rgba(8,12,28,0.35)',
  scrimMid: 'rgba(8,12,28,0.55)',
  scrimBottom: 'rgba(8,12,28,0.92)',

  // Status. Each state is a triple: a saturated colour for text and icons, a
  // 0.4-alpha border, and a 0.12-alpha fill for banners.
  danger: '#fca5a5',
  dangerBorder: 'rgba(248,113,113,0.4)',
  dangerFill: 'rgba(239,68,68,0.12)',
  success: '#6ee7b7',
  successBorder: 'rgba(52,211,153,0.4)',
  successFill: 'rgba(16,185,129,0.12)',
};

// Gradients are arrays because that is what expo-linear-gradient takes. Spread
// them at the call site: <LinearGradient colors={gradients.accent} />
export const gradients = {
  accent: [colors.accent, colors.accentDeep],
  scrim: [colors.scrimTop, colors.scrimMid, colors.scrimBottom],
};

export const radius = {
  pill: 999, // fully rounded regardless of content width
  card: 24,
  bubble: 18,
  banner: 14,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
};
