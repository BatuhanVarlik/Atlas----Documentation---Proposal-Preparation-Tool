import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // mssql yerel bağımlılıklar taşıyor; paketlenmek yerine çalışma anında yüklenmeli.
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'docxtemplater', 'pizzip', 'mssql'],
};

export default nextConfig;
