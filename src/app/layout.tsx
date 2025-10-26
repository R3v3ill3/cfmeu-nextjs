import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // iPhone X+ safe area support
};

export const metadata: Metadata = {
  title: "CFMEU Organizer App",
  description: "Construction, Forestry, Maritime, Mining and Energy Union organizing platform",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    other: [
      { rel: "mask-icon", url: "/mask-icon.svg", color: "#0b2a5b" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "CFMEU",
    statusBarStyle: "black-translucent",
  },
};

// Pre-load React to ensure it's available during SSR
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Ensure React and hooks are globally available for Vercel serverless environment
if (typeof globalThis !== 'undefined') {
  if (!globalThis.React) {
    globalThis.React = React;
  }
  // Ensure hooks are available on global React
  if (globalThis.React) {
    globalThis.React.useState = useState;
    globalThis.React.useEffect = useEffect;
    globalThis.React.useCallback = useCallback;
    globalThis.React.useMemo = useMemo;
    globalThis.React.useRef = useRef;
  }
}
if (typeof global !== 'undefined') {
  if (!global.React) {
    global.React = React;
  }
  // Ensure hooks are available on global React
  if (global.React) {
    global.React.useState = useState;
    global.React.useEffect = useEffect;
    global.React.useCallback = useCallback;
    global.React.useMemo = useMemo;
    global.React.useRef = useRef;
  }
}
if (typeof window !== 'undefined') {
  if (!window.React) {
    window.React = React;
  }
  // Ensure hooks are available on global React
  if (window.React) {
    window.React.useState = useState;
    window.React.useEffect = useEffect;
    window.React.useCallback = useCallback;
    window.React.useMemo = useMemo;
    window.React.useRef = useRef;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
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
