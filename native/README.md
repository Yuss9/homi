# Homi native companion

The native companion is intentionally small. Capacitor opens the connected Homi
web application, while native extensions provide iOS WidgetKit and Android App
Widgets that a browser-only PWA cannot expose.

## Requirements

- Node.js 22+
- Xcode 16+ for iOS
- Android Studio with a current Android SDK for Android
- a public HTTPS Homi instance

## Generate platform projects

```bash
cd native
npm install
mkdir -p www
printf '<!doctype html><title>Homi</title>' > www/index.html
HOMI_NATIVE_SERVER_URL=https://homi.example.com npx cap add ios
HOMI_NATIVE_SERVER_URL=https://homi.example.com npx cap add android
HOMI_NATIVE_SERVER_URL=https://homi.example.com npm run sync
```

Do not use an HTTP production URL. Capacitor loads the same connected Homi
instance as the PWA; household data is not bundled into the native application.

## iOS widget

1. In Xcode, add a **Widget Extension** named `HomiWidget`.
2. Replace its generated Swift source with
   `ios/HomiWidget/HomiWidget.swift`.
3. Add the App Group `group.dev.yuss.homi` to the application and widget targets.
4. Store these values in the shared App Group preferences from the companion's
   settings screen:

```text
homi.baseURL
homi.apiKey
homi.homeID
```

The API key should normally contain only `widgets:read`. WidgetKit refreshes the
summary approximately every 15 minutes and opens the matching Homi route through
a deep link.

## Android widget

After `npx cap add android`, copy the provided files into the generated Android
project and merge `android/app/src/main/AndroidManifest.widgets.xml` into the
application's `AndroidManifest.xml`.

The configuration activity stores the Homi URL, a `widgets:read` key, home ID and
widget type in widget-scoped SharedPreferences. Each widget then requests
`/api/v1/widgets/summary` and opens the returned Homi URL when tapped.

## Security

- create a dedicated, revocable API key for widgets;
- avoid reusing an owner automation key;
- never commit a server URL containing credentials;
- use HTTPS and platform secure storage before distributing production builds;
- revoke the key from Homi Settings when a device is lost.
