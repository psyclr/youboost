'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { createAdminLanding } from '@/lib/api/admin-landings';
import { getCatalog } from '@/lib/api/catalog';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
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
import type { LandingCreateInput } from '@/lib/api/types';

export default function NewLandingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tiers, setTiers] = useState<TierDraft[]>([]);
  const [pendingContent, setPendingContent] = useState<LandingFormValues | null>(null);

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['catalog', 'services', 'all'],
    queryFn: () => getCatalog({ limit: 100 }),
  });

  const services = catalog?.services ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: LandingCreateInput) => createAdminLanding(payload),
    onSuccess: (landing) => {
      toast.success('Landing created');
      queryClient.invalidateQueries({ queryKey: ['admin', 'landings'] });
      router.push(`/admin/landings/${landing.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create landing');
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
            servicesLoading={catalogLoading}
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
            servicesLoading={catalogLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
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
