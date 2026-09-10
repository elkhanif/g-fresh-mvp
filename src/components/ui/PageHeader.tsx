/**
 * Judul halaman + identitas pemilik halaman.
 *
 * Dibuat karena tiap beranda peran memulai halamannya dengan cara berbeda:
 * kurir punya <h1> dan sub-judul, produsen dulu langsung membuka dengan tiga
 * angka tanpa judul apa pun, lalu <h1> "Produk saya" muncul di tengah halaman.
 * Akibatnya pengguna yang berpindah peran (demo, atau admin yang mengecek)
 * kehilangan titik acuan "saya ada di mana".
 *
 * `meta` sengaja menerima array, bukan satu string yang sudah digabung dengan
 * titik-tengah di halaman pemanggil. Rangkaian "A · B · C" menempel jadi satu
 * blok abu-abu yang tidak terbaca di layar sempit, dan tidak ada cara memotong
 * salah satu bagiannya saat sempit. Di sini tiap butir jadi elemennya sendiri
 * dan boleh membungkus baris.
 *
 * `actions` diisi kontrol yang mengubah keadaan halaman (mis. tombol
 * ketersediaan kurir); `badges` diisi label identitas yang cuma dibaca
 * (rating, sertifikat). Dua-duanya di kanan judul, tapi dipisah supaya urutan
 * tab keyboard tidak berpindah-pindah ketika ada badge yang muncul/hilang.
 */
export function PageHeader({
  title,
  meta,
  badges,
  actions,
}: {
  title: string;
  meta?: Array<string | null | undefined>;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const butir = (meta ?? []).filter(Boolean) as string[];

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {butir.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {butir.map((m) => (
              <span key={m} className="text-sm text-ink/60">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {(badges || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {badges}
          {actions}
        </div>
      )}
    </div>
  );
}
