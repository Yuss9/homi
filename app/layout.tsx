import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRuntime } from "@/src/components/pwa-runtime";
import "./globals.css";
import "./resource-management.css";
import "./household-profile.css";
import "./high-value-tools.css";
import "./connected-platform.css";
import "./ui-polish.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Homi — Your home, remembered", template: "%s · Homi" },
  description:
    "Keep maintenance, warranties, manuals, repairs, and the documents that make your home run in one private place.",
  applicationName: "Homi",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Homi",
    statusBarStyle: "black-translucent",
    startupImage: [
      {
        url: "/pwa/splash/1179/2556",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash/1290/2796",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash/2048/2732",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  formatDetection: { telephone: false },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "Homi — Your home, remembered",
    description:
      "A calm, private home maintenance journal for everything that matters.",
    siteName: "Homi",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Homi home maintenance journal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Homi — Your home, remembered",
    description:
      "A calm, private home maintenance journal for everything that matters.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/icon", sizes: "32x32", type: "image/png" },
      { url: "/pwa/icon/192", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa/icon/192", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#161715" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const localeCookie = (await cookies()).get("homi-locale")?.value;
  const locale = localeCookie === "fr" || localeCookie === "de" ? localeCookie : "en";
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}
