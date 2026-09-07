import {
  Home, ShoppingCart, ReceiptText, QrCode, User, Bell, Search,
  Package, TriangleAlert, BadgeCheck, ChartColumn, Building2, Truck, Store,
  ShieldCheck, Check, Briefcase,
  Leaf, Fish, Drumstick, Egg, Wheat, Apple, Soup, ShoppingBasket,
  type LucideIcon,
} from 'lucide-react';

/**
 * Lapisan tipis di atas `lucide-react`.
 *
 * Sebelumnya ikon digambar tangan di berkas ini. Hasilnya gagal di ukuran
 * kecil: telur kebaca sebagai angka nol, daging seperti tetesan air, ikan
 * kehilangan siluetnya di 20px. Ikon kecil butuh satu bentuk dominan yang
 * khas — itu keahlian tersendiri, bukan sesuatu yang layak dikerjakan sendiri
 * demi menghindari satu dependensi.
 *
 * Lucide tree-shakeable: yang ikut ke bundle hanya ikon yang diimpor di atas,
 * bukan seluruh pustaka.
 *
 * Nama lokal (`'cart'`, `'fish'`) sengaja dipertahankan alih-alih memakai
 * nama Lucide langsung, supaya pustakanya bisa diganti nanti tanpa menyentuh
 * satu pun komponen pemakainya.
 */
export type IconName =
  | 'home' | 'cart' | 'receipt' | 'qr' | 'user' | 'bell' | 'search'
  | 'box' | 'alert' | 'badge' | 'chart' | 'building' | 'truck' | 'store'
  | 'shield' | 'check' | 'briefcase'
  // Kategori pangan
  | 'leaf' | 'fish' | 'meat' | 'egg' | 'rice' | 'fruit' | 'jar' | 'basket';

const MAP: Record<IconName, LucideIcon> = {
  home: Home,
  cart: ShoppingCart,
  receipt: ReceiptText,
  qr: QrCode,
  user: User,
  bell: Bell,
  search: Search,
  box: Package,
  alert: TriangleAlert,
  badge: BadgeCheck,
  chart: ChartColumn,
  building: Building2,
  truck: Truck,
  store: Store,
  shield: ShieldCheck,
  check: Check,
  briefcase: Briefcase,
  leaf: Leaf,
  fish: Fish,
  meat: Drumstick,
  egg: Egg,
  rice: Wheat,
  fruit: Apple,
  jar: Soup,
  basket: ShoppingBasket,
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
  const C = MAP[name] ?? ShoppingBasket;
  return <C size={size} strokeWidth={1.75} className={className} aria-hidden="true" />;
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
  Bumbu: 'leaf',
  'Olahan UMKM': 'jar',
};

export function categoryIcon(name: string): IconName {
  return CATEGORY_ICON[name] ?? 'basket';
}
