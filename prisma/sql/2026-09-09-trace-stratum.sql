-- Paket A — strata penelusuran mutu per produk.
--
-- Dijalankan SETELAH `npx prisma db push`. Push hanya menambah kolom dengan
-- nilai default; dua UPDATE di bawah yang mengisi arti sebenarnya.
--
-- Kolom database "harvestedAt" TIDAK di-rename. Prisma memetakannya ke field
-- `freshAt` lewat @map, karena `db push` tidak bisa mendeteksi rename — dia
-- DROP kolom lama lalu CREATE yang baru, dan seluruh data panen hilang.

BEGIN;

-- 1. Produk milik pedagang kios pasar: nilai freshAt-nya adalah waktu kulakan,
--    bukan waktu panen. Tanpa baris ini seluruh produk kios akan mengklaim
--    "waktu panen" yang tidak pernah mereka laporkan.
UPDATE "Product" p
SET    "freshBasis" = 'TRANSAKSI'
FROM   "ProducerProfile" pr
WHERE  p."producerId" = pr."id"
  AND  pr."sellerType" = 'PASAR';

-- 2. Samakan snapshot di pesanan lama dengan produknya.
UPDATE "OrderItem" oi
SET    "freshBasis" = 'TRANSAKSI'
FROM   "Product" p
WHERE  oi."productId" = p."id"
  AND  p."freshBasis" = 'TRANSAKSI';

COMMIT;

-- CATATAN: "traceStratum" pesanan lama SENGAJA dibiarkan INFORMASI_DASAR.
--
-- Menaikkannya secara retroaktif berarti mencetak klaim "Mutu Terverifikasi"
-- untuk transaksi yang data lahan & metode budidayanya memang tidak pernah
-- dikumpulkan. Paspor mutu harus mencerminkan apa yang benar saat barang
-- dibeli — termasuk ketika jawabannya "waktu itu datanya belum ada".

-- Verifikasi setelah dijalankan:
--   SELECT "freshBasis", COUNT(*) FROM "Product" GROUP BY 1;
--   SELECT "traceStratum", COUNT(*) FROM "OrderItem" GROUP BY 1;
