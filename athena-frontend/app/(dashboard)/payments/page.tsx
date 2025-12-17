export default function PaymentsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Subscriptions</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded p-4">
          <h3 className="font-semibold">Starter</h3>
          <div className="text-2xl mt-2">AU$2.99/mo</div>
          <p className="text-sm text-gray-600 mt-2">Basic benefits</p>
          <div className="mt-4"><button className="px-3 py-1 bg-rose-600 text-white rounded">Select</button></div>
        </div>
        <div className="border rounded p-4">
          <h3 className="font-semibold">Pro</h3>
          <div className="text-2xl mt-2">AU$9.99/mo</div>
          <p className="text-sm text-gray-600 mt-2">Creator tools & analytics</p>
          <div className="mt-4"><button className="px-3 py-1 bg-teal-500 text-white rounded">Select</button></div>
        </div>
        <div className="border rounded p-4">
          <h3 className="font-semibold">Premium</h3>
          <div className="text-2xl mt-2">AU$24.99/mo</div>
          <p className="text-sm text-gray-600 mt-2">Priority support & marketplace perks</p>
          <div className="mt-4"><button className="px-3 py-1 bg-midnight-900 text-white rounded">Select</button></div>
        </div>
      </div>
        <div className="mt-6">
      <p className="text-sm text-gray-600 mb-2">Dev checkout (mock):</p>
      <div className="flex gap-2">
        <button onClick={async () => {
          const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
          const res = await (await import('@/lib/api/client')).apiFetch(`${base}/api/stripe/create-session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'starter', user_id: 1 }) })
          const json = await res.json()
          if (json?.url) window.location.href = json.url
        }} className="px-4 py-2 bg-teal-500 text-white rounded">Checkout Starter</button>
        <button onClick={async () => {
          const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
          const res = await (await import('@/lib/api/client')).apiFetch(`${base}/api/stripe/create-session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'pro', user_id: 1 }) })
          const json = await res.json()
          if (json?.url) window.location.href = json.url
        }} className="px-4 py-2 bg-rose-600 text-white rounded">Checkout Pro</button>
      </div>
    </div>
    </div>
  )
}
