# APV Hemisan — AI Destekli Gıda Üretim Sistemi Dokümantasyon Aracı

> Bu dosya Claude Code'un her oturumda okuması gereken ana referans belgesidir.
> Projeye başlamadan önce bu dosyayı baştan sona oku.

---

## 🏢 Proje Hakkında

**Şirket Adı:** APV Hemisan
**Sektör:** Otomasyon Çözümleri — Gıda & Süt Üretim Sistemleri
**Amaç:** Hijyenik / Ultrahijyenik gıda üretim sistemleri için **modüler dokümantasyon ve teklif oluşturma aracı**. Mühendis kullanıcı formları doldurur, sistem boru çapı / vana / pompa hesaplarını otomatik yapar, LLM destekli öneriler sunar ve Word (.docx) teklif belgesini otomatik üretir.
**Erişim:** Yalnızca yerel ağ (LAN) — internet bağlantısı gerekmez
**Kullanıcı Profili:** Proses mühendisleri, satış mühendisleri, teklif hazırlayan personel

### Tipik Kullanım Akışı

```
1. Kullanıcı yeni modül oluşturur (örn: "Raw Milk Storage")
2. Standart (DIN/SMS) + Ürün tipi (Hijyenik/Ultrahijyenik) seçer
3. Valve Cluster içinde Dolum/Boşaltım hatlarını tanımlar
   → Her hat için kapasite gir → sistem çapı otomatik hesaplar
   → Vana tipi, kontrol unit, leakage chamber seç
4. Tanks içinde tankları tanımlar
   → Hacim, sensörler, agitator, CIP, outlet valve detayları
5. LLM modülü gözden geçirir, anomali/öneri sunar
   (örn: "DN50 yerine DN65 daha uygun olabilir, çünkü...")
6. "Teklif Oluştur" → hazır .docx şablonu otomatik dolar → indir
```

### Departmanlar (Seed'de Aktif)
| Departman | Açıklama |
|-----------|----------|
| Yönetim | Genel müdürlük, üst yönetim |
| Otomasyon | PLC programlama, panel, devreye alma |
| Satış | Müşteri teklifleri, sipariş takibi — **bu aracın ana kullanıcısı** |
| Mekanik | Mekanik tasarım — boru, vana, tank seçimi |
| Muhasebe | Fatura, bütçe, maliyet takibi |
| Depo | Stok, malzeme, sevkiyat |

---

## 🏗️ Hiyerarşi Modeli

```
Sistem Yöneticisi (Admin)
    └── Departman Müdürü
            └── Üye (Mühendis)
```

### Roller ve Yetkiler

| Rol | Yetki |
|-----|-------|
| **Admin** | Tüm sistem ayarları, kullanıcı yönetimi, tüm modüllere erişim, şablon yönetimi |
| **Departman Müdürü** | Departmanının tüm modülleri, teklifleri görme/onaylama, kullanıcı atama |
| **Üye** | Kendi oluşturduğu ya da kendisine atanmış modülleri görme/düzenleme |

---

## 📋 Domain Modeli — Veri Hiyerarşisi

Bu projenin **en kritik** kısmı domain modelinin doğru çıkarılması. Form akışı şu hiyerarşiyi izler:

```
Project (Müşteri Projesi — örn: "ABC Süt Fabrikası — Yeni Hat")
  └── Module (Modül — örn: "Raw Milk Storage")
        ├── Standard: DIN | SMS
        ├── ProductType: HYGIENIC | ULTRA_HYGIENIC
        │
        ├── ValveCluster (1 adet)
        │     ├── FillingLine[] (n adet — örn: "Raw Milk Reception 1/2/3")
        │     │     ├── capacity (L/h)
        │     │     ├── calculatedDiameter (DN—otomatik hesap)
        │     │     ├── valveType: SDE44 | DE44 | D44SL | DA44
        │     │     ├── valveControlUnit: NONE | AS_I | DC
        │     │     ├── drainValve (sabit — boru -1 size)
        │     │     ├── cipReturn (sabit — boru ile aynı)
        │     │     └── leakageChamber (sabit — 25 mm)
        │     │
        │     └── DischargeLine[] (n adet — örn: "Pasteurizer 1/2/3")
        │           ├── capacity (L/h)
        │           ├── pressure (Bar)
        │           ├── calculatedDiameter (DN—otomatik hesap)
        │           ├── valveType, valveControlUnit (aynı)
        │           ├── pumpModel, pumpKw, pumpImpellerSize
        │           ├── pressureTransmitter: present/absent
        │           ├── flowMeter: present/absent + diameter
        │           ├── cipInletValve (sabit — boru ile aynı)
        │           ├── waterInletType: SW_CIP42 | SD42
        │           └── leakageChamber (sabit — 25 mm)
        │
        └── Tank[] (n adet — örn: "RMT 1/2/3")
              ├── volume (L)
              ├── sensors: { lsh, lsm, lsl, tt, pt } — her biri var/yok
              ├── samplingValve: MANUAL | WITH_ACTUATOR
              ├── proximitySwitch: present/absent
              ├── agitator: { present, motorKw, rpm, position: SIDE|TOP }
              ├── cipBall: STATIC | ROTARY
              ├── cipInletForAgitator, cipInletForManhole (present/absent)
              ├── tankOutletValve:
              │     - present/absent
              │     - type: MANUAL | WITH_ACTUATOR
              │     - if actuator: subType: BUTTERFLY | SINGLE_SEAT
              ├── cipValve (sabit — boru ile aynı)
              ├── drainValve (otomatik boyut: SMS→1", DIN→DN25)
              ├── cipReturnPump: { model, kw, impellerSize }
              └── checkValve (sabit — boru ile aynı)
```

### Hesap Motoru (Calculation Engine)

**Bu, projenin kalbi.** Tüm boru çapı / vana / flow meter boyutlandırması bu modülde:

```typescript
// lib/calc/pipeDiameter.ts

// Formül: Q = V × A → Q = V × π × D² / 4 → D = √(4Q / πV)
// Q: m³/h cinsinden debi (kapasite L/h → /1000)
// V: hız (m/s) — sabit, hatta göre değişir
// D: hesaplanan minimum çap (mm) — sonra standartta yuvarlanır

const VELOCITY = {
  FILLING: 2.0,         // Dolum hattı: V = 2 m/s
  DISCHARGE: 1.5,       // Boşaltım hattı: V = 1.5 m/s
  FLOW_METER_MIN: 2.5,  // Flow meter: 2.5 < V < 3
  FLOW_METER_MAX: 3.0,
};

// DIN ve SMS boru çap tabloları (Modül Depolama.pdf 7. sayfadan)
const DIN_TABLE = [
  { dn: 'DN25',  inner: 26, outer: 28  },
  { dn: 'DN32',  inner: 32, outer: 34  },
  { dn: 'DN40',  inner: 38, outer: 40  },
  { dn: 'DN50',  inner: 50, outer: 52  },
  { dn: 'DN65',  inner: 66, outer: 70  },
  { dn: 'DN80',  inner: 81, outer: 85  },
  { dn: 'DN100', inner: 100, outer: 104 },
];

const SMS_TABLE = [
  { dn: '25 SMS (1")',     inner: 23.4, outer: 25.4  },
  { dn: '38 SMS (1"1/2)',  inner: 36,   outer: 38    },
  { dn: '51 SMS (2")',     inner: 48.5, outer: 51    },
  { dn: '63 SMS (2"1/2)',  inner: 60.5, outer: 63.5  },
  { dn: '76 SMS (3")',     inner: 73,   outer: 76.2  },
  { dn: '101,6 SMS (4")',  inner: 97.6, outer: 101.6 },
];
```

### Karar Kuralları (Business Rules)

1. **Çap seçimi:** Dolum hattı ve boşaltım hattı için ayrı ayrı hesaplanır → büyük olan seçilir → o çap, standart tablosundaki **bir üst** değere yuvarlanır.
   - Örn: hesap 47 mm çıktı + DIN seçiliyse → DN50
   - Örn: hesap 47 mm çıktı + SMS seçiliyse → 51 SMS (2")

2. **Drain valve (dolum/boşaltım hattı):** Boru çapından **1 size küçük** (otomatik). Tüm hatlarda aynı boyut.

3. **CIP return / CIP inlet / Check valve:** Boru çapı ile **aynı** (otomatik).

4. **Tank drain valve:** Standarta göre sabit:
   - SMS → 1 inch
   - DIN → DN25

5. **Leakage Chamber:** Her hatta sabit **25 mm** — her hat için ayrı bir chamber.

6. **Flow meter çapı:** Ayrı formülle hesaplanır (V=2.5–3 m/s) → o çap için DN seçilir.

7. **Water inlet için boru çapı:** Dolum/boşaltım hattındaki çap ile aynı.

> **Önemli:** Tüm bu kurallar `lib/calc/` altında saf TypeScript fonksiyonlar olarak yazılmalı — UI'dan, DB'den bağımsız. Test edilebilir, deterministik.

### Modül Durumları

```
DRAFT → IN_PROGRESS → REVIEW → APPROVED → DOCUMENT_GENERATED → ARCHIVED
              ↓
          CANCELLED
```

- **DRAFT:** Yeni başlanmış, eksik bilgi var
- **IN_PROGRESS:** Aktif düzenleniyor
- **REVIEW:** LLM önerileri inceleniyor, müdür onayı bekleniyor
- **APPROVED:** Onaylandı, doküman üretmeye hazır
- **DOCUMENT_GENERATED:** .docx çıktısı alındı
- **ARCHIVED:** Tamamlanmış, sadece okuma

---

## 🖥️ Teknik Mimari

### Tech Stack

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui | Next.js 16.x, Tailwind v4 |
| **Runtime** | React | 19.x |
| **Backend** | Next.js API Routes + Node.js (monolitik) | Node.js 20+ |
| **Veritabanı** | PostgreSQL | 18.x |
| **ORM** | Prisma + @prisma/adapter-pg | 7.x |
| **Auth** | NextAuth.js (credentials provider — local kullanıcı adı/şifre) | 4.x |
| **State Yönetimi** | Zustand | 5.x |
| **Form** | React Hook Form + Zod | — |
| **Doküman Üretimi** | `docxtemplater` + `pizzip` (Word .docx template doldurma) | docxtemplater 3.x |
| **LLM Entegrasyonu** | Anthropic SDK (Claude API) | `@anthropic-ai/sdk` |
| **Hesap Motoru** | Saf TS — `lib/calc/` (test edilebilir, deterministik) | — |
| **Dosya Upload** | Local dosya sistemi → `/uploads` klasörü | — |
| **Tablo/Grafik** | Recharts (dashboard için) | — |

### Önemli Versiyon Notları

- **Tailwind v4**: `tailwind.config.ts` kaldırıldı. Tüm tema ayarları `app/globals.css` içindeki `@theme {}` bloğunda. PostCSS için `@tailwindcss/postcss` kullanılıyor.
- **Prisma 7**: `schema.prisma`'da `url = env("DATABASE_URL")` artık yok. Bağlantı `prisma.config.ts` + `@prisma/adapter-pg` ile yapılıyor. `lib/prisma.ts` `PrismaPg` adapter kullanıyor.
- **Next.js 16**: `next.config.ts` (TypeScript config) destekleniyor. `serverComponentsExternalPackages` → `serverExternalPackages` olarak değişti.
- **next-auth**: v5 hâlâ beta, v4 kullanılıyor.


### Neden Monolitik?

- 30–50 kullanıcı için microservice overkill
- Windows Server'da çalıştırması kolay
- Bakım ve debug kolaylığı
- Claude Code ile tek repo = daha verimli

---

## 📁 Proje Klasör Yapısı

```
apv-hemisan-doc-tool/
├── prisma.config.ts            # Prisma 7 veritabanı bağlantı config (adapter-pg)
├── next.config.ts              # Next.js 16 config (TypeScript)
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/          # Ana dashboard & raporlar
│   │   ├── projects/           # Müşteri projeleri listesi
│   │   ├── projects/[id]/      # Proje detay + modül listesi
│   │   ├── modules/            # Tüm modüller (filtrelenebilir)
│   │   ├── modules/[id]/       # Modül oluşturma/düzenleme — ANA EKRAN
│   │   ├── modules/[id]/preview # Belge önizleme
│   │   ├── templates/          # .docx şablon yönetimi (admin)
│   │   ├── users/              # Kullanıcı yönetimi (admin)
│   │   └── settings/           # Sistem ayarları
│   └── api/
│       ├── auth/
│       ├── projects/
│       ├── modules/
│       │   ├── [id]/
│       │   ├── [id]/calculate/      # Hesap motorunu tetikler
│       │   ├── [id]/generate-doc/   # .docx üretir, döndürür
│       │   └── [id]/ai-review/      # LLM önerisi alır
│       ├── templates/
│       ├── users/
│       └── reports/
├── components/
│   ├── ui/                     # shadcn/ui bileşenleri
│   ├── module-builder/         # Modül oluşturma formu — kritik
│   │   ├── ModuleHeader.tsx    # İsim, standart, ürün tipi
│   │   ├── ValveClusterPanel.tsx
│   │   ├── FillingLineForm.tsx
│   │   ├── DischargeLineForm.tsx
│   │   ├── TanksPanel.tsx
│   │   └── TankForm.tsx
│   ├── ai-review/              # LLM öneri paneli
│   ├── reports/                # Dashboard grafikleri
│   └── layout/                 # Sidebar, header, nav
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # NextAuth config
│   ├── utils.ts                # Yardımcı fonksiyonlar
│   ├── validations/            # Zod şemaları
│   ├── calc/                   # 🎯 HESAP MOTORU (saf TS, test edilebilir)
│   │   ├── pipeDiameter.ts     # Q=V·A·π·D²/4 → D
│   │   ├── standardTables.ts   # DIN/SMS tabloları
│   │   ├── selectDN.ts         # Hesap → standart DN yuvarlama
│   │   ├── moduleCalculator.ts # Tüm modülün hesabı (orchestrator)
│   │   └── __tests__/          # Vitest birim testleri
│   ├── docx/                   # 🎯 DOKÜMAN ÜRETİMİ
│   │   ├── renderTemplate.ts   # docxtemplater wrapper
│   │   ├── buildContext.ts     # Modül → template placeholder mapping
│   │   └── templates/          # .docx şablon dosyaları
│   └── ai/                     # 🎯 LLM ENTEGRASYONU
│       ├── client.ts           # Anthropic SDK singleton
│       ├── reviewModule.ts     # Modül önerisi prompt'u
│       └── prompts/            # Prompt template'leri
├── prisma/
│   ├── schema.prisma           # Veritabanı şeması
│   ├── migrations/             # Migration dosyaları
│   └── seed.ts                 # Başlangıç verileri (departmanlar + admin)
├── public/
│   └── uploads/
│       ├── templates/          # Yüklenen .docx şablonları
│       └── generated/          # Üretilmiş teklif dokümanları
├── types/
│   └── index.ts                # Global TypeScript tipleri
├── hooks/                      # Custom React hooks
├── store/                      # Zustand store'ları (module-builder state)
├── .env.local                  # Environment değişkenleri (Next.js için)
├── .env                        # Environment değişkenleri (Prisma CLI için)
├── CLAUDE.md                   # Bu dosya
└── docker-compose.yml          # PostgreSQL için (opsiyonel)
```

---

## 🗄️ Veritabanı Şeması (Prisma)

```prisma
// Departmanlar
model Department {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String?
  createdAt DateTime @default(now())
  users     User[]
  projects  Project[]
}

// Kullanıcılar
model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  password     String     // bcrypt hash
  role         Role       @default(MEMBER)
  departmentId String
  department   Department @relation(fields: [departmentId], references: [id])
  avatar       String?
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())

  createdProjects Project[] @relation("ProjectCreator")
  createdModules  Module[]  @relation("ModuleCreator")
  reviewedModules Module[]  @relation("ModuleReviewer")
}

enum Role {
  ADMIN
  DEPARTMENT_MANAGER
  MEMBER
}

// Müşteri Projeleri (üst seviye)
model Project {
  id           String        @id @default(cuid())
  name         String                            // örn: "ABC Süt — Hat 2 Yenileme"
  customerName String?                           // örn: "ABC Süt A.Ş."
  description  String?
  code         String        @unique             // örn: "PRJ-2025-001"
  status       ProjectStatus @default(ACTIVE)
  departmentId String
  department   Department    @relation(fields: [departmentId], references: [id])
  creatorId    String
  creator      User          @relation("ProjectCreator", fields: [creatorId], references: [id])
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  modules Module[]
}

enum ProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  ARCHIVED
}

// Modüller (her proje birden çok modül içerebilir)
model Module {
  id           String       @id @default(cuid())
  name         String                              // örn: "Raw Milk Storage"
  projectId    String
  project      Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  standard     Standard                            // DIN | SMS
  productType  ProductType                         // HYGIENIC | ULTRA_HYGIENIC
  status       ModuleStatus @default(DRAFT)

  // Hesaplanmış değerler — kaydederken cache'lenir
  selectedDN          String?      // örn: "DN50" veya "51 SMS (2\")"
  selectedInnerDiameter Float?     // mm
  selectedOuterDiameter Float?     // mm

  creatorId   String
  creator     User      @relation("ModuleCreator", fields: [creatorId], references: [id])
  reviewerId  String?
  reviewer    User?     @relation("ModuleReviewer", fields: [reviewerId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  approvedAt  DateTime?

  valveCluster ValveCluster?
  tanks        Tank[]
  aiReviews    AIReview[]
  documents    GeneratedDocument[]
  activities   ModuleActivity[]
}

enum Standard {
  DIN
  SMS
}

enum ProductType {
  HYGIENIC
  ULTRA_HYGIENIC
}

enum ModuleStatus {
  DRAFT
  IN_PROGRESS
  REVIEW
  APPROVED
  DOCUMENT_GENERATED
  ARCHIVED
  CANCELLED
}

// Valve Cluster (her modülde 1 tane)
model ValveCluster {
  id       String  @id @default(cuid())
  moduleId String  @unique
  module   Module  @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  fillingLines   FillingLine[]
  dischargeLines DischargeLine[]
}

// Dolum Hattı
model FillingLine {
  id              String       @id @default(cuid())
  valveClusterId  String
  valveCluster    ValveCluster @relation(fields: [valveClusterId], references: [id], onDelete: Cascade)
  name            String                       // örn: "Raw Milk Reception 1"
  order           Int                          // sıralama

  capacity        Float                        // L/h
  calculatedDiameter Float?                    // mm — ham hesap (yuvarlanmamış)

  valveType        ValveType
  valveControlUnit ControlUnitType  @default(NONE)

  // Sabit alanlar — UI'da göstermek için
  // (gerçek değerler runtime'da seçilen DN'den türetilir)
  // drainValveSize = boru -1 size
  // cipReturnSize  = boru ile aynı
  // leakageChamber = 25 mm sabit

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Boşaltım Hattı
model DischargeLine {
  id              String       @id @default(cuid())
  valveClusterId  String
  valveCluster    ValveCluster @relation(fields: [valveClusterId], references: [id], onDelete: Cascade)
  name            String                       // örn: "Pasteurizer 1"
  order           Int

  capacity        Float                        // L/h
  pressure        Float                        // Bar
  calculatedDiameter Float?                    // mm

  valveType        ValveType
  valveControlUnit ControlUnitType  @default(NONE)

  pumpModel        String?
  pumpKw           Float?
  pumpImpellerSize Float?                      // mm

  hasPressureTransmitter Boolean @default(false)
  hasFlowMeter           Boolean @default(false)
  flowMeterDiameter      Float?                // mm (ayrı hesap)

  waterInletType   WaterInletType?             // SW_CIP42 | SD42

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum ValveType {
  SDE44
  DE44
  D44SL
  DA44
}

enum ControlUnitType {
  NONE
  AS_I
  DC
}

enum WaterInletType {
  SW_CIP42
  SD42
}

// Tanklar
model Tank {
  id        String @id @default(cuid())
  moduleId  String
  module    Module @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  name      String                             // örn: "RMT 1"
  order     Int
  volume    Float                              // L

  // Sensörler
  hasLSH Boolean @default(false)
  hasLSM Boolean @default(false)
  hasLSL Boolean @default(false)
  hasTT  Boolean @default(false)
  hasPT  Boolean @default(false)

  samplingValve   SamplingValveType  // MANUAL | WITH_ACTUATOR
  hasProximitySwitch Boolean @default(false)

  // Agitator
  hasAgitator     Boolean @default(false)
  agitatorMotorKw Float?
  agitatorRpm     Int?
  agitatorPosition AgitatorPosition? // SIDE | TOP

  cipBall              CipBallType                // STATIC | ROTARY
  hasCipInletForAgitator Boolean @default(false)
  hasCipInletForManhole  Boolean @default(false)

  // Tank outlet valve
  hasTankOutletValve     Boolean @default(false)
  tankOutletValveType    TankOutletValveType?     // MANUAL | WITH_ACTUATOR
  tankOutletValveSubType TankOutletValveSubType?  // BUTTERFLY | SINGLE_SEAT — sadece WITH_ACTUATOR ise

  // CIP return pump
  cipReturnPumpModel        String?
  cipReturnPumpKw           Float?
  cipReturnPumpImpellerSize Float?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum SamplingValveType {
  MANUAL
  WITH_ACTUATOR
}

enum AgitatorPosition {
  SIDE
  TOP
}

enum CipBallType {
  STATIC
  ROTARY
}

enum TankOutletValveType {
  MANUAL
  WITH_ACTUATOR
}

enum TankOutletValveSubType {
  BUTTERFLY
  SINGLE_SEAT
}

// LLM Önerileri — her modül için birden çok review olabilir
model AIReview {
  id        String   @id @default(cuid())
  moduleId  String
  module    Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  prompt    String   @db.Text          // Gönderilen prompt (debug için)
  response  String   @db.Text          // Ham LLM cevabı
  suggestions Json                     // Yapılandırılmış öneriler: [{ field, current, suggested, reason }]
  status    AIReviewStatus @default(PENDING)
  createdAt DateTime @default(now())
}

enum AIReviewStatus {
  PENDING
  ACCEPTED
  REJECTED
  PARTIAL    // bazıları kabul edildi
}

// Üretilen .docx dokümanları
model GeneratedDocument {
  id         String   @id @default(cuid())
  moduleId   String
  module     Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  templateId String
  template   DocumentTemplate @relation(fields: [templateId], references: [id])
  filename   String
  filepath   String                    // /uploads/generated/...
  size       Int
  generatedById String
  createdAt  DateTime @default(now())
}

// .docx Şablonları (Admin yükler)
model DocumentTemplate {
  id          String   @id @default(cuid())
  name        String                   // örn: "Standart Teklif Şablonu v2"
  description String?
  filename    String
  filepath    String                   // /uploads/templates/...
  // Hangi placeholder'lar tanımlı — UI'da kullanıcıya gösterilir
  placeholders Json                    // örn: ["module.name", "tanks[].name", "fillingLines[].capacity"]
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  documents   GeneratedDocument[]
}

// Modül aktivite logu (kim ne değiştirdi)
model ModuleActivity {
  id        String   @id @default(cuid())
  moduleId  String
  module    Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  userId    String
  action    String                     // "created", "updated", "ai_reviewed", "document_generated"
  details   Json?
  createdAt DateTime @default(now())
}
```

---

## 🎯 Hesap Motoru — Detaylı Algoritma

> Bu kısım `lib/calc/` altında saf TypeScript olarak yazılmalı.
> UI'dan ve DB'den bağımsız — sadece input alır, output döndürür.
> **Vitest ile %100 test coverage gerekli.**

### 1. Boru Çapı Hesabı

```typescript
// lib/calc/pipeDiameter.ts

export interface DiameterInput {
  capacityLh: number;   // L/h
  velocity: number;     // m/s
}

export interface DiameterResult {
  diameterMm: number;   // ham hesap, yuvarlanmamış
  flowM3h: number;      // ara değer
  flowM3s: number;      // ara değer
}

export function calculatePipeDiameter(input: DiameterInput): DiameterResult {
  const Q_m3h = input.capacityLh / 1000;         // L/h → m³/h
  const Q_m3s = Q_m3h / 3600;                    // m³/s
  // Q = V × A = V × π × D² / 4
  // D = sqrt(4 × Q / (π × V))
  const D_m = Math.sqrt((4 * Q_m3s) / (Math.PI * input.velocity));
  return {
    diameterMm: D_m * 1000,
    flowM3h: Q_m3h,
    flowM3s: Q_m3s,
  };
}
```

### 2. DN Seçimi (Standart Yuvarlama)

```typescript
// lib/calc/selectDN.ts

import { DIN_TABLE, SMS_TABLE } from './standardTables';

export function selectDN(
  minDiameterMm: number,
  standard: 'DIN' | 'SMS'
): { dn: string; inner: number; outer: number } {
  const table = standard === 'DIN' ? DIN_TABLE : SMS_TABLE;
  // İç çapı minimum gereken çaptan büyük/eşit olan ilk değer
  const selected = table.find(row => row.inner >= minDiameterMm);
  if (!selected) {
    throw new Error(
      `${minDiameterMm.toFixed(2)} mm için ${standard} tablosunda uygun çap yok. ` +
      `Mevcut max: ${table[table.length - 1].inner} mm`
    );
  }
  return selected;
}
```

### 3. Modül Orchestrator

```typescript
// lib/calc/moduleCalculator.ts

export function calculateModule(module: ModuleInput): ModuleCalculation {
  // 1. Her dolum hattı için çap hesapla (V=2)
  const fillingDiameters = module.fillingLines.map(line =>
    calculatePipeDiameter({ capacityLh: line.capacity, velocity: 2.0 })
  );

  // 2. Her boşaltım hattı için çap hesapla (V=1.5)
  const dischargeDiameters = module.dischargeLines.map(line =>
    calculatePipeDiameter({ capacityLh: line.capacity, velocity: 1.5 })
  );

  // 3. En büyüğünü seç
  const allDiameters = [
    ...fillingDiameters.map(d => d.diameterMm),
    ...dischargeDiameters.map(d => d.diameterMm),
  ];
  const maxDiameter = Math.max(...allDiameters);

  // 4. Standartta yuvarla
  const selectedDN = selectDN(maxDiameter, module.standard);

  // 5. Flow meter için her boşaltım hattı (varsa) ayrı hesap
  //    V şu an 2.75 (ortalama) — alternatif: kullanıcıya seçtirilebilir
  const flowMeterResults = module.dischargeLines
    .filter(line => line.hasFlowMeter)
    .map(line => {
      const flowDia = calculatePipeDiameter({
        capacityLh: line.capacity,
        velocity: 2.75, // 2.5 < V < 3
      });
      return {
        lineId: line.id,
        diameterMm: flowDia.diameterMm,
        selectedDN: selectDN(flowDia.diameterMm, module.standard),
      };
    });

  // 6. Türev değerler
  const drainValveSize = getDrainValveSize(selectedDN.dn, module.standard);
  const tankDrainValveSize = module.standard === 'SMS' ? '1"' : 'DN25';

  return {
    selectedDN,
    maxRawDiameterMm: maxDiameter,
    fillingDiameters,
    dischargeDiameters,
    flowMeterResults,
    drainValveSize,
    tankDrainValveSize,
    cipReturnSize: selectedDN.dn,     // boru ile aynı
    cipInletSize: selectedDN.dn,      // boru ile aynı
    checkValveSize: selectedDN.dn,    // boru ile aynı
    leakageChamberMm: 25,             // sabit
  };
}

// Boru çapından 1 size küçük
function getDrainValveSize(currentDN: string, standard: 'DIN' | 'SMS'): string {
  const table = standard === 'DIN' ? DIN_TABLE : SMS_TABLE;
  const idx = table.findIndex(r => r.dn === currentDN);
  if (idx <= 0) return table[0].dn; // En küçük zaten — değişiklik yok
  return table[idx - 1].dn;
}
```

### Test Stratejisi

```bash
# Her hesap fonksiyonu için en az 3 test:
# 1. Standart durum (PDF'te verilen örnekler — 30,000 L/h vb.)
# 2. Sınır durumlar (en küçük / en büyük tablo değeri)
# 3. Hata durumu (tabloyu aşan değer)

npm run test            # tüm hesap testleri
npm run test:watch      # geliştirirken
```

---

## 📄 Doküman Üretimi — docxtemplater Kullanımı

> Word şablonu içinde `{module.name}`, `{#tanks}...{/tanks}` gibi placeholder'lar kullanılır.
> `docxtemplater` bunları çalışma zamanında doldurur.

### Şablon Yapısı (Word içinde)

```
TEKLİF FORMU

Modül: {module.name}
Standart: {module.standard}
Ürün Tipi: {module.productTypeLabel}
Seçilen Boru: {calc.selectedDN.dn} (İç: {calc.selectedDN.inner} mm)

DOLUM HATLARI:
{#fillingLines}
  - {name}: {capacity} L/h → {calculatedDNLabel}, Vana: {valveType}
{/fillingLines}

TANKLAR:
{#tanks}
  - {name}: {volume} L, Agitator: {agitatorLabel}
{/tanks}
```

### Context Builder

```typescript
// lib/docx/buildContext.ts

export function buildTemplateContext(module: ModuleWithRelations) {
  const calc = calculateModule(module);

  return {
    module: {
      name: module.name,
      standard: module.standard,
      productType: module.productType,
      productTypeLabel: module.productType === 'HYGIENIC' ? 'Hijyenik' : 'Ultrahijyenik',
      createdDate: format(module.createdAt, 'dd.MM.yyyy'),
    },
    calc: {
      selectedDN: calc.selectedDN,
      drainValveSize: calc.drainValveSize,
      // ...
    },
    fillingLines: module.valveCluster?.fillingLines.map(line => ({
      name: line.name,
      capacity: line.capacity,
      valveType: line.valveType,
      // ...
    })) ?? [],
    dischargeLines: module.valveCluster?.dischargeLines.map(...) ?? [],
    tanks: module.tanks.map(tank => ({
      name: tank.name,
      volume: tank.volume,
      agitatorLabel: tank.hasAgitator
        ? `Var (${tank.agitatorMotorKw} kW, ${tank.agitatorRpm} rpm)`
        : 'Yok',
      // ...
    })),
  };
}
```

### Render

```typescript
// lib/docx/renderTemplate.ts
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';

export async function renderTemplate(
  templatePath: string,
  context: any
): Promise<Buffer> {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(context);
  return doc.getZip().generate({ type: 'nodebuffer' });
}
```

### Şablon Yönetimi UX Notu

- Admin `/templates` sayfasından `.docx` yükler
- Sistem yüklenen şablonu açar, placeholder listesini çıkarır, `DocumentTemplate.placeholders` JSON'a kaydeder
- Kullanıcı doküman üretirken aktif şablonlardan birini seçer

---

## 🤖 LLM Entegrasyonu — Akıllı Öneriler

> Amaç: Kullanıcı modülü kaydettiğinde, Claude API'ye modül verisini gönder, anomali/öneri al, kullanıcıya göster.

### Anthropic SDK Kurulum

```bash
npm install @anthropic-ai/sdk
```

```typescript
// lib/ai/client.ts
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const MODEL = process.env.AI_MODEL ?? 'claude-sonnet-4-6';
```

### Review Prompt'u

```typescript
// lib/ai/reviewModule.ts

const SYSTEM_PROMPT = `Sen APV Hemisan'ın gıda üretim sistemleri uzmanısın.
Süt/gıda işletmelerinde DIN ve SMS standartlarına uygun hijyenik tesisat tasarımı konusunda
deneyimlisin. Kullanıcı sana bir modül (Storage / ValveCluster + Tanks) konfigürasyonu verecek.

Görevin:
1. Vana tipi seçimini gözden geçir (SDE44/DE44/D44SL/DA44 — ürün tipine ve hatta göre uygun mu?)
2. Pompa kW değeri kapasite ile uyumlu mu?
3. Agitator motor gücü tank hacmiyle orantılı mı?
4. Sensör seçimi (LSH/LSM/LSL/TT/PT) ürün tipine uygun mu? (Ultrahijyenikte daha fazla sensör beklenir)
5. CIP konfigürasyonu eksik mi?

Cevabını JSON formatında ver:
{
  "summary": "Bir cümlelik genel değerlendirme",
  "suggestions": [
    {
      "severity": "info" | "warning" | "critical",
      "field": "tanks[0].agitatorMotorKw",
      "current": "3 kW",
      "suggested": "5.5 kW",
      "reason": "80,000 L hacim için 3 kW yetersiz olabilir; tipik öneri 4-7 kW arası."
    }
  ]
}`;

export async function reviewModuleWithAI(module: ModuleWithRelations) {
  const moduleContext = serializeModuleForAI(module); // domain → düz JSON
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Modülü gözden geçir:\n\n${JSON.stringify(moduleContext, null, 2)}`,
      },
    ],
  });
  return parseAIResponse(response);
}
```

### Güvenlik

- API key **sadece sunucuda** (`.env.local`) — istemciye sızdırılmaz
- Tüm çağrılar `/api/modules/[id]/ai-review` route'undan geçer (auth check)
- Rate limit: kullanıcı başına dakikada max 5 review (basit in-memory limiter)
- Hata durumunda kullanıcıya "AI servisine ulaşılamadı, sonra tekrar deneyin" gösterilir — fallback yok

---

## 🖥️ Form Akışı — Module Builder (UX Spec)

> Bu kısım PDF'lerdeki ekran tasarımlarını birebir yansıtır.

### State Yönetimi

```typescript
// store/moduleBuilderStore.ts (Zustand)

interface ModuleBuilderState {
  module: Partial<ModuleInput>;
  activePanel: 'valve_cluster' | 'tanks' | null;
  activeSubPanel: 'filling' | 'discharge' | null;
  activeLineIndex: number | null;
  activeTankIndex: number | null;

  // Hesap sonuçları (canlı güncellenir)
  liveCalculation: ModuleCalculation | null;

  // Actions
  setStandard: (s: Standard) => void;
  setProductType: (p: ProductType) => void;
  toggleValveCluster: () => void;
  setFillingLineCount: (n: number) => void;
  nameFillingLine: (idx: number, name: string) => void;
  updateFillingLine: (idx: number, patch: Partial<FillingLineInput>) => void;
  // ... tank için aynısı
  recalculate: () => void;
}
```

### Ekran Akışı (PDF'lere göre)

1. **Ekran 1:** Modül İsmi + Standart + Ürün Tipi + Valve Cluster (kapalı) + Tanks (kapalı)
2. **Valve Cluster Click:** Dolum Hattı / Boşaltım Hattı opsiyonları açılır
3. **Dolum Hattı Click:** "Dolum hattı sayısı" input + Onayla
4. **Sayı onaylandı:** Her hat için isim input'u + Onayla → her hat ayrı satır olur
5. **Hat satırına tıklandı:** Hat detay formu açılır (Capacity, Diameter [otomatik], Vana Tipi, Kontrol Unit, Drain valve [sabit], CIP return [sabit])
6. **Boşaltım Hattı:** Aynı akış + pompa + flow meter + pressure transmitter ek alanları
7. **Tanks Click → Tank Sayısı → İsimlendir → Tank Satırı Click:** Tank detay formu
8. **Tümü tamamlandıysa:** "AI Review" butonu → öneri paneli, ardından "Teklif Oluştur" → .docx indir

### Önemli UX Kuralları

- **Var/Yok toggle'ları:** "Var" seçilince alt input'lar açılır, "Yok" seçilince kaybolur
- **Geri al butonu:** Her alt panelde — bir üst seviyeye döner, mevcut girilen veriyi korur
- **Onayla butonu:** Yalnızca tüm zorunlu alanlar dolu olduğunda aktif (yeşil)
- **Otomatik hesap alanları:** read-only, gri arka plan, "Sistem hesaplıyor: DN50" formatında gösterilir
- **Canlı yeniden hesaplama:** kullanıcı bir hatta capacity değiştirince diğer hatların seçilen DN'i de değişebilir — UI uyarı göstermeli
- **Sabit alanlar:** "Var (Sabit 25 mm)" gibi, kullanıcı değiştiremez ama dokümanda görünür

---

## 🖥️ Sunucu Kurulumu (Windows Server)

### Gereksinimler

```
- Windows Server 2019/2022
- Node.js 20 LTS veya üzeri (https://nodejs.org) — v22 LTS önerilir
- PostgreSQL 16+ (https://www.postgresql.org/download/windows/) — v18 önerilir
- Git (opsiyonel)
```

### Kurulum Adımları

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. .env.local dosyasını oluştur (aşağıdaki şablona göre)
copy .env.example .env.local

# 3. Veritabanı migration çalıştır
npx prisma migrate deploy

# 4. Başlangıç verilerini yükle (departmanlar, admin kullanıcı)
npx ts-node prisma/seed.ts

# 5. Uygulamayı derle
npm run build

# 6. Üretim modunda başlat (PM2 ile)
pm2 start ecosystem.config.js
```

### .env.local Şablonu

```env
# Veritabanı
DATABASE_URL="postgresql://postgres:sifre@localhost:5432/apv_hemisan_doctool"

# NextAuth
NEXTAUTH_URL="http://SUNUCU_IP:3000"
NEXTAUTH_SECRET="buraya-rastgele-uzun-bir-string-gir"

# Uygulama
NEXT_PUBLIC_APP_URL="http://SUNUCU_IP:3000"
UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE=10485760  # 10MB

# AI (Anthropic Claude)
ANTHROPIC_API_KEY="sk-ant-..."
AI_MODEL="claude-sonnet-4-6"
ENABLE_AI_SUGGESTIONS=true   # false ise UI'da AI paneli gizlenir

# Port
PORT=3000
```

### Ağ Erişimi

- Uygulama `http://SUNUCU_IP:3000` adresinde çalışır
- Windows Firewall'da 3000 portunu aç
- Tüm LAN kullanıcıları bu adrese tarayıcıdan erişebilir
- **AI özelliği için:** sunucunun (sadece sunucunun) `api.anthropic.com`'a HTTPS çıkışı olmalı

---

## 📊 Dashboard ve Raporlama

### Dashboard Bileşenleri

```
┌─────────────────────────────────────────────┐
│  Genel Özet Kartları                        │
│  [Aktif Proje] [Bekleyen Onay] [Bu Ay Üretilen Belge] │
├──────────────────┬──────────────────────────┤
│  Departman       │  Modül Tipine Göre       │
│  Bazında Modül   │  Dağılım                 │
│  (Bar Chart)     │  (Pie Chart)             │
├──────────────────┴──────────────────────────┤
│  Son Aktiviteler (Timeline)                 │
├─────────────────────────────────────────────┤
│  AI Önerileri İstatistiği                   │
│  (Kabul edilen / reddedilen / bekleyen)     │
└─────────────────────────────────────────────┘
```

### Rapor Türleri

| Rapor | Açıklama |
|-------|----------|
| **Proje Özeti** | Müşteri bazında modül sayısı, tamamlanma yüzdesi |
| **Kullanıcı Performansı** | Kullanıcı bazında oluşturulan modül sayısı, ortalama süre |
| **Standart Dağılımı** | DIN vs SMS modül oranı |
| **AI Önerileri** | Kabul edilen / reddedilen oran, en sık öneri tipleri |
| **Belge Üretim Geçmişi** | Hangi şablonla kaç kez belge üretildi |

---

## 🔧 Geliştirme Komutları

```bash
# Geliştirme sunucusunu başlat
npm run dev

# TypeScript tip kontrolü
npm run type-check

# Linting
npm run lint

# Hesap motoru testleri
npm run test              # tek seferlik
npm run test:watch        # watch mode
npm run test:coverage     # coverage raporu

# Veritabanı işlemleri
npm run db:migrate           # Yeni migration (prisma migrate dev)
npm run db:migrate:deploy    # Production migration
npm run db:push              # Schema'yı direkt push et (dev)
npm run db:reset             # DB sıfırla (dev only)
npm run db:generate          # Prisma client güncelle
npm run db:studio            # DB GUI (Prisma Studio)
npm run db:seed              # Başlangıç verileri

# Build & Start
npm run build
npm run start
```

---

## 📐 Kod Kuralları

### Genel

- **Dil:** TypeScript (strict mode, `"strict": true`)
- **`any` yasak** — bilinmeyen tipler için `unknown` kullan, sonra narrow et
- **Formatlama:** Prettier + ESLint
- **Commit:** Türkçe veya İngilizce kabul, ama tutarlı ol
- **Branch:** `main` → production, `dev` → geliştirme

### Dosya & Klasör İsimlendirme

```
components/     → PascalCase   (ModuleHeader.tsx, FillingLineForm.tsx)
pages/routes/   → kebab-case   (module-builder, ai-review)
lib/utils/      → camelCase    (calculatePipeDiameter.ts, buildContext.ts)
DB tabloları    → snake_case   (filling_lines, ai_reviews)
```

### API Route Yapısı

```
GET    /api/modules               → Listele (filtreli)
POST   /api/modules               → Oluştur (sadece header — DRAFT)
GET    /api/modules/[id]          → Detay (tüm ilişkilerle)
PUT    /api/modules/[id]          → Güncelle
DELETE /api/modules/[id]          → Sil

POST   /api/modules/[id]/calculate    → Hesap motorunu çalıştır, sonucu döndür (cache yapmaz)
POST   /api/modules/[id]/ai-review    → LLM önerisi al
POST   /api/modules/[id]/generate-doc → .docx üret, indirme linki döndür
GET    /api/modules/[id]/documents    → Bu modül için üretilen tüm belgeleri listele

GET    /api/templates             → Şablonları listele
POST   /api/templates             → Şablon yükle (admin only)
DELETE /api/templates/[id]        → Şablon sil
```

### API Response Formatı

```typescript
// Başarı
{ success: true, data: {...}, message?: string }

// Hata
{ success: false, error: string, details?: any }
```

### Zod Validasyonu

Her API route'unda mutlaka Zod şeması kullan:

```typescript
const createModuleSchema = z.object({
  name: z.string().min(1).max(255),
  projectId: z.string().cuid(),
  standard: z.enum(['DIN', 'SMS']),
  productType: z.enum(['HYGIENIC', 'ULTRA_HYGIENIC']),
});

const fillingLineSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().positive().max(1_000_000),
  valveType: z.enum(['SDE44', 'DE44', 'D44SL', 'DA44']),
  valveControlUnit: z.enum(['NONE', 'AS_I', 'DC']).default('NONE'),
});
```

---

## 🔒 Güvenlik

- **Auth:** NextAuth.js Credentials Provider (yerel kullanıcılar)
- **Şifre:** bcryptjs ile hash (saltRounds: 12)
- **Session:** JWT (httpOnly cookie)
- **Yetkilendirme:** Her API route başında rol kontrolü
- **File Upload:** Sadece `.docx` (şablon), `.pdf/.jpg/.png` (ek dosyalar)
- **Max Dosya Boyutu:** 10MB
- **AI API Key:** Sadece sunucuda, asla istemciye gönderilmez

### Middleware Örneği

```typescript
// lib/auth-middleware.ts
export async function requireRole(
  session: Session | null,
  allowedRoles: Role[]
): Promise<void> {
  if (!session) throw new Error('Unauthorized');
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error('Forbidden');
  }
}
```

---

## 🚀 Geliştirme Yol Haritası

### Faz 1 — Temel Altyapı
- [ ] Proje iskeleti (Next.js 16 + Prisma 7 + PostgreSQL)
- [ ] Auth sistemi (login, session, middleware)
- [ ] Kullanıcı ve departman yönetimi
- [ ] Seed verileri (departmanlar + admin kullanıcı)

### Faz 2 — Hesap Motoru (Saf TS, UI'sız)
- [ ] `lib/calc/pipeDiameter.ts` — temel formül
- [ ] `lib/calc/standardTables.ts` — DIN/SMS tabloları
- [ ] `lib/calc/selectDN.ts` — yuvarlama mantığı
- [ ] `lib/calc/moduleCalculator.ts` — orchestrator
- [ ] Vitest birim testleri (PDF'teki örneklere göre)

### Faz 3 — Project & Module CRUD
- [ ] Müşteri projesi CRUD (`/projects`)
- [ ] Modül CRUD (header — isim, standart, ürün tipi)
- [ ] Modül listesi & filtreler

### Faz 4 — Module Builder UI (Valve Cluster)
- [ ] PDF'teki ekran akışını birebir uygula
- [ ] Dolum hattı sayısı → isimlendirme → detay formu
- [ ] Boşaltım hattı (aynısı + pompa/flow meter)
- [ ] Canlı hesap göstergesi
- [ ] Zustand store + form validasyon

### Faz 5 — Module Builder UI (Tanks)
- [ ] Tank sayısı → isimlendirme → detay formu
- [ ] Sensör toggle'ları
- [ ] Agitator, CIP ball, outlet valve dallanmaları
- [ ] Tüm var/yok mantığı

### Faz 6 — Doküman Üretimi
- [ ] Şablon yönetimi UI (admin)
- [ ] `lib/docx/buildContext.ts`
- [ ] `lib/docx/renderTemplate.ts`
- [ ] "Teklif Oluştur" butonu + indirme akışı
- [ ] Üretilmiş belge geçmişi

### Faz 7 — AI Entegrasyonu
- [ ] Anthropic SDK kurulum
- [ ] `lib/ai/reviewModule.ts` — review fonksiyonu
- [ ] AI Review paneli UI
- [ ] Önerileri kabul et / reddet akışı
- [ ] Rate limiting

### Faz 8 — Dashboard & Raporlar
- [ ] Ana dashboard kartları
- [ ] Departman/Standart bazında grafikler
- [ ] AI önerileri istatistikleri
- [ ] CSV export

### Faz 9 — İyileştirmeler
- [ ] Modül kopyalama (duplicate)
- [ ] Modül şablon olarak kaydetme
- [ ] Aktivite logu UI
- [ ] Gelişmiş arama
- [ ] Mobil uyumlu responsive tasarım

---

## 🧑‍💻 Claude Code ile Çalışma Kuralları

1. **Her modülü ayrı ayrı yaz** — "Tüm projeyi yaz" deme
2. **Hesap motorunu UI'dan önce yaz ve test et** — saf TS, deterministik, %100 coverage hedefle
3. **Her adımdan sonra `npm run type-check` çalıştır**
4. **Her büyük değişiklikten sonra git commit**
5. **Prisma schema değişiklikten sonra `prisma generate` çalıştır**
6. **Yeni API route eklerken Zod validasyonu zorunlu**
7. **Component'ler 200 satırı geçiyorsa böl**
8. **`any` tipi kullanma — bilinmeyenlerde `unknown` kullan**
9. **Sabit değerleri magic number olarak yazma** — `lib/calc/constants.ts` içinde tanımla (VELOCITY, LEAKAGE_CHAMBER_MM, vb.)
10. **LLM çağrılarını her zaman sunucu tarafından yap** — API key client'a sızmamalı

### Başlangıç Prompt Önerisi

```
"APV Hemisan AI Destekli Gıda Üretim Sistemi Dokümantasyon Aracı projesinin
Faz 1'ini başlat. Next.js 16, TypeScript, Prisma 7, PostgreSQL kullanarak
proje iskeleti oluştur. Auth için NextAuth.js credentials provider ekle.
Prisma seed dosyasında şu departmanları ekle: Yönetim, Otomasyon, Satış,
Mekanik, Muhasebe, Depo.
Admin kullanıcı: admin@apvhemisan.local / Admin1234

Schema'yı CLAUDE.md'deki tüm enum ve modellerle birlikte oluştur — Project,
Module, ValveCluster, FillingLine, DischargeLine, Tank, AIReview,
GeneratedDocument, DocumentTemplate."
```

---

## 👥 Kullanıcı ve Departman Bilgileri

> Tam kullanıcı listesi: **`KULLANICILAR.md`** — yeni oturumda veya seed güncellenince bu dosyayı oku.

### Aktif Departmanlar (seed'de mevcut)

| Departman | Renk | Açıklama |
|-----------|------|----------|
| Yönetim | `#1E40AF` | Admin + genel yönetim |
| Otomasyon | `#0F766E` | PLC, panel, devreye alma |
| Satış | `#7C3AED` | Teklif, sipariş — **ana kullanıcı** |
| Mekanik | `#BE185D` | Tasarım, imalat, montaj |
| Muhasebe | `#0369A1` | Fatura, ödeme |
| Depo | `#4D7C0F` | Stok, malzeme |

### Varsayılan Şifreler

| Rol | Şifre |
|-----|-------|
| Admin | `Admin1234` |
| DEPARTMENT_MANAGER | `Manager1234` |
| MEMBER | `Member1234` |

### Seed Çalıştırma Notu

`prisma/seed.ts` her çalıştırıldığında **tüm veriyi siler** (deleteMany zinciri) ve yeniden oluşturur.
Production'da yanlışlıkla çalıştırmamak için dikkatli ol — kullanıcı şifrelerini sıfırlar.

---

## 🚀 Production Deployment (Windows Server / PM2)

### Kritik: `next/font/google` Kullanma

Bu proje LAN sunucusunda çalışır, **kullanıcı tarayıcıları internete erişmek zorunda değil**.
`next/font/google` build sırasında Google Fonts'a bağlanmaya çalışır → istemci tarafında network sorunu yaratabilir.

**Doğru yaklaşım:**
- `app/layout.tsx`'te `import { Inter } from 'next/font/google'` **kullanma**
- `app/globals.css`'te `--font-sans: Inter, system-ui, -apple-system, sans-serif` tanımlı — yeterli

### PM2 ile Başlatma (ecosystem.config.js)

Windows'ta `pm2 start npm -- start` kullanma — `npm.cmd` batch dosyasını Node.js scripti sanıp hata verir.

```js
// ecosystem.config.js (proje kökünde)
module.exports = {
  apps: [{
    name: 'apv-hemisan-doctool',
    script: 'node_modules\\.bin\\next.cmd',
    args: 'start',
    cwd: 'C:\\Users\\batuhan.varlik\\Desktop\\Doc Tool',
    env: { NODE_ENV: 'production', PORT: 3000 },
    watch: false,
    autorestart: true,
    max_restarts: 5,
    restart_delay: 3000,
  }],
};
```

```bash
# İlk başlatma
pm2 start ecosystem.config.js

# Sonraki yeniden başlatmalar
pm2 restart apv-hemisan-doctool

# Sistem başlangıcına kaydet (bir kez)
pm2 save
pm2 startup

# Log takibi
pm2 logs apv-hemisan-doctool
pm2 status
```

### Production Güncellemesi (Adım Adım)

```bash
# 1. Kodu güncelle
git pull

# 2. Bağımlılık değişikliği varsa
npm install

# 3. Prisma schema değişikliği varsa
npx prisma migrate deploy
npx prisma generate

# 4. Build
npm run build

# 5. Yeniden başlat
pm2 restart apv-hemisan-doctool
```

### Veritabanı Bağlantı Bilgileri

```
Host:     localhost (veya 127.0.0.1)
Port:     5432
DB:       apv_hemisan_doctool
User:     postgres
Şifre:    hemisan123
```

`.env.local` ve `.env` dosyaları git'e commit edilmez — sunucuda elle oluşturulur.

---

## 🔧 Bilinen Teknik Kararlar ve Kısıtlamalar

### Tailwind v4 Özel Notlar
- `tailwind.config.ts` **yok** — tüm tema `app/globals.css` içindeki `@theme {}` bloğunda
- `@tailwindcss/postcss` kullanılıyor (klasik `tailwindcss` PostCSS plugin değil)

### Prisma 7 + adapter-pg
- `schema.prisma`'da `datasource db` bloğunda `url` field'ı **yok**
- Bağlantı `prisma.config.ts` + `lib/prisma.ts` içindeki `PrismaPg(pool)` ile kurulur
- Migration için `.env` dosyasında `DATABASE_URL` gerekli (Prisma CLI okur)

### next-auth v4 (v5 beta değil)
- `pages/api/auth/[...nextauth].ts` yerine `app/api/auth/[...nextauth]/route.ts`
- Session'da `user.id`, `user.role`, `user.departmentId` alanları mevcut

### Hesap Motoru — Determinizm Garantisi
- `lib/calc/*` hiçbir yan etki içermez (DB okuma, env, random, Date yok)
- Aynı input → aynı output, her zaman
- Test edilebilirlik için bu kuralı asla bozma — `Date.now()` veya `Math.random()` istiyorsan caller'a aldır, parametre olarak al

### LLM Cevaplarına Güvenme
- AI önerileri **kullanıcıya sunulur**, otomatik uygulanmaz
- Kullanıcı her öneriyi kabul/reddet ile geçer
- LLM çıktısı `AIReview.suggestions` JSON'ında saklanır, schema validation ile parse edilir
- Geçersiz JSON gelirse `AIReview.status = REJECTED` + hata log'la, kullanıcıya "AI cevabı işlenemedi" göster

### docxtemplater Şablon Sınırlamaları
- Şablon `.docx` formatında olmalı, `.doc` desteklenmez
- Placeholder syntax: `{name}` veya loop için `{#items}...{/items}`
- Şablon yüklerken `unzipper` ile içeriği parse edip placeholder listesini çıkar
- Resim ekleme (logo vb.) için `docxtemplater-image-module` lisanslı — şimdilik atla

### Modal / Portal Paterni
Tüm context menu ve floating modal'lar `ReactDOM.createPortal(content, document.body)` ile render edilir.

---

## 📁 APV Hemisan Proje Yönetim Sistemi'nden Devralınan Kodlar

Eğer mevcut proje (Jira clone) ile aynı codebase'i template olarak kullanıyorsan:

### Kopyalanacak Dosyalar
```
prisma/seed.ts              → kullanıcı/departman listesini güncelle (modül/proje seed yok!)
lib/prisma.ts               → bağlantı havuzu ayarları aynı kalır
lib/auth.ts                 → NextAuth config — JWT callback'leri hazır
ecosystem.config.js         → sadece cwd ve name güncelle
app/globals.css             → tema renkleri @theme bloğunda
prisma.config.ts            → aynı
```

### Sıfırdan Yazılacaklar
```
prisma/schema.prisma         → Bu CLAUDE.md'deki yeni schema
lib/calc/*                   → Hesap motoru (mevcut projede yok)
lib/docx/*                   → Doküman üretimi (mevcut projede yok)
lib/ai/*                     → LLM entegrasyonu (mevcut projede yok)
components/module-builder/*  → Form akışı (mevcut projede yok)
app/(dashboard)/modules/*    → Modül sayfaları
app/api/modules/*            → Modül API'ları
```

### Asla Kopyalanmayacaklar
```
Issue / Sprint / Comment / Activity modelleri  → tamamen farklı domain
Kanban board bileşenleri                       → kullanılmayacak
My Tasks / Notifications                       → şimdilik kapsam dışı
```
