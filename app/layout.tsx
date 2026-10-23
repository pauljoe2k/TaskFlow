import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow — Offline-First Kanban Board",
  description:
    "TaskFlow is an installable, offline-first Kanban board with drag-and-drop, undo/redo, a command palette and full keyboard accessibility.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TaskFlow" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e1a" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the stored (or system) theme before first paint so there is no
 * flash of the wrong theme on load. Kept inline and tiny on purpose.
 */
const themeInitScript = `(function(){try{var s=localStorage.getItem("taskflow-theme");var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=s==="dark"||(s!=="light"&&m);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
