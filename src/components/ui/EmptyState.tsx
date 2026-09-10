import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * Keadaan kosong.
 *
 * Ada enam tempat di aplikasi ini yang menampilkan kosong sebagai satu
 * kalimat abu-abu di dalam kartu putih: "Tidak ada tugas aktif saat ini.",
 * "Belum ada order untuk diambil.", "Belum ada produk. ...". Tiga masalahnya:
 *
 * 1. Kartu putih berisi satu kalimat terlihat seperti data yang gagal dimuat,
 *    bukan seperti keadaan normal. Di sini latarnya dibuat bergaris putus-putus
 *    dan transparan — jelas "belum ada isi", bukan "isinya rusak".
 * 2. Kalimatnya memberi tahu tanpa mengarahkan. Layar kosong adalah tempat
 *    terbaik menaruh langkah berikutnya, jadi `action` disediakan sebagai slot
 *    tetap, bukan tambahan opsional yang mudah dilupakan.
 * 3. Kalimat produsen bahkan salah arah: "Tambahkan lewat formulir di samping"
 *    — di HP formulir itu berada di bawah seluruh daftar, bukan di samping.
 *    Petunjuk yang menyebut posisi di layar akan berbohong di salah satu
 *    ukuran layar; sebutkan namanya, bukan tempatnya.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-leaf-200 bg-white/40 px-5 py-8 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-leaf-50 text-leaf-400">
        <Icon name={icon} size={22} />
      </span>
      <p className="mt-3 font-medium text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-ink/55">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
