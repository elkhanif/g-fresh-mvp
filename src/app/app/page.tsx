import { redirect } from 'next/navigation';
import { requireUser, HOME_BY_ROLE } from '@/lib/rbac';

export default async function AppIndex() {
  const user = await requireUser();
  redirect(HOME_BY_ROLE[user.role]);
}
