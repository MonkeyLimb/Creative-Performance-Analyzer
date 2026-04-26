import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Creative Performance Analyzer",
  description: "Classify and triage Meta ad creatives by CPL.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0f" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
  ],
};

const themeBootstrap = `
(function(){
  try {
    var t = localStorage.getItem('cpa.theme.v1');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    var r = document.documentElement;
    r.classList.remove('light','dark');
    r.classList.add(t);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} dark`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-bg text-text font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
