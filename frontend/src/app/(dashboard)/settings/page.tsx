'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Your account information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-medium">{user?.username}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge variant="outline">{user?.role}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email Verified</p>
              <Badge variant={user?.emailVerified ? 'default' : 'secondary'}>
                {user?.emailVerified ? 'Verified' : 'Not Verified'}
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm text-muted-foreground">Member Since</p>
            <p className="font-medium">{user?.createdAt ? formatDate(user.createdAt) : '—'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
