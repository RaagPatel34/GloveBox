import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Martian_Mono } from "next/font/google";
import "./globals.css";

// Martian Mono sets the odometer digits and every number; Instrument Sans carries the prose.
const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = Martian_Mono({
  variable: "--font-numeric",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GloveBox",
  description: "Your car's co-pilot for upkeep and trip costs.",
};

export const viewport: Viewport = {
  themeColor: "#0d0e0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
