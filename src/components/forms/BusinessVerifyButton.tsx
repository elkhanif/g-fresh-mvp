'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function BusinessVerifyButton({ businessId, verified }: { businessId: string; verified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    await fetch('/api/business/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, verified: !verified }),
    });
    setLoading(false);
    router.refresh();
  }
  return (
    <Button variant={verified ? 'outline' : 'primary'} onClick={toggle} disabled={loading}>
      {loading ? '…' : verified ? 'Cabut verifikasi' : 'Verifikasi B2B'}
    </Button>
  );
}
