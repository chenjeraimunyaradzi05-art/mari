'use client';

/**
 * Editing a listing you already have.
 *
 * `GET /services/:id` is the public read, so it answers for anyone's listing;
 * the page refuses to edit one that is not yours rather than letting the seller
 * fill in a form the PATCH would only reject with a 403.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { apiMessage } from '@/lib/strategy-api';
import { useAuthStore } from '@/lib/hooks';
import { sellerApi } from '@/lib/skills-marketplace-seller';
import { BackToHome, PageShell } from '@/components/layout/PageShell';
import { ServiceForm, toFormValues, type ServiceFormValues } from '../ServiceForm';

export default function EditServicePage() {
  const params = useParams<{ id: string }>();
  const serviceId = params?.id ?? '';
  const { user } = useAuthStore();

  const [values, setValues] = useState<ServiceFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await sellerApi.get(serviceId);
        const service = res.data?.data;

        if (cancelled) return;

        if (user && service.providerId && service.providerId !== user.id) {
          setError('This listing belongs to someone else.');
          return;
        }

        setValues(toFormValues(service));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(apiMessage(err, 'That listing could not be loaded.'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serviceId, user]);

  return (
    <PageShell width="default" showBack={false}>
      <BackToHome href="/skills-marketplace/sell" label="Back to your listings" />

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
          Edit your listing
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Changes show on the marketplace straight away. Work already booked or ordered keeps the
          price it was agreed at.
        </p>
      </header>

      {error ? (
        <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">{error}</p>
      ) : !values ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : (
        <ServiceForm mode="edit" serviceId={serviceId} initialValues={values} />
      )}
    </PageShell>
  );
}
