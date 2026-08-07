import type { Metadata } from "next";
import { ThemeProvider } from "@/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

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
      className="font-sans"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground">
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
