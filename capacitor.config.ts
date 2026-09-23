import type { CapacitorConfig } from '@capacitor/cli';

// Check if we are in preview mode (dev server)
const preview = process.env.MYDOX_ANDROID_PREVIEW;

const config: CapacitorConfig = {
  appId: 'com.mydox.app',
  appName: 'MyDox',
  // TanStack Start build output folder
  webDir: '.output/public',
  server: {
    androidScheme: 'https',
    ...(preview
      ? {
          // 10.0.2.2 is the Mac's IP from the Android emulator
          url: preview === 'usb' ? 'http://127.0.0.1:8081' : 'http://10.0.2.2:8081',
          cleartext: true,
        }
      : {}),
  },
};

export default config;
