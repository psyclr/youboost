'use client';

import { AdminGuard } from '@/lib/auth/admin-guard';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { Header } from '@/components/layout/header';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminGuard>
      <div className="min-h-screen">
        <AdminSidebar />
        <div className="md:pl-64">
          <Header />
          <main className="p-4 md:p-6 max-w-7xl mx-auto">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
