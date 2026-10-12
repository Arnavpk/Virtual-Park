import type { Metadata, Viewport } from 'next';
import { Baloo_2 } from 'next/font/google';
import './globals.css';

// Exposed as --dp-font, which the park's stylesheet picks up.
const baloo = Baloo_2({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--dp-font' });

export const metadata: Metadata = {
  title: 'Digital Park',
  description: 'Explore the park in 3D and find your way to rides, food and facilities.',
};

// Stops the page pinch-zooming while someone is steering the character.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#c4edf2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={baloo.variable}>
      <body>{children}</body>
    </html>
  );
}
