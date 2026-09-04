'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function InvoicePayButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function pay() {
    setLoading(true);
    await fetch(`/api/invoices/${invoiceId}/pay`, { method: 'POST' });
    setLoading(false);
    router.refresh();
  }
  return (
    <Button onClick={pay} disabled={loading}>
      {loading ? 'Memproses…' : 'Tandai lunas'}
    </Button>
  );
}
