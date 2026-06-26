'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import {
  getServicePanels,
  addServicePanel,
  updateServicePanel,
  deleteServicePanel,
} from '@/lib/api/admin';
import { getErrorMessage } from '@/lib/api/error-messages';
import { queryKeys } from '@/lib/query-keys';
import { ServicePanelAddForm } from '@/components/admin/service-panel-add-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { AdminServicePanel, AdminServiceResponse } from '@/lib/api/types';

interface ServicePanelsDialogProps {
  service: AdminServiceResponse | null;
  providers: Array<{ providerId: string; name: string }>;
  onClose: () => void;
}

function PanelRow({
  panel,
  onToggle,
  onRemove,
  busy,
}: {
  panel: AdminServicePanel;
  onToggle: (isActive: boolean) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{panel.providerName}</span>
          <Badge variant="outline">Priority {panel.providerPriority}</Badge>
          {!panel.providerActive && <Badge variant="secondary">Provider off</Badge>}
        </div>
        <div className="text-sm text-muted-foreground">Service #{panel.externalServiceId}</div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={panel.isActive}
            onCheckedChange={onToggle}
            disabled={busy}
            aria-label="Toggle panel active"
          />
          <span className="text-muted-foreground">{panel.isActive ? 'Active' : 'Inactive'}</span>
        </label>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={busy}
          aria-label="Remove panel"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export function ServicePanelsDialog({
  service,
  providers,
  onClose,
}: Readonly<ServicePanelsDialogProps>) {
  const queryClient = useQueryClient();
  const serviceId = service?.serviceId ?? '';

  const { data: panels, isLoading } = useQuery({
    queryKey: queryKeys.adminServicePanels(serviceId),
    queryFn: () => getServicePanels(serviceId),
    enabled: !!serviceId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.adminServicePanels(serviceId) });

  const addMutation = useMutation({
    mutationFn: (input: { providerId: string; externalServiceId: string }) =>
      addServicePanel(serviceId, input),
    onSuccess: () => {
      toast.success('Panel attached');
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to attach panel')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateServicePanel(id, { isActive }),
    onSuccess: invalidate,
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update panel')),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteServicePanel(id),
    onSuccess: () => {
      toast.success('Panel removed');
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to remove panel')),
  });

  const busy = toggleMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open={!!service} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Panels — {service?.name}</DialogTitle>
          <DialogDescription>
            Attach multiple providers as failover panels. Orders try each panel in order of its
            priority (set on the Providers page); the next panel is used only if the previous one
            fails.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading panels…</p>
          ) : !panels?.length ? (
            <p className="text-sm text-muted-foreground">No panels attached yet.</p>
          ) : (
            <div className="space-y-2">
              {panels.map((panel) => (
                <PanelRow
                  key={panel.id}
                  panel={panel}
                  busy={busy}
                  onToggle={(isActive) => toggleMutation.mutate({ id: panel.id, isActive })}
                  onRemove={() => removeMutation.mutate(panel.id)}
                />
              ))}
            </div>
          )}

          <ServicePanelAddForm
            providers={providers}
            attachedProviderIds={panels?.map((p) => p.providerId) ?? []}
            isSubmitting={addMutation.isPending}
            onSubmit={(input) => addMutation.mutate(input)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
