import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://land.trenlens.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'LandLens — See Every Inch of Land',
    template: '%s · LandLens',
  },
  description:
    "A unified map of India's land records. Click any plot to see ownership, area, type, and history.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'LandLens',
    description: "See every inch of India's land",
    url: siteUrl,
    siteName: 'LandLens',
    images: ['/brand/og-image.png'],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LandLens',
    description: "See every inch of India's land",
    images: ['/brand/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
