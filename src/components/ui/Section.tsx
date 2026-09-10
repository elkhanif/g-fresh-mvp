/**
 * Satu bagian halaman: judul, aksi opsional di kanan, lalu isinya.
 *
 * Sebelumnya tiap bagian menulis sendiri pembungkusnya, dan hasilnya tidak
 * pernah sama: satu bagian pakai `mb-3 flex items-center justify-between`,
 * bagian lain cuma `mb-3` tanpa flex, judulnya text-lg di satu tempat dan
 * text-xl di tempat lain. Jarak antar bagian juga bergantung pada `space-y`
 * milik induknya, jadi menambah satu bagian baru bisa menggeser semuanya.
 *
 * `action` diisi tautan atau tombol yang berlaku untuk seluruh bagian
 * (mis. "Tambah produk", "Riwayat"). Tanda panah tidak ditambahkan di sini
 * dan sebaiknya tidak ditulis di label: panah pada teks tautan tidak membawa
 * informasi apa pun yang belum dibawa oleh warna dan posisinya, dan pembaca
 * layar membacanya sebagai simbol.
 */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
