'use client';
import { signOut } from 'next-auth/react';
import { Button } from './ui/Button';

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      className="px-2 py-1.5 text-sm"
      onClick={() => signOut({ callbackUrl: '/' })}
    >
      Keluar
    </Button>
  );
}
