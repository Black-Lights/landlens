import { setRequestLocale } from 'next-intl/server';
import MapClient from '@/components/map/MapClient';

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <main className="h-[100dvh] w-full">
      <MapClient />
    </main>
  );
}
