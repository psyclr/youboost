import type { Metadata } from 'next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AdminGuide } from '@/content/admin-docs';

export const metadata: Metadata = {
  title: 'Documentation — YouBoost Admin',
  description: 'Руководство по управлению платформой YouBoost: поставщики, каталог, заказы, мониторинг.',
};

export default function AdminDocsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-muted-foreground">Руководство по управлению платформой YouBoost</p>
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="pr-4">
          <AdminGuide />
        </div>
      </ScrollArea>
    </div>
  );
}
