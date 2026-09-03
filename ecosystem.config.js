// PM2 production config (Windows Server)
// Windows'ta `pm2 start npm -- start` veya next.cmd KULLANMA — PM2 .cmd dosyasını
// Node scripti sanıp "@ECHO off" satırında patlar; süreç arka planda kalır.
// HTTPS: server.js SSL/wildcard.pfx sertifikasıyla 443'te yayınlar, 80'i HTTPS'e yönlendirir.
// 443 ve 80 portları yönetici (Administrator) yetkisi + firewall izni ister.
module.exports = {
  apps: [
    {
      name: 'atlas',
      script: 'server.js',
      interpreter: 'node',
      cwd: 'C:\Atlas',
      env: {
        NODE_ENV: 'production',
        // ⚠️ Bu IP sunucuda bir ağ kartına atanmış OLMALI; değilse "EADDRNOTAVAIL" verir.
        //    Chronos HOST vermeden 0.0.0.0'a bağlanıyor; ikisi aynı anda 443'ü
        //    tutamaz — Chronos'a da HOST verilmeli (bkz. deploy notları).
        HOST: '172.20.0.156',
        HTTPS_PORT: 443,
        HTTP_PORT: 80,
        // Sertifika şifresini değiştirmek gerekirse: SSL_PFX_PASSPHRASE
        // Farklı pfx yolu gerekirse: SSL_PFX_PATH (varsayılan: <cwd>\SSL\wildcard.pfx)
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
    },
  ],
};
