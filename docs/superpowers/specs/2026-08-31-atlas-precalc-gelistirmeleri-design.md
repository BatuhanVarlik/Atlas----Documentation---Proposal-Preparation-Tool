# Atlas — Advanced Precalculation Geliştirmeleri (Tasarım)

Tarih: 2026-08-31
Durum: onay bekliyor
Kapsam: `Atlas/` — precalculation motoru, ekranı ve Excel dışa aktarımı

## 1. Amaç

Advanced Precalculation ekranına on ayrı geliştirme yapılacak. Hepsi aynı
alt sistemi (hesap motoru + dışa aktarım) elediği için tek spec altında
toplanır, beş bağımsız teslim edilebilir faza bölünür.

Temel ilke değişmez: **hesap sunucuda yeniden koşar.** İstemciden yalnızca
kullanıcı girdileri gelir; listedeki rakam, ekrandaki rakam ve üretilen
Excel hiçbir zaman ayrışmaz (`lib/precalc/savedSummary.ts`'teki mevcut
kural). Yeni cashflow ve revizyon mantığı da bu yüzden saf, paylaşılan
modüllere yazılır — ekran ve sunucu aynı fonksiyonu çağırır.

## 2. Kaynak kitaptan doğrulanan gerçekler

`ORNEK PRECALCULATION 36.07.xlsm` (workbook.json) üzerinde doğrulandı:

| Konu | Adres | İçerik |
|---|---|---|
| Ödeme planı | `A4884:E4891` | A=aşama, B=oran, C=hafta, D=`M4881*B`, E=`C+2` |
| Ödeme planı toplamı | `D4892` | `SUM(D4883:D4891)` |
| Cashflow tablosu | `P4883:X4934` | 52 hafta; P/Q/U=hafta no |
| — gelir | `W` | `SUMIF(E$4884:E$4891,"<hafta>",D$4884:D$4891)` |
| — gider | `X` | `SUMIF(V$14:V$4819,…,M$14:M$4819)+SUMIF(V$4826:V$4877,…,M$4826:M$4877)` |
| — net (kümülatif) | `V` | `V(önceki)+(W−X)`; ilk satır `W−X` |
| Ara toplam / genel toplam | `4863` / `4878` | M=maliyet, N=satış |
| Excel'in kâr oranı | `M4882` | `1−(M4878/M4881)` — `M4881` elle girilir, varsayılan 0 |
| Parite | `AYRINTILI FIYATLANDIRMA!I9` | 1 |
| Ayrıntılı fiyat sütunları | `A:E`, satır 1–51 | A=sıra/başlık, B=kalem, C=adet, D=TOTAL EURO, E=`D*$I$9` (TOTAL DOLAR) |

Kitap sayfaları (12): PRECALCULATION, KABLO, SMS PASLANMAZ, DIN PASLANMAZ
MALZEME, INTEGRATOR PANOSU, 1734-1794 SERISI ASI FLEX IO, 1734-1794 SERISI
DC FLEX IO, KONTROL ODASI OLUSTURMA, AYRINTILI FIYATLANDIRMA, EQUIPMENT
LIST, Sevk Listesi, Ekipman Listesi Limitleri.

Araç zinciri doğrulandı: `xlsx-js-style` sütun `outlineLevel` ve
`_xlnm.Print_Area` tanımlı adını yazıyor; `pizzip` (docxtemplater ile zaten
kurulu) üretilen .xlsx'i açıp `pageSetup` ve chart XML'i enjekte etmeye
yetiyor. **Yeni paket gerekmiyor.**

## 3. Mimari

### 3.1 Yeni saf modüller

Motoru okur, DOM ve veritabanı bilmez; doğrudan vitest ile test edilir.

- `lib/precalc/cashflow.ts` — `readCashflow(engine): CashflowData`
  52 haftalık `{ week, gelir, gider, net }`, ödeme planı satırları,
  toplamlar ve türev ölçüler (en düşük net, kapanış neti).
- `lib/precalc/revisionDiff.ts` — `diffEntries(before, after, workbook)`
  → `RevisionChange[]`; `formatRevision(changes, opts)` → Türkçe cümle.
- `lib/precalc/precalcNo.ts` — `parseRevisionCode(no)` →
  `{ base, code, seq } | null`; `RE-00`, `RS-00` gibi kodları ayırır.
- `lib/precalc/xlsxPost.ts` — pizzip ile son işlem: A4 `pageSetup` +
  `fitToPage`, sütun gizleme, native line chart enjeksiyonu.

### 3.2 export.ts bölünmesi

`lib/precalc/export.ts` (730 satır) → `lib/precalc/export/`:

```
index.ts          buildPrecalcWorkbook + ExportOptions + yeniden dışa aktarımlar
precalcSheet.ts   PRECALCULATION sayfası (EXPORT_COLUMNS, ödeme planı bloğu)
summarySheet.ts   ÖZET (+ revizyon geçmişi bloğu)
cashflowSheet.ts  CASHFLOW sayfası
detailedSheet.ts  AYRINTILI FIYATLANDIRMA (baskı alanı / parite kuralı)
listSheets.ts     EQUIPMENT LIST + Sevk Listesi
snapshot.ts       buildSheetSnapshot (ham sayfa dökümü)
```

Dış API korunur: `buildPrecalcWorkbook`, `buildSheetSnapshot`,
`quoteEquipmentNumbers`, `precalcFileName`, `EXPORT_COLUMNS`,
`DETAILED_SHEET` aynı isimle `export/index.ts`'ten çıkar; çağıran
dosyalarda `@/lib/precalc/export` importu değişmez.

### 3.3 Client bölünmesi

`AdvancedPrecalculationClient.tsx` (82 KB) üç parça verir:

- `components/precalc/CashflowPanel.tsx` — tablo + recharts grafik
- `components/precalc/RevisionBar.tsx` — katlanır revizyon şeridi
- `components/precalc/columnGroups.ts` — P–AC / AD–BO grup tanımları

### 3.4 Veritabanı

`SavedPrecalculation` modeline dört alan:

```prisma
parentId        String?
parent          SavedPrecalculation?  @relation("PrecalcRevision", fields: [parentId], references: [id])
revisions       SavedPrecalculation[] @relation("PrecalcRevision")
/** precalcNo'dan ayrıştırılan revizyon kodu ("RE-01"). */
revisionCode    String   @default("")
/** Kullanıcının düzenlediği revizyon açıklaması. */
revisionNote    String   @default("")
/** Otomatik üretilen fark listesi (RevisionChange[]). */
revisionChanges Json?
```

Migration adı: `add_precalc_revision_chain`. Var olan kayıtlar
`parentId = null`, `revisionCode = ""` ile geçerli kalır.

## 4. Özellikler

### F1 — OTHERS: Kaynak (G) en sona

`components/precalc/OthersTable.tsx` içindeki `OTHERS_COLUMNS` dizisinde
`G` girdisi `O`'dan sonraya taşınır. Hesap etkilenmez.

### F2 — Kimlik alanları

`IDENTITY_FIELDS`'e dört alan eklenir; adresleri `workbook.params`'ta
hazır: `customer` (`B1`), `endUser` (`B3`), `date` (`B5`),
`preparedBy` (`B7`). Proje No / Precalculation No ile aynı şeritte,
`flex-wrap` ile sarar. Export'un `header` bloğu bu hücrelerden okunduğu
için dışa aktarımda ek iş yok.

### F3 — Dosya adı = Precalculation No

`precalcFileName(precalcNo?: string)`: numara varsa
`"<precalcNo> <YYYY-MM-DD>.xlsx"`, yoksa bugünkü
`"PRECALCULATION <tarih> <saat>.xlsx"` davranışı sürer. Windows'ta yasak
karakterler (`\ / : * ? " < > |`) alt çizgiye çevrilir.
`/api/precalc/export` numarayı `summarizePrecalc(entries).precalcNo` ile
sunucuda okur — istemcinin gönderdiği ada güvenilmez.

### F4 — Kâr oranı düzeltmesi

Excel'in `M4882`'si elle girilen `SALES PRICE`'a (`M4881`, varsayılan 0)
bağlı olduğu için hep yanlış çıkıyor. Gösterilen değer artık genel toplam
satırından türetilir:

```
kârOranı = N4878 > 0 ? 1 − (M4878 / N4878) : null      // null → "—"
```

Kaynak kitabın hücresi değiştirilmez. Uygulanacağı yerler: ÖZET sayfası ve
`TotalsPanel` (panelde şu an hesaplanıp gösterilmiyor; bir ölçü kutusu
olarak eklenir).

### F5 — AYRINTILI FIYATLANDIRMA baskı düzeni

`xlsxPost.ts` sayfaya şunları yazar:

```xml
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
```

Baskı alanı `_xlnm.Print_Area` tanımlı adıyla:

- Parite (`I9`) = 1 → `E` sütunu `hidden`, baskı alanı `A1:D<son>`
- Parite ≠ 1 → `E` görünür, baskı alanı `A1:E<son>`

`<son>` sabit 51 değil, sayfanın gerçek son satırından okunur.

### F6 — Export sayfa listesi ve sırası

```
ÖZET, CASHFLOW, PRECALCULATION, AYRINTILI FIYATLANDIRMA, KABLO,
SMS PASLANMAZ, DIN PASLANMAZ MALZEME, INTEGRATOR PANOSU,
1734-1794 SERISI ASI FLEX IO, 1734-1794 SERISI DC FLEX IO,
KONTROL ODASI OLUSTURMA, Sevk Listesi
```

`EQUIPMENT LIST` ve `Ekipman Listesi Limitleri` (ayar sayfası) dosyaya
girmez. Ham sayfalar `buildSheetSnapshot` ile basılır; renk sözlüğü aynı
kalır (mor = formül, sarı = elle girilen, kalın = metin başlık). Excel
sayfa adı 31 karakterle sınırlı olduğu için isimler mevcut kısaltma
kuralından geçirilir.

### F7 — Katlanır sütun grupları (P–AC, AD–BO)

Katalog tablosunun başlık satırının üstüne iki düğme:

- `⊞ Sipariş & Sevkiyat (P–AC)` — yedek parça, tedarik süresi, ödeme
  haftası, OC numaraları, sipariş/yükleme/gümrük tarihleri
- `⊞ Teknik Veriler (AD–BO)` — kapasite, motor, basınç, bağlantı,
  aktüatör vb.

Sütunlar elle listelenmez; `workbook.columns` haritasından üretilir, yani
yeni fiyat listesi sütun eklerse kendiliğinden gelir. Hücreler mevcut
`SheetCell` / `TextSheetCell` ile motora bağlanır: kitapta formülü olan
hücre salt okunur ve mor, formülsüz olan düzenlenebilir ve sarı —
tablonun geri kalanındaki kuralın aynısı. `ÖDEME HAFTASI` (`V`)
düzenlenince Cashflow anında değişir.

Mevcut altı dağınık sütun (`sparePartNo`, `sparePartDesc`,
`sparePartPrice`, `inletDiameter`, `outletDiameter`, `connections`)
`COLUMNS`'tan çıkarılır ve gruplara girer; aynı veri iki yerde görünmez.
Grupların açık/kapalı durumu `atlas.pricing.columns.v1` yanındaki
`atlas.pricing.groups.v1` anahtarında saklanır.

Aynı gruplama Excel'e de yazılır: `EXPORT_COLUMNS` genişletilir ve grup
sütunlarına `outlineLevel: 1` verilir, böylece dosyada da `+`/`−` ile
açılıp kapanır.

### F8 — Revizyon zinciri

Kural: **aynı Precalculation No ile üzerine yazılamaz.** Kayıt açıkken
düğme "Yeni Revizyon Kaydet" olur.

- `precalcNo` değişmemişse istek gönderilmez; şerit uyarır:
  *"Bu numara zaten kayıtlı — revizyon için Precalculation No'yu
  değiştirin (RE-00 → RE-01)."*
- Değişmişse `POST /api/precalc/saved` gövdesine `parentId` eklenir.
  Sunucu yeni satır açar, ebeveynin `entries`'iyle farkı hesaplar,
  `revisionCode` / `revisionChanges` / `revisionNote` alanlarını yazar.
- `PATCH /api/precalc/saved/[id]` yalnızca henüz revizyonu olmayan ilk
  kayıt için korunur (numara değişmediyse yine reddedilir).

Eski kayıt listede kalır ve açılabilir; geçmiş `parentId` zinciriyle
okunur. Mevcut sürüm (`version`) kilidi olduğu gibi durur — aynı kaydı iki
kişi eş zamanlı düzenlerse yine 409 döner.

### F9 — Revizyon farkı ve metni

`diffEntries` şu değişiklikleri cümleye çevirir:

| Değişiklik | Hücre | Örnek cümle |
|---|---|---|
| Kalem eklendi | `F<satır>` 0 → n | `5 Adet Manuel Butterfly Valve SV1F-2" H 12S EPDM AISI316 eklendi` |
| Kalem çıkarıldı | `F<satır>` n → 0 | `2 Adet … çıkarıldı` |
| Adet değişti | `F<satır>` | `… adedi 3 → 5 oldu` |
| Liste fiyatı | `I<satır>` | `… liste fiyatı 1.200,00 → 1.350,00` |
| Çarpan | `J`/`K<satır>` | `… çarpanı 0,33 → 0,30` |
| Genel gider | `F4864…F4877` | `Risk 1 → 0 olarak güncellendi` |
| Parametre | `M4883`, `M4884` | `Kâr Oranı 0,70 → 0,85 olarak güncellendi` |
| Kimlik | `B1`,`B2`,`B3`,`B5`,`B7` | `Müşteri "X" → "Y" olarak güncellendi` |

Satır → ad eşlemesi `catalog.json`'daki `techSpec` alanından; boşsa
`machineType`, o da boşsa `EQ <satır>`.

Çıktı biçimi:

```
RE-01 : 5 Adet Manuel Butterfly Valve SV1F-2" H 12S EPDM AISI316 eklendi,
        Kâr Oranı 0,70 → 0,85 olarak güncellendi. ; Süleyman Altındal ; 31.08.2026
```

Yirmiden fazla değişiklikte metin `…ve 14 değişiklik daha` ile kapanır;
tam liste `revisionChanges` JSON'unda durur. Kaydetme sırasında açılan
küçük diyalog üretilen metni gösterir, kullanıcı düzenleyip ekleme
yapabilir (`revisionNote`).

Görünürlük:

- **UI** — sekmelerin üstünde katlanır şerit: `▸ Revizyonlar (3)`.
  Açıkken en yeniden eskiye satırlar; bir satıra tıklamak o revizyonun
  kaydını açar.
- **Excel ÖZET** — "REVİZYON GEÇMİŞİ" bloğu, aynı sırayla.

### F10 — Cashflow

`TOTALS_TAB`'ın hemen sağında yeni sekme (`CASHFLOW_TAB`).

İçerik:

1. Dört ölçü kutusu — toplam gelir, toplam gider, en düşük NET (ve
   haftası), kapanış NET.
2. Ödeme planı tablosu (`A4884:E4891`): aşama, oran (`B`,
   düzenlenebilir), hafta (`C`, formülsüzse düzenlenebilir), tutar (`D`),
   tahsilat haftası (`E`). Altında `D4892` toplamı.
3. 52 haftalık tablo: HAFTA, GELİR, GİDER, NET.
4. recharts çizgi grafik: NET ana çizgi (turuncu, kaynak Excel'deki gibi),
   GELİR ve GİDER açılıp kapanabilir ikincil çizgiler.

Excel'de `CASHFLOW` sayfası: aynı iki tablo + native line chart.
`xlsxPost.ts` chart parçalarını (`xl/charts/chart1.xml`,
`xl/drawings/drawing1.xml`, ilişkiler ve `[Content_Types].xml` girdileri)
enjekte eder; seri referansı `CASHFLOW!$D$n:$D$n+51` biçiminde hücrelere
bağlıdır, böylece Excel'de düzenlenebilir kalır.

## 5. Fazlar

| Faz | Kapsam | Bağımlılık |
|---|---|---|
| 1 | F1, F2, F3, F4 | — |
| 2 | `export/` bölünmesi, F6, `xlsxPost.ts` iskeleti, F5 | — |
| 3 | `cashflow.ts`, F10 (UI + Excel + grafik) | Faz 2 |
| 4 | F7 (UI grupları + Excel outline) | Faz 2 |
| 5 | `precalcNo.ts`, `revisionDiff.ts`, şema, API, F8, F9 | Faz 1, Faz 2 (ÖZET bloğu için) |

Her faz kendi başına teslim edilebilir; sıra bağımlılık sütununa uyduğu
sürece serbesttir.

## 6. Test

Saf modüller önce testle yazılır (`vitest`, mevcut
`components/precalc/__tests__` düzeni):

- `cashflow.ts` — kaynak kitabın `V`/`W`/`X` formüllerinin motorla
  hesaplanmış sonucuna karşı; `settle()` çağrılmadan toplamların
  `#DIV/0!` kaldığı bilinen tuzak için ayrı bir vaka.
- `revisionDiff.ts` — kalem ekleme/çıkarma/adet, parametre ve kimlik
  değişimleri; 20 üstü kısaltma; değişiklik yokken boş sonuç.
- `precalcNo.ts` — `RE-00`, `RS-12`, kodsuz numara, boş metin.
- `xlsxPost.ts` — çıktı pizzip ile geri açılıp `pageSetup`, `hidden`
  sütun, `_xlnm.Print_Area` ve chart parçalarının XML'i doğrulanır.
- `export/index.ts` — üretilen kitapta sayfa adları ve sırası.

API uçları için el testi: kaydet → numara değiştirmeden kaydet
(reddedilmeli) → numara değiştir (yeni kayıt + revizyon satırı).

## 7. Kapsam dışı

- Excel'in `M4882` hücresinin kendisi düzeltilmez (kaynak kitap salt
  okunur).
- `EQUIPMENT LIST` dışa aktarımdan çıkarılır ama üreten kod silinmez;
  ileride geri istenirse tek satırla döner.
- Eski kayıtlara geriye dönük revizyon geçmişi üretilmez; zincir bu
  değişiklikten sonraki kayıtlarda başlar.
