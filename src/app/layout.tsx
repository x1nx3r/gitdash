import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import Providers from "@/components/notifications/Providers";
import AuthGate from "@/components/auth/AuthGate";
import ZoomScale from "@/components/ZoomScale";
import Clock from "@/components/Clock";

const roboto = Roboto({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "GitDash — Material 3 PR Dashboard",
  description:
    "Real-time GitHub Kanban PR dashboard built with Material Web (Material Design 3)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${roboto.variable} h-full antialiased`}>
      <body
        suppressHydrationWarning
        className="min-h-full bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)]"
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('gitdash_theme');if(t&&t!=='default')document.documentElement.dataset.theme=t;var z=Number(localStorage.getItem('gitdash_zoom'));if(z&&z!==1)document.documentElement.style.zoom=z;}catch(e){}`,
          }}
        />
        <ZoomScale />
        <Clock />
        <AuthGate>
          <Providers>{children}</Providers>
        </AuthGate>
      </body>
    </html>
  );
}
