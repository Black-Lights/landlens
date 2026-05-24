import { setRequestLocale } from 'next-intl/server';

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
        LandLens
      </h1>
      <p className="mt-3 text-lg text-slate-600">See Every Inch of Land</p>
      <p className="mt-8 max-w-md text-sm text-slate-500">
        Sprint 1 foundation is live. The map ships in Sprint 2.
      </p>
    </main>
  );
}
