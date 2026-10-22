import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'GloveBox — A little care. A longer road.', description: 'Your car’s co-pilot for upkeep and trip costs.' };
export default function RootLayout({ children }: LayoutProps<'/'>) { return <html lang="en"><body>{children}</body></html>; }
