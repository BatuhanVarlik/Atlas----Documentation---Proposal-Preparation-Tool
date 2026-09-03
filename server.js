// Özel HTTPS sunucusu — Next.js'i SSL/wildcard.pfx sertifikasıyla 443'te yayınlar,
// 80'e gelen HTTP isteklerini HTTPS'e yönlendirir.
// `next start` HTTPS desteklemediği için PM2 bu dosyayı çalıştırır (ecosystem.config.js).
// Sertifika: *.apvhemisan.com (iç CA) — erişim IP ile değil, atlas.apvhemisan.com
// alan adıyla yapılmalı; yoksa tarayıcı sertifika uyarısı verir.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const host = process.env.HOST || '0.0.0.0';
const httpsPort = parseInt(process.env.HTTPS_PORT || '443', 10);
const httpPort = parseInt(process.env.HTTP_PORT || '80', 10);

const pfxPath = process.env.SSL_PFX_PATH || path.join(__dirname, 'SSL', 'wildcard.pfx');
const passphrase = process.env.SSL_PFX_PASSPHRASE || 'papvba.12';

if (!fs.existsSync(pfxPath)) {
  console.error(`SSL sertifikası bulunamadı: ${pfxPath}`);
  process.exit(1);
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  https
    .createServer(
      {
        pfx: fs.readFileSync(pfxPath),
        passphrase,
        minVersion: 'TLSv1.2',
      },
      (req, res) => handle(req, res)
    )
    .listen(httpsPort, host, () => {
      console.log(`> Atlas HTTPS hazır: https://${host}:${httpsPort}`);
    });

  // HTTP → HTTPS kalıcı yönlendirme
  http
    .createServer((req, res) => {
      const hostname = (req.headers.host || '').split(':')[0];
      const portSuffix = httpsPort === 443 ? '' : `:${httpsPort}`;
      res.writeHead(301, { Location: `https://${hostname}${portSuffix}${req.url}` });
      res.end();
    })
    .listen(httpPort, host, () => {
      console.log(`> HTTP→HTTPS yönlendirme aktif: ${httpPort} → ${httpsPort}`);
    });
});
