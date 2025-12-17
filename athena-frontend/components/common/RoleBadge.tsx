export function RoleBadge({ role }: { role?: string }) {
  if (!role) return null
  return (
    <span className="inline-block px-2 py-1 text-xs rounded bg-rose-50 text-rose-600 border border-rose-100">{role}</span>
  )
}
