'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateFormation } from '@/lib/hooks';

export default function NewFormationPage() {
  const router = useRouter();
  const createFormation = useCreateFormation();
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
            <button
              onClick={() => handleTypeSelect('SOLE_TRADER')}
              className="p-6 border rounded-lg text-left hover:border-primary hover:bg-slate-50 transition-colors"
            >
              <h3 className="font-bold">Sole Trader</h3>
              <p className="text-sm text-gray-500 mt-2">Simplest structure. You trade as an individual.</p>
            </button>
            <button
              onClick={() => handleTypeSelect('COMPANY')}
              className="p-6 border rounded-lg text-left hover:border-primary hover:bg-slate-50 transition-colors"
            >
              <h3 className="font-bold">Company (Pty Ltd)</h3>
              <p className="text-sm text-gray-500 mt-2">Separate legal entity. Limited liability protection.</p>
            </button>
            <button
              onClick={() => handleTypeSelect('PARTNERSHIP')}
              className="p-6 border rounded-lg text-left hover:border-primary hover:bg-slate-50 transition-colors"
            >
              <h3 className="font-bold">Partnership</h3>
              <p className="text-sm text-gray-500 mt-2">Two or more people running a business together.</p>
            </button>
            <button
              onClick={() => handleTypeSelect('TRUST')}
              className="p-6 border rounded-lg text-left hover:border-primary hover:bg-slate-50 transition-colors"
            >
              <h3 className="font-bold">Trust</h3>
              <p className="text-sm text-gray-500 mt-2">Entity holds property/income for others.</p>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-xl font-semibold">Choose a Business Name</h2>
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
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
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
