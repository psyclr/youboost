import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="flex items-center gap-2 mb-8">
        <Zap className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">youboost</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
