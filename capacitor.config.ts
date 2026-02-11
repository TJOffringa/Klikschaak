import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nl.klikschaak.app',
  appName: 'Klikschaak',
  webDir: 'dist',
  backgroundColor: '#1a1a2e',
  android: {
    backgroundColor: '#1a1a2e'
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#1a1a2e',
      launchAutoHide: true,
      autoHide: true,
      androidSplashResourceName: 'splash'
    },
    StatusBar: {
      backgroundColor: '#1a1a2e',
      style: 'LIGHT'
    }
  }
};

export default config;
