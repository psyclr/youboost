'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  archiveAdminLanding,
  getAdminLanding,
  getAdminLandingAnalytics,
  publishAdminLanding,
  unpublishAdminLanding,
  updateAdminLanding,
} from '@/lib/api/admin-landings';
import { getCatalog } from '@/lib/api/catalog';
import { ApiError } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LandingForm,
  landingToFormValues,
  type LandingFormValues,
} from '@/components/admin/landing-form';
import {
  LandingTiersEditor,
  tiersFromResponse,
  tiersToPayload,
  type TierDraft,
} from '@/components/admin/landing-tiers-editor';
import { LandingAnalyticsPanel } from '@/components/admin/landing-analytics-panel';
import { cn } from '@/lib/utils';
import type {
  CatalogService,
  LandingResponse,
  LandingStatus,
  LandingUpdateInput,
} from '@/lib/api/types';

function statusBadgeClass(status: LandingStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-muted text-muted-foreground hover:bg-muted';
    case 'PUBLISHED':
      return 'bg-accent text-accent-foreground hover:bg-accent';
    case 'ARCHIVED':
      return 'bg-brand-graphite text-white hover:bg-brand-graphite';
  }
}

export default function EditLandingPage({
  params,
}: Readonly<{ params: Promise<{ landingId: string }> }>) {
  const { landingId } = use(params);

  const { data: landing, isLoading } = useQuery({
    queryKey: ['admin', 'landings', landingId],
    queryFn: () => getAdminLanding(landingId),
  });

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['catalog', 'services', 'all'],
    queryFn: () => getCatalog({ limit: 100 }),
  });

  if (isLoading || !landing) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <EditLandingView
      key={`${landing.id}-${landing.updatedAt}`}
      landing={landing}
      services={catalog?.services ?? []}
      servicesLoading={catalogLoading}
    />
  );
}

interface EditLandingViewProps {
  landing: LandingResponse;
  services: CatalogService[];
  servicesLoading: boolean;
}

function EditLandingView({ landing, services, servicesLoading }: Readonly<EditLandingViewProps>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const landingId = landing.id;

  const [tiers, setTiers] = useState<TierDraft[]>(() => tiersFromResponse(landing.tiers));

  const initialFormValues = useMemo<LandingFormValues>(
    () => landingToFormValues(landing),
    [landing],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'landings', landingId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'landings'] });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: LandingUpdateInput) => updateAdminLanding(landingId, payload),
    onSuccess: () => {
      toast.success('Landing saved');
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save landing');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishAdminLanding(landingId),
    onSuccess: () => {
      toast.success('Landing published');
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to publish');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishAdminLanding(landingId),
    onSuccess: () => {
      toast.success('Landing unpublished');
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to unpublish');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveAdminLanding(landingId),
    onSuccess: () => {
      toast.success('Landing archived');
      invalidate();
      router.push('/admin/landings');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to archive');
    },
  });

  const handleContentSubmit = (values: LandingFormValues) => {
    updateMutation.mutate(buildUpdatePayload(values));
  };

  const handleTiersSave = () => {
    if (tiers.length < 1) {
      toast.error('At least one tier required');
      return;
    }
    if (tiers.some((t) => !t.serviceId)) {
      toast.error('Every tier needs a service');
      return;
    }
    updateMutation.mutate({ tiers: tiersToPayload(tiers) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/admin/landings">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Landings
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{landing.slug}</h1>
            <Badge className={cn('font-medium', statusBadgeClass(landing.status))}>
              {landing.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{landing.seoTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/lp/${landing.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Preview
            </Link>
          </Button>
          {landing.status === 'PUBLISHED' ? (
            <Button
              variant="outline"
              onClick={() => unpublishMutation.mutate()}
              disabled={unpublishMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Unpublish
            </Button>
          ) : (
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || landing.status === 'ARCHIVED'}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Publish
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(`Archive landing "${landing.slug}"?`)) {
                archiveMutation.mutate();
              }
            }}
            disabled={archiveMutation.isPending || landing.status === 'ARCHIVED'}
            className="text-destructive border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
          >
            <Archive className="h-4 w-4 mr-1.5" />
            Archive
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="tiers">Tiers ({tiers.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="pt-4">
          <LandingForm
            mode="edit"
            initialValues={initialFormValues}
            services={services}
            servicesLoading={servicesLoading}
            isSubmitting={updateMutation.isPending}
            submitLabel="Save Changes"
            onSubmit={handleContentSubmit}
          />
        </TabsContent>
        <TabsContent value="tiers" className="pt-4 space-y-4">
          <LandingTiersEditor
            value={tiers}
            onChange={setTiers}
            services={services}
            servicesLoading={servicesLoading}
          />
          <div className="flex justify-end">
            <Button onClick={handleTiersSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Tiers'}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="pt-4">
          <AnalyticsTabContent landingId={landingId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnalyticsTabContent({ landingId }: Readonly<{ landingId: string }>) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'landings', landingId, 'analytics'],
    queryFn: () => getAdminLandingAnalytics(landingId),
  });
  return <LandingAnalyticsPanel analytics={data} isLoading={isLoading} />;
}

function buildUpdatePayload(values: LandingFormValues): LandingUpdateInput {
  return {
    slug: values.slug,
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
    seoOgImageUrl: values.seoOgImageUrl?.trim() ? values.seoOgImageUrl.trim() : null,
    heroEyebrow: values.heroEyebrow?.trim() ? values.heroEyebrow.trim() : null,
    heroTitle: values.heroTitle,
    heroAccent: values.heroAccent?.trim() ? values.heroAccent.trim() : null,
    heroLead: values.heroLead,
    heroPlaceholder: values.heroPlaceholder,
    heroCtaLabel: values.heroCtaLabel,
    heroFineprint: values.heroFineprint?.trim() ? values.heroFineprint.trim() : null,
    heroMinAmount: values.heroMinAmount,
    defaultServiceId: values.defaultServiceId?.trim() ? values.defaultServiceId.trim() : null,
    stats: values.stats,
    steps: values.steps,
    faq: values.faq,
    footerCta: values.footerCtaEnabled && values.footerCta ? values.footerCta : null,
  };
}
