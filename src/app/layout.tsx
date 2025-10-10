import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./print.css";
import Providers from "./providers";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CFMEU App",
  description: "Next.js App Router migrated from Vite",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover", // iPhone X+ safe area support
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
    },
    shortcut: "/favicon.ico",
    other: [
      { rel: "mask-icon", url: "/mask-icon.svg", color: "#0b2a5b" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="mask-icon" href="/mask-icon.svg" color="#0b2a5b" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        nonce={nonce}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
