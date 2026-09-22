import type { CellFormat } from './columns';

export interface IdentityField {
  /** workbook.params'taki anahtar — adres oradan çözülür. */
  key: string;
  label: string;
  placeholder: string;
  hint: string;
  format: Extract<CellFormat, 'text' | 'date'>;
  /** İçerik uzunluğuna göre sağa doğru büyüsün mü? (bkz. autoWidth.ts) */
  autoWidth?: boolean;
}

/**
 * Teklifin kimliği. Hepsi kitabın başlık bloğuna yazılır (B1–B7);
 * dışa aktarılan Excel'in başlık bloğu da aynı hücrelerden okunduğu için
 * burada girilen değer doğrudan dosyaya düşer.
 */
export const IDENTITY_FIELDS: IdentityField[] = [
  {
    key: 'projectNo',
    label: 'Proje No',
    placeholder: 'ör. 2026-114',
    hint: 'Teklifin bağlı olduğu proje numarası. Başlık bloğuna yazılır.',
    format: 'text',
  },
  {
    key: 'precalcNo',
    label: 'Precalculation No',
    placeholder: 'ör. PRE-2026-114 RE-00',
    hint: 'Kaydın listedeki adı. Revizyon için sonundaki kodu değiştirin (RE-00 → RE-01).',
    format: 'text',
    autoWidth: true,
  },
  {
    key: 'customer',
    label: 'Müşteri',
    placeholder: 'ör. Sütaş A.Ş.',
    hint: 'Teklifin verildiği firma (CUSTOMER).',
    format: 'text',
  },
  {
    key: 'endUser',
    label: 'Son Kullanıcı',
    placeholder: 'ör. Karacabey Tesisi',
    hint: 'Sistemi işletecek taraf (END USER). Müşteriyle aynıysa boş bırakılabilir.',
    format: 'text',
  },
  {
    key: 'date',
    label: 'Tarih',
    placeholder: 'gg.aa.yyyy',
    hint: 'Teklif tarihi (DATE). Boşsa Excel üretilirken bugünün tarihi yazılır.',
    format: 'date',
  },
  {
    key: 'preparedBy',
    label: 'Hazırlayan',
    placeholder: 'ör. Süleyman Altındal',
    hint: 'Teklifi hazırlayan mühendis (PREPARED BY).',
    format: 'text',
  },
];
