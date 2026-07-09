import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PolicyGuard — Pre-trade policy gateway",
  description:
    "Audit AI-proposed SoDEX orders against SoSoValue market evidence, then prepare or submit with a public audit receipt.",
  applicationName: "PolicyGuard",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/policyguard-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/policyguard-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    title: "PolicyGuard — Pre-trade policy gateway",
    description:
      "Audit AI-proposed SoDEX orders against SoSoValue market evidence, then prepare or submit with a public audit receipt.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "PolicyGuard" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PolicyGuard — Pre-trade policy gateway",
    description:
      "Audit AI-proposed SoDEX orders against SoSoValue market evidence, then prepare or submit with a public audit receipt.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-ink">{children}</body>
    </html>
  );
}
