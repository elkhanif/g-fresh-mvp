import { prisma } from './db';
import { apiUser } from './rbac';

/**
 * Guard kepemilikan produk untuk route handler produsen.
 *
 * Ditaruh di satu tempat supaya tiga endpoint (harga / stok / riwayat) tidak
 * masing-masing menulis ulang cek yang sama — pola duplikasi guard itu yang
 * dulu melahirkan kebocoran data batch #11. Perhatikan: profil produsen
 * di-load eksplisit dan di-guard `if (!producer)`, JANGAN pakai `producer?.id`
 * langsung di where Prisma (undefined = "abaikan filter", bukan "jangan
 * cocokkan apa pun").
 */
export type OwnerCheck =
  | { ok: false; status: number; error: string }
  | { ok: true; userId: string; producerId: string; product: any };

export async function requireOwnedProduct(productId: string): Promise<OwnerCheck> {
  const user = await apiUser();
  if (!user || user.role !== 'PRODUSEN') {
    return { ok: false, status: 403, error: 'Hanya produsen.' };
  }

  const producer = await prisma.producerProfile.findUnique({ where: { userId: user.id } });
  if (!producer) {
    return { ok: false, status: 400, error: 'Profil produsen tidak ada.' };
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, producerId: producer.id },
  });
  if (!product) {
    // Sengaja 404 (bukan 403) untuk produk milik orang lain: jangan bocorkan
    // bahwa ID-nya ada tapi bukan punya dia.
    return { ok: false, status: 404, error: 'Produk tidak ditemukan.' };
  }

  return { ok: true, userId: user.id, producerId: producer.id, product };
}
