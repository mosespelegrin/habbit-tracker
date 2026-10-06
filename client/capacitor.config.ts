import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.atomic.habittracker',
  appName: 'Atomic',
  // The Angular production build (`ng build` -> dist/client/browser) is what ships in the app.
  webDir: 'dist/client/browser',
  backgroundColor: '#07040e',
  server: {
    // Default is `https`, which makes plain-HTTP API calls during LAN testing count as mixed
    // content and get blocked by the WebView. `http://localhost` has no such restriction.
    androidScheme: 'http'
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#07040e'
  }
};

export default config;
