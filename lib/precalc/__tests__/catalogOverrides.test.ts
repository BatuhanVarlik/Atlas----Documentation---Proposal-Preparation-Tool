import { describe, expect, it } from 'vitest';
import {
  applyCatalogOverridesToItems,
  computeCatalogKey,
  resolveOverridesToWorkbookPatches,
} from '../catalogOverrides';
import type { CatalogItem } from '../catalog';

/** Testler için asgari bir CatalogItem — kullanılmayan alanlar boş/varsayılan. */
function item(patch: Partial<CatalogItem>): CatalogItem {
  return {
    id: 1,
    row: 100,
    group: 'catalog',
    placeOfUse: '',
    eqNo: '',
    techSpec: '',
    label: '',
    supplier: '',
    machineType: '',
    listPrice: 100,
    priceFactor: 0.5,
    extraFactor: 1,
    discount: 0.5,
    netPrice: 50,
    sparePartNo: '',
    sparePartDesc: '',
    sparePartPrice: null,
    inletDiameter: '',
    outletDiameter: '',
    connections: null,
    topCategory: 'PROCESS VALVES',
    subCategory: 'SDEMS44',
    productType: '',
    standard: 'SMS',
    needsPrice: false,
    tree: [],
    qty: 0,
    transportCost: null,
    totalCost: null,
    salesPrice: null,
    fx: '',
    open: '',
    ...patch,
  };
}

describe('computeCatalogKey', () => {
  it('eqNo varsa onu kullanır', () => {
    expect(computeCatalogKey(item({ eqNo: 'H333837' }))).toBe('eq:H333837');
  });

  it('eqNo baştaki/sondaki boşluklardan etkilenmez', () => {
    expect(computeCatalogKey(item({ eqNo: '  H333837  ' }))).toBe('eq:H333837');
  });

  it('eqNo yoksa kategori + teknik açıklamadan bileşik anahtar üretir', () => {
    const a = item({ eqNo: '', techSpec: 'Tank A' });
    const b = item({ eqNo: '', techSpec: 'Tank B' });
    expect(computeCatalogKey(a)).not.toBe(computeCatalogKey(b));
  });

  it('eqNo yokken aynı içerik aynı anahtarı üretir', () => {
    const a = item({ eqNo: '', techSpec: 'Tank A', topCategory: 'X' });
    const b = item({ eqNo: '', techSpec: 'Tank A', topCategory: 'X' });
    expect(computeCatalogKey(a)).toBe(computeCatalogKey(b));
  });
});

describe('applyCatalogOverridesToItems', () => {
  it('listPrice düzeltmesi netPrice ve discount\'u yeniden hesaplar', () => {
    const it1 = item({ eqNo: 'H1', listPrice: 100, priceFactor: 0.5, extraFactor: 1, netPrice: 50, discount: 0.5 });
    const { items } = applyCatalogOverridesToItems([it1], [
      { catalogKey: 'eq:H1', field: 'listPrice', value: '200' },
    ]);
    expect(items[0].listPrice).toBe(200);
    expect(items[0].netPrice).toBe(100); // 200 * 0.5 * 1
    expect(items[0].discount).toBe(0.5); // çarpanlar değişmedi
  });

  it('eşleşmeyen kalemlere dokunmaz', () => {
    const it1 = item({ eqNo: 'H1', listPrice: 100 });
    const it2 = item({ eqNo: 'H2', listPrice: 300 });
    const { items } = applyCatalogOverridesToItems([it1, it2], [
      { catalogKey: 'eq:H1', field: 'listPrice', value: '999' },
    ]);
    expect(items[1].listPrice).toBe(300);
  });

  it('metin alanı (label) düzeltmesi fiyat alanlarını etkilemez', () => {
    const it1 = item({ eqNo: 'H1', label: 'ESKİ', listPrice: 100, netPrice: 50 });
    const { items } = applyCatalogOverridesToItems([it1], [
      { catalogKey: 'eq:H1', field: 'label', value: 'YENİ' },
    ]);
    expect(items[0].label).toBe('YENİ');
    expect(items[0].listPrice).toBe(100);
    expect(items[0].netPrice).toBe(50);
  });

  it('formül üretimli (fx) alana yazılan düzeltme uygulanmaz', () => {
    // J sütunu (priceFactor) fx içinde — Excel'de formülle üretiliyor demektir.
    const it1 = item({ eqNo: 'H1', fx: 'J', priceFactor: 0.38 });
    const { items } = applyCatalogOverridesToItems([it1], [
      { catalogKey: 'eq:H1', field: 'priceFactor', value: '1' },
    ]);
    expect(items[0].priceFactor).toBe(0.38);
  });

  it('kataloğa artık uymayan (öksüz) düzeltme sessizce yok sayılır', () => {
    const it1 = item({ eqNo: 'H1' });
    expect(() => applyCatalogOverridesToItems([it1], [
      { catalogKey: 'eq:YOK', field: 'listPrice', value: '1' },
    ])).not.toThrow();
  });

  it('düzeltilen alanlar overriddenFields üzerinden işaretlenir', () => {
    const it1 = item({ eqNo: 'H1' });
    const { items } = applyCatalogOverridesToItems([it1], [
      { catalogKey: 'eq:H1', field: 'listPrice', value: '10' },
    ]);
    expect(items[0].overriddenFields).toEqual(['listPrice']);
  });

  it('catalogKey, bileşik anahtara giren bir alan (techSpec) düzeltilse bile kaymaz', () => {
    // eqNo yok -> anahtar techSpec'ten türer. techSpec'in KENDİSİ düzeltilirse
    // anahtar şablon değerinden hesaplanmalı, düzeltilmiş değerden değil —
    // yoksa bir sonraki yüklemede aynı düzeltme "öksüz" görünür.
    const original = item({ eqNo: '', techSpec: 'Eski Açıklama', row: 1 });
    const templateKey = computeCatalogKey(original);
    const { items } = applyCatalogOverridesToItems([original], [
      { catalogKey: templateKey, field: 'techSpec', value: 'Yeni Açıklama' },
    ]);
    expect(items[0].techSpec).toBe('Yeni Açıklama');
    expect(items[0].catalogKey).toBe(templateKey);
  });

  it('aynı bileşik anahtarı paylaşan tüm kalemlere uygulanır', () => {
    const a = item({ eqNo: '', techSpec: 'Aynı', row: 1 });
    const b = item({ eqNo: '', techSpec: 'Aynı', row: 2 });
    const key = computeCatalogKey(a);
    const { items } = applyCatalogOverridesToItems([a, b], [
      { catalogKey: key, field: 'supplier', value: 'YENİ TEDARİKÇİ' },
    ]);
    expect(items[0].supplier).toBe('YENİ TEDARİKÇİ');
    expect(items[1].supplier).toBe('YENİ TEDARİKÇİ');
  });
});

describe('resolveOverridesToWorkbookPatches', () => {
  it('eşleşen kalemin satırına doğru sütunda yama üretir', () => {
    const it1 = item({ eqNo: 'H1', row: 1847 });
    const patches = resolveOverridesToWorkbookPatches([it1], [
      { catalogKey: 'eq:H1', field: 'listPrice', value: '7055.84' },
    ]);
    expect(patches).toEqual([{ addr: 'I1847', value: 7055.84 }]);
  });

  it('formül üretimli alan için yama üretmez', () => {
    const it1 = item({ eqNo: 'H1', row: 1847, fx: 'J' });
    const patches = resolveOverridesToWorkbookPatches([it1], [
      { catalogKey: 'eq:H1', field: 'priceFactor', value: '1' },
    ]);
    expect(patches).toEqual([]);
  });

  it('metin alanı için değeri olduğu gibi (string) yazar', () => {
    const it1 = item({ eqNo: 'H1', row: 1847 });
    const patches = resolveOverridesToWorkbookPatches([it1], [
      { catalogKey: 'eq:H1', field: 'supplier', value: 'ITT FLOW' },
    ]);
    expect(patches).toEqual([{ addr: 'E1847', value: 'ITT FLOW' }]);
  });
});
