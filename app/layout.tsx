import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'APV Hemisan — Dokümantasyon Aracı',
  description: 'Hijyenik / Ultrahijyenik gıda üretim sistemleri için modüler dokümantasyon ve teklif oluşturma aracı',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
