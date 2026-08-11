import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import Providers from "@/components/notifications/Providers";

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
    <html lang="en" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
