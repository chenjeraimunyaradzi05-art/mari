<?php

declare(strict_types=1);

namespace App\Listeners\WomenRealEstate;

use App\Events\WomenRealEstate\WomenListingPublished;
use App\Jobs\WomenRealEstate\GenerateListingSocialShareJob;

final class ScheduleListingSocialAmplification
{
	public function handle(WomenListingPublished $event): void
	{
		// Schedule a job to generate and amplify social shares for the
		// newly published listing. The job will be dispatched to the default queue.
		GenerateListingSocialShareJob::dispatch($event->listing->id);
	}
}

