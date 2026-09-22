# Advanced Precalculation — Tablo/Scroll Mimarisi (Tasarım)

Tarih: 2026-09-22
Durum: onaylandı
Kapsam: `app/(dashboard)/advanced-precalculation/AdvancedPrecalculationClient.tsx` —
yalnızca ana katalog tablosu (PRECALCULATION sekmesi). OTHERS, CASHFLOW,
TOTALS sekmeleri bu spec'in dışında.

## 1. Amaç

Kullanıcı geri bildirimi: "A-Z bütün sütunlar kaydırarak görünmeli, şu an
sadece seçili sütunlar görünüyor", "2 scroll ile yönetmek çok zor oluyor",
"tablo ayrı bir elementte görünmesin, tek sayfa/tek scroll istiyorum",
"kullanım alanı sınırlı, geniş alanda kullanmak istiyorum".

## 2. Mevcut durum (doğrulandı)

Önemli düzeltme: bu ekranın tablosu `components/precalc/PrecalcTable.tsx` +
`columns.ts` **değil** — o çift, navigasyonda linki bile olmayan eski
`/precalculation` sayfasına ait. Gerçek tablo
`AdvancedPrecalculationClient.tsx` içinde kendi `COLUMNS` dizisiyle (satır
175-361) ayrı tanımlı.

Doğrulanan gerçekler:

- **Sütun seti dar:** `COLUMNS` 24 sütun tanımlıyor (7 `lead` + 17
  `optional`); workbook'ta (`lib/precalc/workbook.json`) A–BO arası **63**
  sütun var. Eksik ~39 sütun (Motor kW, Buhar, Basınç, Aktüatör, Bağlantı
  Tipi, vb. teknik blok) bu ekranda hiç tanımlı değil.
- **"Görünüm" seçici zaten var:** `COLUMN_VIEWS` = `Teklif` (varsayılan,
  optional'dan 5 sütun), `Teknik` (10 sütun), `Tümü` (`cols: null` → tüm 24).
  Varsayılan `quote`, bu yüzden kullanıcı çoğu sütunu hiç görmüyor.
- **Hiçbir sütun sabit (sticky) değil** — kod bunu bilerek böyle yapmış
  (satır 514-516 yorumu). Bu davranış korunacak (kullanıcı onayladı).
- **Sütun genişliği/sırası kullanıcıya özel** — sürükle-bırak ve resize,
  `localStorage['atlas.pricing.columns.v1']`'de saklanıyor
  (`colWidths`, `colOrder`, `colView`). Bu mekanizma değişmeyecek.
- **Tek `<table>`, satırlar sanallaştırılmış:** `thead`+`tbody` aynı
  `overflow-auto` kutusunun içinde (satır 1378-1391); `th` zaten
  `sticky top-0`. Sanallaştırma `viewport.top/height` state'ine dayanıyor
  (satır 453-455) ve bu değer `scrollRef.current.scrollTop`'tan geliyor.
  Satır yükseklikleri değişken (`NODE_ROW_HEIGHT=33`, `ITEM_ROW_HEIGHT=37`),
  kümülatif `rowOffsets` üzerinde `seek()` ile ikili arama yapılıyor
  (satır 990, 1006-1011) — `padTop`/`padBottom` boş satırlarla dolduruluyor.
- **"2 scroll" sorununun kaynağı:** tablo kutusu `height: calc(100vh -
  17rem)` ile sınırlı, kendi `overflow-auto`'su var. Fare tablonun üstündeyken
  fare tekerleği SADECE tabloyu kaydırıyor; sayfanın geri kalanını (üstteki
  araç çubuğu, alttaki TotalsPanel) görmek için imleci tablo dışına taşımak
  gerekiyor. Yatay kaydırma da aynı kutuda, native scrollbar ile.

## 3. Karar

### F1 — Sütun seti tamamlanır

`COLUMNS`'a eksik ~39 workbook sütunu eklenir (hepsi salt okunur/`custom`
olmayan basit `render`, computed teknik veri — kullanıcı girişi yok).
`COLUMN_VIEWS.tech`'e teknik olanlar eklenir, `all` zaten `cols: null`
olduğu için otomatik kapsar.

### F2 — Varsayılan görünüm "Tümü" olur

`useState('quote')` → `useState('all')`. Kullanıcı hâlâ "Teklif" / "Teknik"
kısayollarına geçebilir (view picker kalıyor), ama sayfa ilk açıldığında
artık her şey scroll ile erişilebilir.

### F3 — Dikey scroll: tablo sayfayla birlikte akar (tek native scroll)

`scrollRef` kutusunun **dikey** ekseni serbest bırakılır: `overflow-auto` →
`overflow-x-auto overflow-y-visible`, sabit `height: TABLE_HEIGHT` kalkar.
`<table>` artık normal sayfa akışında; dış kart (`bg-white rounded-xl
border ... overflow-hidden`) da kaldırılır, tablo sayfanın doğal genişliğini
kullanır (kullanıcının "geniş alanda kullanmak istiyorum" isteği).

Sanallaştırma `scrollTop` yerine pencereye bağlanır:
`viewport.top = window.scrollY - tableEl.getBoundingClientRect().top -
window.scrollY` biçiminde, yani pratikte
`-tableEl.getBoundingClientRect().top` (elementin viewport'a göre üst
kenarı); `viewport.height = window.innerHeight`. Dinleyici `scrollRef`
yerine `window`'a `scroll`/`resize` ile bağlanır (`passive: true`).
`seek()`, `rowOffsets`, `padTop/padBottom` mantığı **değişmez** — sadece
girdi kaynağı değişiyor.

`th`'deki `sticky top-0` otomatik olarak pencere scroll'una göre
konumlanmaya devam eder (en yakın kaydırılabilir atası artık `document`);
üstte sabit bir app header/nav varsa `top-0` o header'ın yüksekliği kadar
düzeltilir (uygulamanın genel layout'unda böyle bir şerit varsa).

### F4 — Yatay scroll: gizli native + özel kompakt kontrol

`scrollRef` kutusu **yatayda** `overflow-x: auto` olarak kalır (trackpad/
shift+wheel/klavye ile kaydırma bozulmaz) ama native scrollbar
`scrollbar-width: none` (+ `::-webkit-scrollbar { display: none }`) ile
gizlenir.

Yeni bileşen `components/precalc/HScrollControl.tsx`:

- `position: fixed`, ekranın altına sabit, küçük/kompakt, açık gri/nötr
  yuvarlatılmış kapsayıcı.
- Sol ok / sağ ok + kısa track + koyu yuvarlak thumb.
- Prop olarak hedef scroll elementinin `ref`'ini (ya da `scrollLeft` /
  `scrollWidth` / `clientWidth` okuma-yazma callback'lerini) alır — saf,
  `AdvancedPrecalculationClient`'tan bağımsız test edilebilir.
- Thumb pozisyonu = `scrollLeft / (scrollWidth - clientWidth)`; sürüklemede
  ters formülle `scrollLeft` yazılır. Ok tıklaması `scrollBy({ left: ±160,
  behavior: 'smooth' })`.
- `scrollWidth <= clientWidth` ise (yatay taşma yoksa) bileşen `hidden`.
- Yalnızca `PRECALCULATION` sekmesi aktifken ve tablo görünür alandaysa
  render edilir (diğer sekmelerde / sayfa dışına scroll edilince gizlenir).

## 4. Dosya değişiklikleri

- `AdvancedPrecalculationClient.tsx` — `COLUMNS` genişletme, `colView`
  varsayılanı, scroll/virtualization kaynağının pencereye taşınması, dış
  kart stilinin kaldırılması, `HScrollControl` entegrasyonu.
- `components/precalc/HScrollControl.tsx` — yeni, saf/test edilebilir.
- `components/precalc/columns.ts` — **dokunulmaz** (farklı, kullanılmayan
  sayfaya ait; karıştırmamak için burada da not düşülüyor).

## 5. Test

- `HScrollControl` birim testi: `scrollLeft` ↔ thumb pozisyonu/genişliği
  matematiği (vitest + jsdom veya saf fonksiyon olarak `computeThumbRect`
  ayrıştırılıp test edilir).
- Elle doğrulama: 3665 satırda hızlı dikey scroll'da boş alan/atlama
  olmaması, yatay scroll'da header'ın satırlarla hizalı kalması, "Tümü"
  görünümünde eklenen ~39 sütunun doğru veriyi gösterdiği, sütun
  genişlik/sıra kaydının (localStorage) bozulmadığı.

## 6. Kapsam dışı

- Sütunlardan hiçbiri sabitlenmeyecek (kullanıcı onayı: mevcut davranış).
- OTHERS tablosu (`OthersTable.tsx`) ve CASHFLOW sekmesi bu spec'e dahil
  değil — ayrı görev listelerinde ele alınacak (silik kontrast, sarı
  uyarı, hücre renkleri).
- `components/precalc/PrecalcTable.tsx` / `columns.ts` / `/precalculation`
  sayfası bu spec kapsamında değiştirilmez (kullanılmayan eski ekran).
