<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Events\LeadSubmitted;
use App\Http\Requests\Frontend\StoreOrganizationLeadRequest;
use App\Models\Lead;
use App\Models\OrganizationPage;
use App\Services\LeadQualificationService;
use App\Services\Compliance\AuditTrailLogger;
use App\Services\Compliance\ConsentLogger;
use Illuminate\Http\RedirectResponse;

final class OrganizationLeadController extends Controller
{
	public function __construct(
		private LeadQualificationService $qualificationService,
		private ConsentLogger $consentLogger,
		private AuditTrailLogger $auditLogger,
	)
	{
	}

    public function store(string $slug, StoreOrganizationLeadRequest $request): RedirectResponse
    {
		$page = OrganizationPage::published()->where('slug', $slug)->firstOrFail();

		$lead = Lead::create($request->toLeadPayload($page->id));

		$this->qualificationService->evaluate($lead);

		$lead->refresh();
		event(new LeadSubmitted($lead, $page));

		$this->consentLogger->log(
			surface: 'organization_lead_form',
			action: 'lead_submit',
			payload: [
				'organization_page_id' => $page->getKey(),
				'consent' => true,
			],
			subject: $lead,
			user: $request->user(),
			actorName: $request->input('name'),
			actorEmail: $request->input('email'),
		);

		$this->auditLogger->log(
			$lead,
			'lead_submitted',
			[
				'organization_page_id' => $page->getKey(),
				'lead_type' => $lead->type,
			],
			$request->user(),
		);

        return redirect()
			->route('organizations.show', ['slug' => $page->slug, 'intent' => $lead->type])
            ->with('status', 'Thanks! We have sent your details to '.$page->name.'.');
    }
}

