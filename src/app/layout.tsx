import type { Metadata } from "next";
import { Suspense } from "react";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import PageLoader from "./components/PageLoader";

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700']
});

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: "AKSARA — AI Learning Copilot",
  description: "Platform pembelajaran adaptif dengan AI untuk Perguruan Tinggi Indonesia",
  icons: {
    icon: [
      { url: "/wm_icon.png", type: "image/png" },
    ],
    shortcut: "/wm_icon.png",
    apple: "/wm_icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${playfair.variable} ${jakarta.variable} font-sans antialiased bg-warm-white text-ink-dark selection:bg-golden-ink selection:text-white`}>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </body>
    </html>
  );
}
