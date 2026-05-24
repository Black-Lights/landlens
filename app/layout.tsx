import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LandLens — See Every Inch of Land',
  description: 'Unified pan-India cadastral platform. Click any plot to see ownership, area, history.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
