'use client';
import { signOut } from 'next-auth/react';
import { Button } from './ui/Button';

export function SignOutButton() {
  return (
    <Button variant="ghost" onClick={() => signOut({ callbackUrl: '/' })}>
      Keluar
    </Button>
  );
}
