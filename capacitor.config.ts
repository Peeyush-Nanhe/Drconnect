import type { CapacitorConfig } from '@capacitor/cli';

const preview = process.env.MYDOX_ANDROID_PREVIEW;
if (preview && !['emulator', 'usb'].includes(preview)) {
  throw new Error('MYDOX_ANDROID_PREVIEW must be emulator or usb.');
}

const config: CapacitorConfig = {
  appId: 'com.mydox.app',
  appName: 'MyDox',
  webDir: '.output/public/client',
  server: {
    androidScheme: 'https',
    ...(preview
      ? {
          url: preview === 'usb' ? 'http://127.0.0.1:8081' : 'http://10.0.2.2:8081',
          cleartext: true,
        }
      : {}),
  },
};

export default config;
