import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] ?? 'emulator';
if (!['emulator', 'usb'].includes(mode)) throw Error('Choose emulator or usb.');
try {
  const response = await fetch('http://127.0.0.1:8081/auth', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error(`Server returned HTTP ${response.status}.`);
  await response.body?.cancel();
} catch {
  console.error('MyDox is not available at http://127.0.0.1:8081. Keep npm run dev running in another terminal, then retry this command.');
  process.exit(1);
}
const env = { ...process.env, MYDOX_ANDROID_PREVIEW: mode };
// A source archive has no generated assets. Capacitor needs this directory
// even when the preview loads the running server instead of bundled HTML.
mkdirSync(join(root, 'android', 'app', 'src', 'main', 'assets', 'public'), { recursive: true });
execFileSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android'], {
  cwd: root, env, stdio: 'inherit', windowsHide: true,
});
const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT ||
  (process.platform === 'win32' && env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Android', 'Sdk') : null);
if (sdk && existsSync(sdk)) {
  env.ANDROID_HOME = sdk;
  const properties = join(root, 'android', 'local.properties');
  if (!existsSync(properties)) writeFileSync(properties, `sdk.dir=${sdk.replaceAll('\\', '/')}\n`);
}
if (process.argv.includes('--build')) {
  const options = { cwd: join(root, 'android'), env, stdio: 'inherit', windowsHide: true };
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', '& ./gradlew.bat :app:assembleDebug --no-daemon; exit $LASTEXITCODE'], options);
  } else {
    execFileSync('./gradlew', [':app:assembleDebug', '--no-daemon'], options);
  }
  console.log('APK: android/app/build/outputs/apk/debug/app-debug.apk');
}
console.log(`MyDox ${mode} preview prepared. Keep npm run dev running on this PC.`);
if (mode === 'usb') console.log('On your authorized device, run: adb -s <device-id> reverse tcp:8081 tcp:8081');
