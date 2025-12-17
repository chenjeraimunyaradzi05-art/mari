"use client"

import { useEffect, useState } from 'react'
import JobCard from '@/components/cards/JobCard'
import { fetchJobs } from '@/lib/api/jobs'

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchJobs().then((j) => { if (mounted) setJobs(j.jobs || []) }).catch(() => {}).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Job Listings</h1>
      {loading && <p className="text-gray-600">Loading…</p>}
      <div className="grid grid-cols-2 gap-4">
        {jobs.map((job) => <JobCard key={job.id} title={job.title} company={job.company || 'Employer'} location={job.location} />)}
      </div>
    </div>
  )
}
