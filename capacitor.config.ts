import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gopeshwar.stationaryhouse',
  appName: 'Gopeshwar Stationary House',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#1C1A2E', // deep-ink
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Camera: {
      // used by: vendor bill scanning (§13), product photos (§10), expense evidence (§38)
    },
    LocalNotifications: {
      // used by: morning brief / night closing / low-stock / AI-review / tag notifications (§31)
    },
    Preferences: {
      // used for PIN + session flags (onboarding-complete, biometric-enrolled) — NOT for business data
    },
    CapacitorUpdater: {
      // The web layer checks our HTTPS manifest and bundle checksum. Downloads are
      // staged and applied after explicit user confirmation.
      autoUpdate: 'off',
      appReadyTimeout: 15000,
      responseTimeout: 30,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      statsUrl: '',
    },
    BiometricAuth: {
      // wraps Android BiometricPrompt for §3 step-4 / §5 fallback login
    },
  },
};

export default config;
