'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Cat = { id: string; name: string };

export function SearchFilter({
  categories, initialQ, initialCat,
}: { categories: Cat[]; initialQ: string; initialCat: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState(initialCat);

  function apply(nextQ: string, nextCat: string) {
    const p = new URLSearchParams();
    if (nextQ.trim()) p.set('q', nextQ.trim());
    if (nextCat) p.set('kategori', nextCat);
    router.push('/app/konsumen' + (p.toString() ? `?${p}` : ''));
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); apply(q, cat); }}
      className="mb-4 flex flex-col gap-2 sm:flex-row"
    >
      <Input
        placeholder="Cari produk… (mis. bayam, bandeng)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="flex-1"
      />
      <Select
        value={cat}
        onChange={(e) => { setCat(e.target.value); apply(q, e.target.value); }}
        className="sm:w-48"
      >
        <option value="">Semua kategori</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Button type="submit" className="sm:w-28">Cari</Button>
      {(initialQ || initialCat) && (
        <Button type="button" variant="ghost" onClick={() => { setQ(''); setCat(''); apply('', ''); }}>
          Reset
        </Button>
      )}
    </form>
  );
}
