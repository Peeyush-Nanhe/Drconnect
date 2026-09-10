# MyDox in Android Studio

Open this repository's **android** folder as a project. It is the MyDox Capacitor/Gradle project, with application ID `com.mydox.app` and launcher name **MyDox**. Select the `app` run configuration and the `debug` build variant.

## Build the emulator preview

In the repository root, keep the server running in one terminal:

```powershell
npm ci
# Restore the approved local staging .env separately; it is never in Git or ZIPs.
npm run dev
```

In another terminal:

```powershell
npm run cap:sync
npm run cap:open:android
```

`cap:sync` prepares the emulator preview using the running MyDox server. For USB preview syncing, use `npm run cap:sync -- usb`. This app's server build does not produce a standalone client `index.html`, so use these scripts instead of running `npx cap sync android` directly.

To also build the debug APK from the command line:

```powershell
npm run android:apk:preview
```

The script syncs Capacitor, finds the standard local Android SDK, and runs `:app:assembleDebug`. JDK 17 and Android SDK 35 were used for this build. Android Studio can also build the prepared project using Build > Generate App Bundles or APKs > Generate APKs.

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

The emulator preview loads `http://10.0.2.2:8081`, which connects to this PC. Keep the server running. Start an Android emulator, select it in Android Studio, and press Run. Existing MyDox demo accounts work against staging.

## Optional USB phone preview

The emulator APK uses an emulator-specific address. For a phone connected to this PC with USB debugging already enabled and authorized, build the USB variant:

```powershell
npm run android:apk:usb
adb devices
adb -s <your-device-id> reverse tcp:8081 tcp:8081
adb -s <your-device-id> install -r android/app/build/outputs/apk/debug/app-debug.apk
```

That variant loads `http://127.0.0.1:8081` through the USB forwarding connection. Reconnect forwarding after unplugging or restarting. This remains a development preview tied to this PC.

## Release status

The debug APK builds and its package identity and signature have been checked. It uses MyDox artwork and the native splash screen. It is signed with the development key.

TanStack Start uses a running server and currently emits no standalone client `index.html`. A production release needs the hosted server/API and a supported bundled mobile frontend, production Auth redirects, feature testing, and the owner's signing key. Release builds reject the current local-server preview configuration. Cleartext traffic is enabled only in the debug manifest.

Only client assets are copied into the APK. Server source, the staging privileged key, and the local `.env` stay on the PC.

References: [Capacitor configuration](https://capacitorjs.com/docs/v7/config), [Android command-line builds](https://developer.android.com/build/building-cmdline).
