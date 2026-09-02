import type { Role } from '@prisma/client';
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
    };
  }
  interface User {
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: string;
    role: Role;
  }
}
