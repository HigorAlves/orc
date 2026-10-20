import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme"
import { facts } from "@/content/site"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], axes: ["opsz", "wdth"] })

// Set NEXT_PUBLIC_SITE_URL to the production domain; the fallback keeps local builds valid.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
const description = `The senior-developer workflow as a Claude Code plugin: plan, test first, QA with evidence, ship, watch CI, release. ${facts.skills} skills, ${facts.commands} commands, ${facts.agents} subagents, hook-enforced guardrails. 100% local, MIT.`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "orc · Let the orcs do the work", template: "%s · orc" },
  description,
  applicationName: "orc",
  keywords: ["Claude Code", "Claude Code plugin", "TDD", "code review", "developer workflow", "SDLC", "agent skills"],
  openGraph: { type: "website", siteName: "orc", title: "orc · Let the orcs do the work", description, url: "/" },
  twitter: { card: "summary_large_image", title: "orc · Let the orcs do the work", description },
  alternates: { canonical: "/" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d100c" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
