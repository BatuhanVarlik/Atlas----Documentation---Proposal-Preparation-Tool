import type { PrismaClient } from '@prisma/client';

/**
 * Zincirdeki tek bir kayıt satırı — hem UI (RevisionBar) hem Excel'in ÖZET
 * sayfasındaki "REVİZYON GEÇMİŞİ" bloğu bunu kullanır.
 */
export interface ChainRow {
  id: string;
  precalcNo: string;
  revisionCode: string;
  revisionNote: string;
  createdAt: Date;
  createdBy: { name: string | null } | null;
}

/** Bozuk veri (döngüsel parentId) sunucuyu kilitlemesin diye adım sınırı. */
const MAX_CHAIN_LENGTH = 50;

type ChainQueryRow = ChainRow & { parentId: string | null };

/**
 * Verilen kayıttan köke kadar revizyon zinciri, eskiden yeniye.
 *
 * `GET /api/precalc/saved/[id]` (ekrandaki revizyon şeridi) ve
 * `POST /api/precalc/export` (Excel'in ÖZET sayfasındaki "REVİZYON GEÇMİŞİ"
 * bloğu) aynı zinciri, aynı sırayla ve aynı süzgeçle göstersin diye tek
 * yerde durur — bu ikisi daha önce birbirinden bağımsız ~20 satırlık
 * döngülerdi ve sessizce ayrışmışlardı (final inceleme, bulgu I4).
 *
 * Yalnızca `revisionCode` YA DA `revisionNote`'u olan satırlar "gerçek bir
 * revizyon" sayılır — ikisi de boşsa (ör. hiç revize edilmemiş, numarasında
 * RE-kodu olmayan ilk kayıt) satır zincirden düşer.
 */
export async function readRevisionChain(
  prisma: Pick<PrismaClient, 'savedPrecalculation'>,
  id: string,
): Promise<ChainRow[]> {
  const chain: ChainQueryRow[] = [];
  let cursor: string | null = id;
  for (let guard = 0; cursor && guard < MAX_CHAIN_LENGTH; guard++) {
    const found = await prisma.savedPrecalculation.findUnique({
      where: { id: cursor },
      select: {
        id: true,
        precalcNo: true,
        revisionCode: true,
        revisionNote: true,
        createdAt: true,
        parentId: true,
        createdBy: { select: { name: true } },
      },
    }) as ChainQueryRow | null;
    if (!found) break;
    chain.unshift(found);
    cursor = found.parentId;
  }
  return chain.filter((row) => row.revisionCode || row.revisionNote);
}
