'use client';

import { userNavItems } from '@/lib/nav-items';
import { SidebarShell } from './sidebar-shell';

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <SidebarShell items={userNavItems} />
    </aside>
  );
}
