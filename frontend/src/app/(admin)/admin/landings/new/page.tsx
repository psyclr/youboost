'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { createAdminLanding } from '@/lib/api/admin-landings';
import { useAllServices } from '@/hooks/use-catalog';
import { getErrorMessage } from '@/lib/api/error-messages';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LandingForm,
  defaultLandingFormValues,
  type LandingFormValues,
} from '@/components/admin/landing-form';
import {
  LandingTiersEditor,
  tiersToPayload,
  type TierDraft,
} from '@/components/admin/landing-tiers-editor';
import type { CatalogService, LandingCreateInput } from '@/lib/api/types';

function buildDefaultTiers(services: Array<{ id: string }>): TierDraft[] {
  return services.slice(0, 4).map((svc, index) => ({
    serviceId: svc.id,
    order: index,
    pillKind: index === 0 ? 'SALE' : index === 2 ? 'PREMIUM' : null,
    glowKind: index === 0 ? 'ORANGE' : index === 1 ? 'COSMIC' : index === 2 ? 'PURPLE' : null,
    titleOverride: '',
    descOverride: '',
    priceOverride: '',
    unit: '1k',
  }));
}

export default function NewLandingPage() {
  const router = useRouter();

  // Wait for the catalog before mounting the editor so the tiers state can be
  // seeded once from a useState initializer (no set-state-in-effect needed).
  const { data: catalog, isLoading: catalogLoading } = useAllServices();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/landings">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">New Landing</h1>
      </div>

      {catalogLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <NewLandingEditor
          router={router}
          services={catalog?.services ?? []}
          servicesLoading={catalogLoading}
        />
      )}
    </div>
  );
}

interface NewLandingEditorProps {
  router: ReturnType<typeof useRouter>;
  services: CatalogService[];
  servicesLoading: boolean;
}

function NewLandingEditor({ router, services, servicesLoading }: Readonly<NewLandingEditorProps>) {
  const queryClient = useQueryClient();
  // Seeded once from the (already loaded) services; user edits are never
  // clobbered because nothing rewrites this from an effect afterwards.
  const [tiers, setTiers] = useState<TierDraft[]>(() => buildDefaultTiers(services));
  const [pendingContent, setPendingContent] = useState<LandingFormValues | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: LandingCreateInput) => createAdminLanding(payload),
    onSuccess: (landing) => {
      toast.success('Landing created');
      queryClient.invalidateQueries({ queryKey: queryKeys.adminLandings.all });
      router.push(`/admin/landings/${landing.id}`);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to create landing'));
    },
  });

  const handleSubmit = (values: LandingFormValues) => {
    if (tiers.length < 1) {
      toast.error('Add at least one tier before saving');
      setPendingContent(values);
      return;
    }
    const missingService = tiers.some((t) => !t.serviceId);
    if (missingService) {
      toast.error('Every tier needs a service');
      return;
    }
    const payload = buildPayload(values, tiers);
    createMutation.mutate(payload);
  };

  return (
    <Tabs defaultValue="content">
      <TabsList>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="tiers">Tiers ({tiers.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="content" className="pt-4">
        <LandingForm
          mode="create"
          initialValues={pendingContent ?? defaultLandingFormValues}
          services={services}
          servicesLoading={servicesLoading}
          isSubmitting={createMutation.isPending}
          submitLabel="Create Draft"
          onSubmit={handleSubmit}
          onCancel={() => router.push('/admin/landings')}
        />
      </TabsContent>
      <TabsContent value="tiers" className="pt-4">
        <LandingTiersEditor
          value={tiers}
          onChange={setTiers}
          services={services}
          servicesLoading={servicesLoading}
        />
      </TabsContent>
    </Tabs>
  );
}

function buildPayload(values: LandingFormValues, tiers: TierDraft[]): LandingCreateInput {
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
    tiers: tiersToPayload(tiers),
  };
}
