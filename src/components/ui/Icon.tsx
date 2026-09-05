/**
 * Set ikon SVG buatan sendiri.
 *
 * Menggantikan emoji pada elemen antarmuka (keranjang, lonceng, navigasi).
 * Alasannya bukan selera: emoji dirender berbeda di tiap sistem — perisai di
 * Android merah, di iOS biru — ukurannya tidak bisa dikontrol presisi, dan
 * mata membacanya sebagai placeholder.
 *
 * Tidak memakai pustaka ikon supaya tidak menambah beban unduhan; hanya
 * belasan ikon yang dibutuhkan, dan semuanya digambar dengan garis 1,75px
 * agar terlihat satu keluarga.
 */
export type IconName =
  | 'home' | 'cart' | 'receipt' | 'qr' | 'user' | 'bell' | 'search'
  | 'box' | 'alert' | 'badge' | 'chart' | 'building' | 'truck' | 'store'
  | 'shield' | 'check' | 'briefcase'
  // Ikon kategori pangan — dipakai pada baris pintasan kategori di katalog.
  | 'leaf' | 'fish' | 'meat' | 'egg' | 'rice' | 'fruit' | 'jar' | 'spice' | 'basket';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>,
  cart: <><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M2 3h2.5l2.4 11.1a1.8 1.8 0 0 0 1.8 1.4h8.2a1.8 1.8 0 0 0 1.8-1.4L20.5 7H6" /></>,
  receipt: <><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5" /><path d="M9 13h6M9 17h4" /></>,
  qr: <><path d="M3 8V5a2 2 0 0 1 2-2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M7 12h10" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 21v-1.5A4.5 4.5 0 0 1 9 15h6a4.5 4.5 0 0 1 4.5 4.5V21" /></>,
  bell: <><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 15 18 9" /><path d="M13.8 21a2 2 0 0 1-3.6 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20.5 20.5 16.2 16.2" /></>,
  box: <><path d="M20.5 8.5v7a1.6 1.6 0 0 1-.85 1.4l-6.9 3.7a1.6 1.6 0 0 1-1.5 0l-6.9-3.7A1.6 1.6 0 0 1 3.5 15.5v-7" /><path d="m3.7 7.7 8.3 4.4 8.3-4.4" /><path d="M12 12.1V20.7" /><path d="m11.25 2.9-7 3.7a1.6 1.6 0 0 0 0 2.8" /><path d="m12.75 2.9 7 3.7a1.6 1.6 0 0 1 0 2.8" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.3h.01" /></>,
  badge: <><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.7 7.4 21l4.6-2.5 4.6 2.5-1.1-7.3" /></>,
  chart: <><path d="M3.5 3.5v17h17" /><path d="m7 15 3.5-3.8 3 2.6L19 7.5" /></>,
  building: <><path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5V21" /><path d="M16 10h2.5A1.5 1.5 0 0 1 20 11.5V21" /><path d="M2.5 21h19" /><path d="M7.5 8h1.5M11.5 8H13M7.5 12h1.5M11.5 12H13M7.5 16h1.5M11.5 16H13" /></>,
  truck: <><path d="M2.5 16.5V6.5A1 1 0 0 1 3.5 5.5h9a1 1 0 0 1 1 1v10" /><path d="M13.5 9h3.2a1 1 0 0 1 .82.43l2.8 4a1 1 0 0 1 .18.57v2.5" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /><path d="M8.8 17.5h6.4" /></>,
  store: <><path d="M3.5 9 5 4.5h14L20.5 9" /><path d="M4.5 9v10.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9" /><path d="M9.5 20.5V14h5v6.5" /><path d="M3.5 9a2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.4 0" /></>,
  shield: <><path d="M12 21.5s7.5-3.6 7.5-9.3V5.6L12 2.7 4.5 5.6v6.6c0 5.7 7.5 9.3 7.5 9.3Z" /><path d="m9 12 2.2 2.2L15.2 10" /></>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  briefcase: <><rect x="3" y="7.5" width="18" height="12.5" rx="1.6" /><path d="M8.5 7.5v-1.6a1.6 1.6 0 0 1 1.6-1.6h3.8a1.6 1.6 0 0 1 1.6 1.6v1.6" /><path d="M3 12.5h18" /></>,
  leaf: <><path d="M20 4C10 4 4 8 4 14c0 1.5.35 2.6 1.05 3.4" /><path d="M20 4c0 9-5.6 13-11 13-1.9 0-3.6-.6-4.6-1.6" /><path d="M4.5 20c.9-4 3.3-7.4 6.8-9.4" /></>,
  fish: <><path d="M3.2 12c3-4 6.9-6 10.3-6 2.9 0 5.4 2.2 7.3 6-1.9 3.8-4.4 6-7.3 6-3.4 0-7.3-2-10.3-6Z" /><path d="M3.2 12 1.6 8.6M3.2 12l-1.6 3.4" /><circle cx="15.8" cy="10.6" r=".8" /></>,
  meat: <><path d="M8.6 15.4a5.4 5.4 0 1 1 6.9-6.9l-6.9 6.9Z" /><path d="M8.6 15.4 4.4 19.6M6.3 14 4.4 16.4M10 17.7l-2.3 1.9" /></>,
  egg: <ellipse cx="12" cy="13" rx="5.8" ry="7.8" />,
  rice: <><path d="M6.2 19c0-4.9 1.9-8.9 5.8-12.8 3.9 3.9 5.8 7.9 5.8 12.8" /><path d="M9.6 19c0-3.3 1-6 2.4-8.3 1.4 2.3 2.4 5 2.4 8.3" /><path d="M4 19h16" /></>,
  fruit: <><path d="M12 7.2c-3.9 0-5.9 3-5.9 6.4S8.5 20.8 12 20.8s5.9-3.8 5.9-7.2S15.9 7.2 12 7.2Z" /><path d="M12 7.2V4.3m0 0c1.7 0 2.9-1 2.9-2.4" /></>,
  jar: <><rect x="6.2" y="8" width="11.6" height="12.4" rx="2" /><path d="M8.2 8V5.6h7.6V8M9.2 5.6V3.6h5.6v2" /></>,
  spice: <><circle cx="9.2" cy="10.2" r="2.9" /><circle cx="15.4" cy="14" r="3.9" /><path d="M9.2 7.3V5.4M15.4 10.1V8.2" /></>,
  basket: <><path d="M3.2 9h17.6l-2 11.2H5.2L3.2 9Z" /><path d="M8 9l4-5.8L16 9" /><path d="M9.4 13v3.6M14.6 13v3.6" /></>,
};

export function Icon({
  name,
  size = 22,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

// Kategori pangan -> ikon. Kategori yang belum terdaftar jatuh ke keranjang.
const CATEGORY_ICON: Record<string, IconName> = {
  Sayur: 'leaf',
  Ikan: 'fish',
  Daging: 'meat',
  'Daging Ayam': 'meat',
  Telur: 'egg',
  Beras: 'rice',
  Buah: 'fruit',
  Bumbu: 'spice',
  'Olahan UMKM': 'jar',
};

export function categoryIcon(name: string): IconName {
  return CATEGORY_ICON[name] ?? 'basket';
}
