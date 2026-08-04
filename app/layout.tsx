import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./resource-management.css";

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
  icons: { icon: "/icon", apple: "/apple-icon" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#161715" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
