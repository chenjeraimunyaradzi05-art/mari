'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { copy } from '@/lib/constants/copy'
import { apiFetch } from '@/lib/api/client'

const ROLES = [
  { id: 'member', label: 'Looking for Work' },
  { id: 'educator', label: 'Teaching/Training' },
  { id: 'provider', label: 'Offering Services' },
  { id: 'founder', label: 'Starting a Business' },
  { id: 'agent', label: 'Real Estate Agent' },
]

export default function OnboardingWizard() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({ role: '', pronouns: '', interests: [] as string[], location: '', bio: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { user } = useAuthStore()

  const update = (field: string, value: any) => setFormData((p) => ({ ...p, [field]: value }))

  const submit = async () => {
    setIsSubmitting(true)
    try {
      const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
      await apiFetch(`${base}/api/onboarding`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user?.id ?? null, ...formData }) })
      router.push('/feed')
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">Tell us about yourself</h1>
      {step === 1 && (
        <div>
          <h2 className="font-medium mb-2">Select your role</h2>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((r) => (
              <button key={r.id} onClick={() => update('role', r.id)} className={`p-3 border rounded ${formData.role === r.id ? 'border-rose-600 bg-rose-50' : ''}`}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setStep(2)} className="px-4 py-2 bg-teal-500 text-white rounded">Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="font-medium mb-2">Pronouns & location</h2>
          <input placeholder="Pronouns" value={formData.pronouns} onChange={(e) => update('pronouns', e.target.value)} className="w-full p-2 border rounded mb-2" />
          <input placeholder="Location" value={formData.location} onChange={(e) => update('location', e.target.value)} className="w-full p-2 border rounded mb-2" />
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 border rounded">Back</button>
            <button onClick={() => setStep(3)} className="px-4 py-2 bg-teal-500 text-white rounded">Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="font-medium mb-2">Interests & Bio</h2>
          <textarea placeholder="Bio" value={formData.bio} onChange={(e) => update('bio', e.target.value)} className="w-full p-2 border rounded mb-2" />
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(2)} className="px-4 py-2 border rounded">Back</button>
            <button onClick={submit} disabled={isSubmitting} className="px-4 py-2 bg-rose-600 text-white rounded">{isSubmitting ? 'Saving…' : 'Finish'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
