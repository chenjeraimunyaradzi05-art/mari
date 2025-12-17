"use client"

import { useEffect, useState } from 'react'
import PropertyCard from '@/components/cards/PropertyCard'
import MortgageCalculator from '@/components/widgets/MortgageCalculator'
import { fetchProperties } from '@/lib/api/housing'

export default function HousingPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchProperties().then((j) => { if (mounted) setProperties(j.properties || []) }).catch(() => {}).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h1 className="text-2xl font-semibold mb-4">Housing Marketplace</h1>
          {loading && <p className="text-gray-600">Loading…</p>}
          <div className="grid grid-cols-2 gap-4">
            {properties.map((p) => <PropertyCard key={p.id} title={p.title} price={p.price} />)}
          </div>
        </div>
        <aside className="col-span-1">
          <MortgageCalculator />
        </aside>
      </div>
    </div>
  )
}
