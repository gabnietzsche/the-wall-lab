import type { Metadata, Viewport } from "next";
import { Bangers } from "next/font/google";
import "./globals.css";

const bangers = Bangers({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bangers",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Wall",
  description: "1v1 realtime. Ogni colpo conta.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "The Wall",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#06B6D4",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={bangers.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
