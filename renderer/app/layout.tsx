import type { Metadata } from "next";
import { GeistPixelSquare, GeistPixelGrid, GeistPixelCircle, GeistPixelTriangle, GeistPixelLine } from 'geist/font/pixel';
import { GeistSans } from 'geist/font/sans';

import "./globals.css";
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
    >
      <body className="min-h-full flex flex-col dark tracking-tight">{children}</body>
    </html>
  );
}
