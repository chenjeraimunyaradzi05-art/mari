'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Building2, MapPin, Clock, DollarSign, Briefcase } from 'lucide-react';
import { Job } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';

interface JobCardProps {
  job: Job;
}

export default function JobCard({ job }: JobCardProps) {
  const isNew = job.publishedAt 
    ? new Date(job.publishedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 
    : false;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <Avatar
              src={job.organization?.logo || null}
              alt={job.organization?.name || 'Organization'}
              fallback={job.organization?.name?.substring(0, 2).toUpperCase() || 'ORG'}
              size="lg"
              className="rounded-lg border"
            />
            <div>
              <h3 className="font-semibold text-lg leading-none mb-1">
                <Link href={`/jobs/${job.id}`} className="hover:text-primary transition-colors">
                  {job.title}
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {job.organization?.name || 'Confidential'}
              </p>
            </div>
          </div>
          {isNew && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
              New
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {job.isRemote ? 'Remote' : `${job.city}, ${job.state}`}
          </div>
          <div className="flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5" />
            {job.type.replace('_', ' ')}
          </div>
          {job.salaryMin && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {job.salaryMin.toLocaleString()} - {job.salaryMax?.toLocaleString()}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {job.publishedAt ? formatDistanceToNow(new Date(job.publishedAt), { addSuffix: true }) : 'Just now'}
          </div>
        </div>
        
        {/* Skills Chips would go here if available in list view */}
      </CardContent>
    </Card>
  );
}
