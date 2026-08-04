import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.HOMI_NATIVE_SERVER_URL;

const config: CapacitorConfig = {
  appId: "dev.yuss.homi",
  appName: "Homi",
  webDir: "www",
  bundledWebRuntime: false,
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: false,
        allowNavigation: [new URL(serverUrl).hostname],
      }
    : undefined,
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile",
  },
  android: {
    backgroundColor: "#f4f6f8",
    allowMixedContent: false,
  },
};

export default config;
