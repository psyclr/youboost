'use client';

import { AuthGuard } from '@/lib/auth/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGuard>
      <div className="min-h-screen">
        <Sidebar />
        <div className="md:pl-64">
          <Header />
          <main className="p-4 md:p-6 max-w-7xl mx-auto">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
