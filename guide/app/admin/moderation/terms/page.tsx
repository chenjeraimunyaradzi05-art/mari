import React from 'react'
import TermForm from '@/components/admin/TermForm'

async function getTerms() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/moderation/terms`, { cache: 'no-store' })
  if (!res.ok) return { terms: [] }
  return res.json()
}

export default async function TermsPage() {
  const data = await getTerms()
  const terms = data.terms || []

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Sensitive Terms</h1>
        <a className="text-sm text-blue-600" href="/admin/moderation/dashboard">Back to dashboard</a>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-3">Add term</h3>
            <TermForm />
          </div>
        </div>

        <div className="col-span-2">
          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-3">Dictionary</h3>
            <div className="overflow-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Term</th>
                    <th className="p-2">Severity</th>
                    <th className="p-2">Active</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((t: any) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">{t.term}</td>
                      <td className="p-2">{t.severity}</td>
                      <td className="p-2">{t.isActive ? 'Yes' : 'No'}</td>
                      <td className="p-2 text-right"><a className="text-blue-600" href={`#edit-${t.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`form-${t.id}`)?.scrollIntoView({ behavior: 'smooth' }) }}>Edit</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-4">
              {terms.map((t: any) => (
                <div key={t.id} id={`form-${t.id}`} className="p-3 border rounded">
                  <h4 className="font-medium mb-2">Edit: {t.term}</h4>
                  <TermForm initial={t} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
