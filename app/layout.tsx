import type { Metadata } from 'next';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Atlas Teklif Oluşturma Aracı',
  description: 'Hijyenik / Ultrahijyenik gıda üretim sistemleri için modüler dokümantasyon ve teklif oluşturma aracı',
};

// Tema ilk render'dan önce uygulanır → flash yok
const themeInitScript = `(function(){try{var t=localStorage.getItem('atlas-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
