import type { Metadata } from "next";
import ThemeScript from "@/components/ThemeScript";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pablo — AI Agents Platform",
  description: "Programmable, tool-enabled, cost-bounded agents on Ten Sparrows MDCs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-ink-950 text-ink-100 antialiased">
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
