import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Image from 'next/image';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-primary">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <Header session={session} />
        <main className="flex-1 overflow-y-auto p-6 relative">
          {/* APV Hemisan watermark */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.08] dark:opacity-[0.14] z-0 select-none">
            <Image
              src="/hemisan-logo.png"
              alt=""
              width={1000}
              height={750}
              className="w-3/4 max-w-3xl h-auto object-contain"
              priority
            />
          </div>
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
