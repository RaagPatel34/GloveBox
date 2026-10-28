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
  title: "GloveBox — A little care. A longer road.",
  description: "Your car’s co-pilot for upkeep and trip costs.",
};

// The app is dark in every scheme, so one theme colour (the rail's) is enough. The page
// runs under the notch and resizes with the on-screen keyboard; content pads with safe areas.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111315",
  colorScheme: "dark",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
