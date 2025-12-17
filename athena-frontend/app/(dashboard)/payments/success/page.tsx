import { useSearchParams } from 'next/navigation'

export default function SuccessPage() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  return (
    <div className="min-h-screen flex items-center justify-center bg-blush-50">
      <div className="bg-white p-8 rounded shadow max-w-lg text-center">
        <h1 className="text-2xl font-semibold mb-2">Payment Successful</h1>
        <p className="text-gray-600 mb-4">Session <strong>{sessionId}</strong> completed (dev mock).</p>
        <p className="text-sm text-gray-500">A webhook will be sent to the backend to finalize the subscription.</p>
      </div>
    </div>
  )
}
