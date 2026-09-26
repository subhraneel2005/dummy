import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "dummy",
  description: "your local ai assistant that does stuff for you",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", GeistSans.className
      )}
      suppressHydrationWarning
    >
      {/* No `dark` class here on purpose. `.dark` re-declares every token for the
          whole subtree and `@custom-variant dark (&:is(.dark *))` matches any
          descendant, so pinning it on <body> pinned the app to dark and no amount
          of toggling could escape it. next-themes owns the class on <html>. */}
      <body className="min-h-full flex flex-col tracking-tight">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
