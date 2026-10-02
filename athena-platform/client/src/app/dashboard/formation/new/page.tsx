'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateFormation } from '@/lib/hooks';
import { FormationFeeTerms, formationFeeLabel, useFormationFees } from '@/components/business/FormationFeeTerms';

/**
 * The four structures, each with what it is and what the registration costs.
 * The price comes from the server (GET /api/formation/fees, the table the
 * payment step charges from), so a card cannot promise a figure the card form
 * does not ask for. While it has not arrived, or if it cannot be loaded, the card
 * says the fee is shown before payment rather than guessing one.
 */
const STRUCTURES = [
  { type: 'SOLE_TRADER', name: 'Sole Trader', blurb: 'Simplest structure. You trade as an individual.' },
  { type: 'COMPANY', name: 'Company (Pty Ltd)', blurb: 'Separate legal entity. Limited liability protection.' },
  { type: 'PARTNERSHIP', name: 'Partnership', blurb: 'Two or more people running a business together.' },
  { type: 'TRUST', name: 'Trust', blurb: 'Entity holds property/income for others.' },
] as const;

export default function NewFormationPage() {
  const router = useRouter();
  const createFormation = useCreateFormation();
  const fees = useFormationFees();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    type: '',
    businessName: '',
  });

  const handleTypeSelect = (type: string) => {
    setFormData({ ...formData, type });
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await createFormation.mutateAsync({
      type: formData.type,
      businessName: formData.businessName,
    });

    router.push(`/dashboard/formation/${response.data.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold">Register a New Business</h1>
        <p className="text-muted-foreground">Step {step} of 2</p>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Select Business Structure</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {STRUCTURES.map((structure) => {
              const price = formationFeeLabel(fees.data, structure.type);
              return (
                <button
                  key={structure.type}
                  onClick={() => handleTypeSelect(structure.type)}
                  className="min-h-[44px] p-6 border rounded-lg text-left hover:border-primary hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <h3 className="font-bold">{structure.name}</h3>
                  <p className="text-sm text-slate-500 mt-2">{structure.blurb}</p>
                  <p className="mt-3 text-sm font-semibold">
                    {price ? `Fee: ${price}` : 'The fee is shown before you pay.'}
                  </p>
                </button>
              );
            })}
          </div>
          <FormationFeeTerms />
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-xl font-semibold">Choose a Business Name</h2>
          {formationFeeLabel(fees.data, formData.type) && (
            <p className="text-sm text-slate-600">
              The fee for this structure is {formationFeeLabel(fees.data, formData.type)}. You pay it after you have filled in your details, when you submit them, not before.
            </p>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Business Name</label>
            <input
              type="text"
              required
              className="w-full p-2 border rounded-md"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              placeholder="e.g. Athena Consulting"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 border rounded-md hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createFormation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {createFormation.isPending ? 'Creating...' : 'Continue'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
