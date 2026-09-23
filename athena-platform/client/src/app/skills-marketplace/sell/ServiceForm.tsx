'use client';

/**
 * The listing form, shared by /skills-marketplace/sell/new and the edit page.
 *
 * The marketplace sells two different things and a seller may offer either or
 * both: an hourly rate, which buyers book a block of time against, and
 * fixed-scope packages, which buyers order and pay for into escrow. The rate is
 * required because `POST /services` requires it; packages are optional, and a
 * listing without them simply sells by the hour.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { apiMessage } from '@/lib/strategy-api';
import { categoryLabel } from '@/components/skills-marketplace/types';
import {
  SERVICE_CATEGORY_VALUES,
  sellerApi,
  type SellerPackage,
  type SellerServiceCategory,
} from '@/lib/skills-marketplace-seller';

export interface ServiceFormValues {
  title: string;
  description: string;
  category: SellerServiceCategory;
  hourlyRate: string;
  minimumHours: string;
  tags: string;
  isAvailable: boolean;
  packages: PackageDraft[];
}

/** Every number is held as the string the input gives us until submit. */
interface PackageDraft {
  name: string;
  description: string;
  price: string;
  deliveryDays: string;
  revisions: string;
  features: string;
}

export const emptyPackage = (): PackageDraft => ({
  name: '',
  description: '',
  price: '',
  deliveryDays: '',
  revisions: '',
  features: '',
});

export const blankService = (): ServiceFormValues => ({
  title: '',
  description: '',
  category: 'PROFESSIONAL',
  hourlyRate: '',
  minimumHours: '1',
  tags: '',
  isAvailable: true,
  packages: [],
});

/** Turns a saved listing back into the strings the form edits. */
export function toFormValues(service: {
  title: string;
  description: string;
  category: string;
  hourlyRate: number;
  minimumHours: number;
  isAvailable: boolean;
  tags?: string[];
  packages?: unknown;
}): ServiceFormValues {
  const packages = Array.isArray(service.packages) ? service.packages : [];

  return {
    title: service.title,
    description: service.description,
    category: (SERVICE_CATEGORY_VALUES as readonly string[]).includes(service.category)
      ? (service.category as SellerServiceCategory)
      : 'PROFESSIONAL',
    hourlyRate: String(service.hourlyRate ?? ''),
    minimumHours: String(service.minimumHours ?? 1),
    tags: (service.tags ?? []).join(', '),
    isAvailable: service.isAvailable !== false,
    packages: packages.map((raw) => {
      const pkg = (raw ?? {}) as Record<string, unknown>;
      return {
        name: typeof pkg.name === 'string' ? pkg.name : '',
        description: typeof pkg.description === 'string' ? pkg.description : '',
        price: pkg.price === null || pkg.price === undefined ? '' : String(pkg.price),
        deliveryDays:
          pkg.deliveryDays === null || pkg.deliveryDays === undefined ? '' : String(pkg.deliveryDays),
        revisions: pkg.revisions === null || pkg.revisions === undefined ? '' : String(pkg.revisions),
        features: Array.isArray(pkg.features)
          ? pkg.features.filter((f): f is string => typeof f === 'string').join(', ')
          : '',
      };
    }),
  };
}

const splitList = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * The same rules the route enforces, said in advance so a seller is not told
 * about them one at a time by a 400 after she has pressed save.
 */
function validate(values: ServiceFormValues): string | null {
  if (!values.title.trim()) return 'Give your listing a title.';
  if (values.title.length > 200) return 'The title can be up to 200 characters.';
  if (!values.description.trim()) return 'Say what you will actually do for someone.';
  if (values.description.length > 5000) return 'The description can be up to 5000 characters.';

  const rate = Number(values.hourlyRate);
  if (!Number.isInteger(rate) || rate < 1) {
    return 'Set an hourly rate of at least $1, in whole dollars.';
  }

  const minimum = Number(values.minimumHours);
  if (!Number.isFinite(minimum) || minimum < 0.5) {
    return 'The minimum booking has to be at least half an hour.';
  }

  for (const [index, pkg] of values.packages.entries()) {
    const position = `Package ${index + 1}`;
    if (!pkg.name.trim()) return `${position} needs a name.`;
    const price = Number(pkg.price);
    if (!Number.isInteger(price) || price < 1) {
      return `${position} needs a price of at least $1, in whole dollars.`;
    }
    const days = Number(pkg.deliveryDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return `${position} needs a delivery time between 1 and 365 days.`;
    }
    if (pkg.revisions.trim()) {
      const revisions = Number(pkg.revisions);
      if (!Number.isInteger(revisions) || revisions < 0 || revisions > 20) {
        return `${position} needs a whole number of revisions between 0 and 20.`;
      }
    }
  }

  return null;
}

function toPackages(drafts: PackageDraft[]): SellerPackage[] {
  return drafts.map((pkg) => ({
    name: pkg.name.trim(),
    description: pkg.description.trim() || undefined,
    price: Number(pkg.price),
    deliveryDays: Number(pkg.deliveryDays),
    revisions: pkg.revisions.trim() ? Number(pkg.revisions) : undefined,
    features: splitList(pkg.features),
  }));
}

export function ServiceForm({
  mode,
  serviceId,
  initialValues,
}: {
  mode: 'create' | 'edit';
  serviceId?: string;
  initialValues: ServiceFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ServiceFormValues>(initialValues);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const setPackage = (index: number, key: keyof PackageDraft, value: string) =>
    setValues((current) => ({
      ...current,
      packages: current.packages.map((pkg, i) => (i === index ? { ...pkg, [key]: value } : pkg)),
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const complaint = validate(values);
    if (complaint) {
      toast.error(complaint);
      return;
    }

    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category,
      hourlyRate: Number(values.hourlyRate),
      minimumHours: Number(values.minimumHours),
      isAvailable: values.isAvailable,
      tags: splitList(values.tags),
      packages: toPackages(values.packages),
    };

    setSaving(true);
    try {
      if (mode === 'edit' && serviceId) {
        await sellerApi.update(serviceId, payload);
        toast.success('Your listing is updated.');
      } else {
        await sellerApi.create(payload);
        toast.success('Your listing is live.');
      }
      router.push('/skills-marketplace/sell');
      router.refresh();
    } catch (error) {
      toast.error(apiMessage(error, 'That listing could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="surface space-y-4 p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">What you offer</h2>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">Title</span>
          <input
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={200}
            required
            placeholder="Brand photography for small businesses"
            className="input w-full"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
            What she gets
          </span>
          <textarea
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={5000}
            rows={6}
            required
            placeholder="Who this is for, what you will do, and what she ends up with."
            className="input w-full"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">Category</span>
            <select
              value={values.category}
              onChange={(e) => set('category', e.target.value as SellerServiceCategory)}
              className="input w-full"
            >
              {SERVICE_CATEGORY_VALUES.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
              Tags <span className="font-normal text-slate-400">(comma separated)</span>
            </span>
            <input
              value={values.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="branding, headshots, Brisbane"
              className="input w-full"
            />
          </label>
        </div>
      </section>

      <section className="surface space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Your hourly rate</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Buyers book blocks of your time against this. Whole Australian dollars.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
              Rate per hour (A$)
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={values.hourlyRate}
              onChange={(e) => set('hourlyRate', e.target.value)}
              required
              className="input w-full"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
              Shortest booking (hours)
            </span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={values.minimumHours}
              onChange={(e) => set('minimumHours', e.target.value)}
              className="input w-full"
            />
          </label>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={values.isAvailable}
            onChange={(e) => set('isAvailable', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span className="text-slate-700 dark:text-slate-300">
            I am taking work right now.
            <span className="block text-slate-500 dark:text-slate-400">
              Turn this off and the listing stays yours but disappears from the marketplace.
            </span>
          </span>
        </label>
      </section>

      <section className="surface space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Fixed-price packages <span className="font-normal text-slate-400">(optional)</span>
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            A set piece of work for a set price. The money is held by Stripe when she orders and
            released to you when she approves the delivery. Up to five.
          </p>
        </div>

        {values.packages.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No packages yet — this listing sells by the hour.
          </p>
        )}

        <ul className="space-y-4">
          {values.packages.map((pkg, index) => (
            <li key={index} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Package {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      'packages',
                      values.packages.filter((_, i) => i !== index)
                    )
                  }
                  className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1 text-sm text-slate-600 dark:text-slate-300"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">Name</span>
                  <input
                    value={pkg.name}
                    onChange={(e) => setPackage(index, 'name', e.target.value)}
                    maxLength={120}
                    placeholder="Half-day shoot"
                    className="input w-full"
                  />
                </label>

                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                    What it includes
                  </span>
                  <textarea
                    value={pkg.description}
                    onChange={(e) => setPackage(index, 'description', e.target.value)}
                    maxLength={2000}
                    rows={3}
                    className="input w-full"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                    Price (A$)
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={pkg.price}
                    onChange={(e) => setPackage(index, 'price', e.target.value)}
                    className="input w-full"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                    Delivered in (days)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={pkg.deliveryDays}
                    onChange={(e) => setPackage(index, 'deliveryDays', e.target.value)}
                    className="input w-full"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                    Revisions <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={pkg.revisions}
                    onChange={(e) => setPackage(index, 'revisions', e.target.value)}
                    className="input w-full"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                    Highlights <span className="font-normal text-slate-400">(comma separated)</span>
                  </span>
                  <input
                    value={pkg.features}
                    onChange={(e) => setPackage(index, 'features', e.target.value)}
                    placeholder="20 edited images, print licence"
                    className="input w-full"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>

        {values.packages.length < 5 && (
          <button
            type="button"
            onClick={() => set('packages', [...values.packages, emptyPackage()])}
            className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Plus className="h-4 w-4" /> Add a package
          </button>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'edit' ? 'Save changes' : 'Publish my listing'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/skills-marketplace/sell')}
          className="btn-ghost px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
