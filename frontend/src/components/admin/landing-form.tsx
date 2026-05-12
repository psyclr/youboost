'use client';

import { useFieldArray, useForm, type Control, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { CatalogService, LandingResponse } from '@/lib/api/types';

// Zod schema mirrors backend landingCreateSchema (without tiers — managed separately)
const statItemSchema = z.object({
  value: z.string().min(1, 'required').max(32),
  label: z.string().min(1, 'required').max(48),
});

const stepItemSchema = z.object({
  n: z.number().int().min(1).max(9),
  title: z.string().min(1, 'required').max(60),
  description: z.string().min(1, 'required').max(200),
});

const faqItemSchema = z.object({
  question: z.string().min(1, 'required').max(200),
  answer: z.string().min(1, 'required').max(800),
});

const footerCtaSchema = z.object({
  title: z.string().min(1).max(120),
  lead: z.string().min(1).max(240),
  label: z.string().min(1).max(40),
  href: z.string().min(1).max(255),
});

export const landingFormSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, numbers, hyphens'),
  seoTitle: z.string().min(1).max(160),
  seoDescription: z.string().min(1).max(320),
  seoOgImageUrl: z.string().max(512).optional().or(z.literal('')),
  heroEyebrow: z.string().max(120).optional().or(z.literal('')),
  heroTitle: z.string().min(1).max(160),
  heroAccent: z.string().max(160).optional().or(z.literal('')),
  heroLead: z.string().min(1).max(500),
  heroPlaceholder: z.string().min(1).max(160),
  heroCtaLabel: z.string().min(1).max(32),
  heroFineprint: z.string().max(160).optional().or(z.literal('')),
  heroMinAmount: z.number().nonnegative(),
  defaultServiceId: z.string().optional().or(z.literal('')),
  stats: z.array(statItemSchema).length(4),
  steps: z.array(stepItemSchema).length(3),
  faq: z.array(faqItemSchema).min(1).max(12),
  footerCtaEnabled: z.boolean(),
  footerCta: footerCtaSchema.optional(),
});

export type LandingFormValues = z.infer<typeof landingFormSchema>;

export const defaultLandingFormValues: LandingFormValues = {
  slug: '',
  seoTitle: '',
  seoDescription: '',
  seoOgImageUrl: '',
  heroEyebrow: '',
  heroTitle: '',
  heroAccent: '',
  heroLead: '',
  heroPlaceholder: 'Paste a link',
  heroCtaLabel: 'GO!',
  heroFineprint: '',
  heroMinAmount: 4,
  defaultServiceId: '',
  stats: [
    { value: '', label: '' },
    { value: '', label: '' },
    { value: '', label: '' },
    { value: '', label: '' },
  ],
  steps: [
    { n: 1, title: '', description: '' },
    { n: 2, title: '', description: '' },
    { n: 3, title: '', description: '' },
  ],
  faq: [{ question: '', answer: '' }],
  footerCtaEnabled: false,
  footerCta: { title: '', lead: '', label: '', href: '' },
};

export function landingToFormValues(landing: LandingResponse): LandingFormValues {
  return {
    slug: landing.slug,
    seoTitle: landing.seoTitle,
    seoDescription: landing.seoDescription,
    seoOgImageUrl: landing.seoOgImageUrl ?? '',
    heroEyebrow: landing.hero.eyebrow ?? '',
    heroTitle: landing.hero.title,
    heroAccent: landing.hero.accent ?? '',
    heroLead: landing.hero.lead,
    heroPlaceholder: landing.hero.placeholder,
    heroCtaLabel: landing.hero.ctaLabel,
    heroFineprint: landing.hero.fineprint ?? '',
    heroMinAmount: landing.hero.minAmount,
    defaultServiceId: landing.hero.defaultServiceId ?? '',
    stats: landing.stats.map((s) => ({ value: s.value, label: s.label })),
    steps: landing.steps.map((s) => ({ n: s.n, title: s.title, description: s.description })),
    faq: landing.faq.map((f) => ({ question: f.question, answer: f.answer })),
    footerCtaEnabled: landing.footerCta !== null,
    footerCta: landing.footerCta ?? { title: '', lead: '', label: '', href: '' },
  };
}

interface LandingFormProps {
  mode: 'create' | 'edit';
  initialValues?: LandingFormValues;
  services: CatalogService[];
  servicesLoading?: boolean;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (values: LandingFormValues) => void;
  onCancel?: () => void;
}

const EMPTY_SERVICE_VALUE = '__none__';

export function LandingForm({
  mode,
  initialValues,
  services,
  servicesLoading,
  isSubmitting,
  submitLabel,
  onSubmit,
  onCancel,
}: Readonly<LandingFormProps>) {
  const form = useForm<LandingFormValues>({
    resolver: zodResolver(landingFormSchema),
    defaultValues: initialValues ?? defaultLandingFormValues,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const footerEnabled = watch('footerCtaEnabled');
  const defaultServiceId = watch('defaultServiceId');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Section title="Slug & SEO">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Slug" error={errors.slug?.message} required>
            <Input placeholder="youtube-views" disabled={mode === 'edit'} {...register('slug')} />
          </Field>
          <Field label="Default Service (optional)">
            <Select
              value={defaultServiceId || EMPTY_SERVICE_VALUE}
              onValueChange={(v) =>
                setValue('defaultServiceId', v === EMPTY_SERVICE_VALUE ? '' : v, {
                  shouldDirty: true,
                })
              }
              disabled={servicesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SERVICE_VALUE}>None</SelectItem>
                {services.map((svc) => (
                  <SelectItem key={svc.id} value={svc.id}>
                    {svc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="SEO Title" error={errors.seoTitle?.message} required>
          <Input {...register('seoTitle')} />
        </Field>
        <Field label="SEO Description" error={errors.seoDescription?.message} required>
          <Textarea rows={2} {...register('seoDescription')} />
        </Field>
        <Field label="OG Image URL" error={errors.seoOgImageUrl?.message}>
          <Input placeholder="https://…" {...register('seoOgImageUrl')} />
        </Field>
      </Section>

      <Section title="Hero">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow" error={errors.heroEyebrow?.message}>
            <Input {...register('heroEyebrow')} />
          </Field>
          <Field label="Accent" error={errors.heroAccent?.message}>
            <Input {...register('heroAccent')} />
          </Field>
        </div>
        <Field label="Title" error={errors.heroTitle?.message} required>
          <Input {...register('heroTitle')} />
        </Field>
        <Field label="Lead" error={errors.heroLead?.message} required>
          <Textarea rows={3} {...register('heroLead')} />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Placeholder" error={errors.heroPlaceholder?.message} required>
            <Input {...register('heroPlaceholder')} />
          </Field>
          <Field label="CTA Label" error={errors.heroCtaLabel?.message} required>
            <Input {...register('heroCtaLabel')} />
          </Field>
          <Field label="Min Amount" error={errors.heroMinAmount?.message} required>
            <Input
              type="number"
              step="0.01"
              {...register('heroMinAmount', { valueAsNumber: true })}
            />
          </Field>
        </div>
        <Field label="Fineprint" error={errors.heroFineprint?.message}>
          <Input {...register('heroFineprint')} />
        </Field>
      </Section>

      <Section title="Stats (4 items)">
        <StatsEditor register={register} errors={errors} />
      </Section>

      <Section title="Steps (3 items)">
        <StepsEditor register={register} errors={errors} />
      </Section>

      <Section title="FAQ">
        <FaqEditor control={control} register={register} errors={errors} />
      </Section>

      <Section title="Footer CTA">
        <div className="flex items-center gap-3">
          <Switch
            id="footerCtaEnabled"
            checked={footerEnabled}
            onCheckedChange={(v) => setValue('footerCtaEnabled', v, { shouldDirty: true })}
          />
          <Label htmlFor="footerCtaEnabled">Show Footer CTA</Label>
        </div>
        {footerEnabled && (
          <div className="space-y-4 pt-2">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" error={errors.footerCta?.title?.message} required>
                <Input {...register('footerCta.title')} />
              </Field>
              <Field label="Button Label" error={errors.footerCta?.label?.message} required>
                <Input {...register('footerCta.label')} />
              </Field>
            </div>
            <Field label="Lead" error={errors.footerCta?.lead?.message} required>
              <Textarea rows={2} {...register('footerCta.lead')} />
            </Field>
            <Field label="Href" error={errors.footerCta?.href?.message} required>
              <Input placeholder="/pricing" {...register('footerCta.href')} />
            </Field>
          </div>
        )}
      </Section>

      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: Readonly<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface FormErrorsProp {
  errors: ReturnType<typeof useForm<LandingFormValues>>['formState']['errors'];
}

function StatsEditor({
  register,
  errors,
}: Readonly<{ register: UseFormRegister<LandingFormValues> } & FormErrorsProp>) {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid gap-3 md:grid-cols-2">
          <Field label={`Value ${i + 1}`} error={errors.stats?.[i]?.value?.message} required>
            <Input placeholder="2M+" {...register(`stats.${i}.value` as const)} />
          </Field>
          <Field label={`Label ${i + 1}`} error={errors.stats?.[i]?.label?.message} required>
            <Input placeholder="views delivered" {...register(`stats.${i}.label` as const)} />
          </Field>
        </div>
      ))}
    </div>
  );
}

function StepsEditor({
  register,
  errors,
}: Readonly<{ register: UseFormRegister<LandingFormValues> } & FormErrorsProp>) {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-3 md:grid-cols-[80px_1fr_2fr]">
          <Field label="N" error={errors.steps?.[i]?.n?.message} required>
            <Input
              type="number"
              min={1}
              max={9}
              {...register(`steps.${i}.n` as const, { valueAsNumber: true })}
            />
          </Field>
          <Field label="Title" error={errors.steps?.[i]?.title?.message} required>
            <Input {...register(`steps.${i}.title` as const)} />
          </Field>
          <Field label="Description" error={errors.steps?.[i]?.description?.message} required>
            <Input {...register(`steps.${i}.description` as const)} />
          </Field>
        </div>
      ))}
    </div>
  );
}

function FaqEditor({
  control,
  register,
  errors,
}: Readonly<
  {
    control: Control<LandingFormValues>;
    register: UseFormRegister<LandingFormValues>;
  } & FormErrorsProp
>) {
  const { fields, append, remove } = useFieldArray({ control, name: 'faq' });

  return (
    <div className="space-y-3">
      {fields.map((field, i) => (
        <div key={field.id} className="rounded-md border bg-background p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Question {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              disabled={fields.length <= 1}
              aria-label="Remove FAQ row"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Field label="Question" error={errors.faq?.[i]?.question?.message} required>
            <Input {...register(`faq.${i}.question` as const)} />
          </Field>
          <Field label="Answer" error={errors.faq?.[i]?.answer?.message} required>
            <Textarea rows={3} {...register(`faq.${i}.answer` as const)} />
          </Field>
        </div>
      ))}
      {fields.length < 12 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ question: '', answer: '' })}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add FAQ
        </Button>
      )}
    </div>
  );
}
