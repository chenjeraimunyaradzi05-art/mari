export default function AICoach() {
  const ask = async () => {
    const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
    const res = await (await import('@/lib/api/client')).apiFetch(`${base}/api/ai/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'Help me with my resume' }) })
    const json = await res.json()
    alert(json.reply || json.error)
  }

  return (
    <div className="border rounded p-4 bg-white">
      <h3 className="font-semibold mb-2">AI Coach (stub)</h3>
      <p className="text-sm text-gray-600 mb-4">Ask the AiCoach for quick tips on career, applications, and taxes.</p>
      <button onClick={ask} className="px-3 py-2 bg-teal-500 text-white rounded">Ask AiCoach</button>
    </div>
  )
}
