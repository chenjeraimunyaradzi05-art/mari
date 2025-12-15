import React, { useEffect, useState } from 'react'

type Step = 1 | 2 | 3

type Draft = {
  name?: string
  role?: string
  email?: string
}

const DRAFT_KEY = 'onboarding:draft'

export default function Wizard() {
  const [step, setStep] = useState<Step>(1)
  const [draft, setDraft] = useState<Draft>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) setDraft(JSON.parse(raw))
    } catch (e) {
      /* noop */
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  function update(field: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  function validateStep(s: Step) {
    const nextErrors: Record<string, string> = {}
    if (s === 1) {
      if (!draft.name || draft.name.trim().length < 2) nextErrors.name = 'Name is required'
      if (!draft.role) nextErrors.role = 'Please choose a role'
    }
    if (s === 2) {
      if (!draft.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) nextErrors.email = 'Valid email is required'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function submit() {
    if (!validateStep(2)) return
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      localStorage.removeItem(DRAFT_KEY)
      setStep(3)
    } catch (e) {
      setErrors({ submit: 'Failed to submit. Try again.' })
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Get started</h2>
      <div className="mb-4">
        <div className="h-2 bg-gray-200 rounded">
          <div className="h-2 bg-indigo-600 rounded" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <div>
          <label className="block">
            <div className="text-sm font-medium">Full name</div>
            <input
              className="mt-1 block w-full border rounded px-3 py-2"
              value={draft.name || ''}
              onChange={(e) => update('name', e.target.value)}
            />
            {errors.name && <div className="text-red-500 text-sm mt-1">{errors.name}</div>}
          </label>

          <label className="block mt-4">
            <div className="text-sm font-medium">Role</div>
            <select className="mt-1 block w-full" value={draft.role || ''} onChange={(e) => update('role', e.target.value)}>
              <option value="">Select role</option>
              <option value="member">Member</option>
              <option value="creator">Creator</option>
              <option value="business">Business</option>
            </select>
            {errors.role && <div className="text-red-500 text-sm mt-1">{errors.role}</div>}
          </label>

          <div className="mt-6 flex justify-between">
            <div />
            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded"
              onClick={() => {
                if (validateStep(1)) setStep(2)
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <label className="block">
            <div className="text-sm font-medium">Email</div>
            <input className="mt-1 block w-full border rounded px-3 py-2" value={draft.email || ''} onChange={(e) => update('email', e.target.value)} />
            {errors.email && <div className="text-red-500 text-sm mt-1">{errors.email}</div>}
          </label>

          <div className="mt-6 flex justify-between">
            <button className="px-4 py-2 rounded border" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded" onClick={submit}>
              Complete Onboarding
            </button>
          </div>
          {errors.submit && <div className="text-red-500 mt-3">{errors.submit}</div>}
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-8">
          <h3 className="text-xl font-semibold">Welcome aboard</h3>
          <p className="mt-2 text-sm">Your onboarding is complete.</p>
        </div>
      )}
    </div>
  )
}
