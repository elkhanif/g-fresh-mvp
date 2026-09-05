'use client';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Notif = {
  id: string; kind: string; title: string; body: string;
  href: string | null; readAt: string | null; createdAt: string;
};

const KIND_ICON: Record<string, IconName> = {
  ORDER: 'box', KOMPLAIN: 'alert', AKUN: 'user', TAGIHAN: 'receipt',
};

function waktuLalu(iso: string) {
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  return `${Math.floor(detik / 86400)} hari lalu`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const j = await res.json();
      setItems(j.items ?? []);
      setUnread(j.unread ?? 0);
    } catch {
      /* offline — abaikan, coba lagi di polling berikutnya */
    }
  }

  // Polling sederhana tiap 30 detik (tanpa WebSocket agar tetap ringan).
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // Tutup panel saat klik di luar.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function markAll() {
    await fetch('/api/notifications/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  async function openItem(n: Notif) {
    if (!n.readAt) {
      await fetch('/api/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      });
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        className="relative rounded-lg p-2 text-ink/60 hover:bg-leaf-50 hover:text-leaf-700"
      >
        <Icon name="bell" size={21} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-leaf-100 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-leaf-50 px-3 py-2">
            <span className="text-sm font-semibold">Notifikasi</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-leaf-700 hover:underline">
                Tandai semua terbaca
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink/50">Belum ada notifikasi.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={
                    'flex w-full gap-2 border-b border-leaf-50 px-3 py-2.5 text-left last:border-0 hover:bg-leaf-50 ' +
                    (n.readAt ? '' : 'bg-leaf-50/60')
                  }
                >
                  <span className="pt-0.5 text-ink/45">
                    <Icon name={KIND_ICON[n.kind] ?? 'bell'} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={'text-sm ' + (n.readAt ? 'text-ink/80' : 'font-semibold')}>
                        {n.title}
                      </span>
                      {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-leaf-600" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/60">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-ink/40">{waktuLalu(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
