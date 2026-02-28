/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import Link from "next/link";

import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, LEGAL_DISCLAIMER_LINES } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Legal, compliance, insurance, and continuity infrastructure for the AI-powered software economy.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body
        className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased"
        style={
          {
            "--font-heading": '"Outfit"',
            "--font-body": '"IBM Plex Sans"',
            "--font-mono": '"JetBrains Mono"',
          } as React.CSSProperties
        }
      >
        <TooltipProvider>
          <ErrorBoundary>
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">{children}</div>
              <footer className="legal-footer px-4 py-8 sm:px-6 lg:px-10">
                <div className="mx-auto flex max-w-7xl flex-col gap-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-heading text-lg font-semibold">{APP_NAME}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Infrastructure for builders shipping AI software without a legal back office.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                      <Link href="/">Home</Link>
                      <Link href="/login">Login</Link>
                      <Link href="/signup">Sign Up</Link>
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs leading-5 text-[var(--text-tertiary)] md:grid-cols-2">
                    {LEGAL_DISCLAIMER_LINES.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </footer>
            </div>
            <Toaster
              richColors
              position="top-right"
              toastOptions={{
                style: {
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  borderColor: "var(--border-default)",
                },
              }}
            />
          </ErrorBoundary>
        </TooltipProvider>
      </body>
    </html>
  );
}
