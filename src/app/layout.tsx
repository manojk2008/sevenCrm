import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

// globals.css declared these two families but nothing ever loaded them, so the
// app rendered in the OS UI font and looked different per platform. Variable
// axes only — one file each, no per-weight requests.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "SevenCRM — Enterprise CRM Management",
    template: "%s | SevenCRM",
  },
  description:
    "A production-grade Enterprise CRM Management System for managing clients, leads, quotations, sales pipeline, and business analytics.",
  keywords: [
    "CRM",
    "Enterprise",
    "Sales Management",
    "Lead Management",
    "Quotation",
    "Pipeline",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md">
          Skip to content
        </a>
        <ThemeProvider>
          <TooltipProvider delay={300}>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              toastOptions={{
                style: {
                  borderRadius: "12px",
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}