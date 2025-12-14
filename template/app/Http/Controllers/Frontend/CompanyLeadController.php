<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Lead\StoreLeadNoteRequest;
use App\Http\Requests\Lead\UpdateLeadNoteRequest;
use App\Http\Requests\Lead\UpdateLeadStatusRequest;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Services\LeadQualificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

final class CompanyLeadController extends Controller
{
	public function __construct(private LeadQualificationService $qualificationService)
	{
	}

	public function index(Request $request): View
	{
		$user = Auth::user();
		$company = $user?->company;

		abort_if(!$company, Response::HTTP_FORBIDDEN);

		$availableStatuses = [
			'new' => 'New',
			'contacted' => 'Contacted',
			'qualified' => 'Qualified',
			'nurturing' => 'Nurturing',
			'disqualified' => 'Disqualified',
		];

		$availablePriorities = [
			'urgent' => 'Urgent',
			'high' => 'High',
			'standard' => 'Standard',
			'low' => 'Low',
		];

		$availableTypes = [
			'job' => 'Job',
			'apprenticeship' => 'Apprenticeship',
			'course' => 'Course',
			'general' => 'General',
		];

		$availableWindows = [
			'7d' => 'Last 7 days',
			'30d' => 'Last 30 days',
			'90d' => 'Last 90 days',
			'all' => 'All time',
		];

		$filters = [
			'status' => $request->filled('status') ? (string) $request->input('status') : null,
			'priority' => $request->filled('priority') ? (string) $request->input('priority') : null,
			'type' => $request->filled('type') ? (string) $request->input('type') : null,
			'search' => $request->filled('search') ? trim((string) $request->input('search')) : null,
			'window' => $request->filled('window') ? (string) $request->input('window') : '30d',
		];

		$query = Lead::query()
			->with(['page', 'assignedUser'])
			->forCompany($company->id);

		if ($filters['status'] && array_key_exists($filters['status'], $availableStatuses)) {
			$query->where('status', $filters['status']);
		}

		if ($filters['priority'] && array_key_exists($filters['priority'], $availablePriorities)) {
			$query->where('qualification_priority', $filters['priority']);
		}

		if ($filters['type'] && array_key_exists($filters['type'], $availableTypes)) {
			$query->where('type', $filters['type']);
		}

		if ($filters['search']) {
			$term = $filters['search'];
			$query->where(function ($builder) use ($term) {
				$builder->where('contact_name', 'like', '%'.$term.'%')
					->orWhere('contact_email', 'like', '%'.$term.'%')
					->orWhere('contact_phone', 'like', '%'.$term.'%');
			});
		}

		switch ($filters['window']) {
			case '7d':
				$query->where('submitted_at', '>=', now()->subDays(7));
				break;
			case '30d':
				$query->where('submitted_at', '>=', now()->subDays(30));
				break;
			case '90d':
				$query->where('submitted_at', '>=', now()->subDays(90));
				break;
			case 'all':
			default:
				break;
		}

		$query->orderByDesc('submitted_at')->orderByDesc('created_at');

		$leads = $query->paginate(15)->withQueryString();

		$baseQuery = Lead::query()->forCompany($company->id);
		$insights = [
			'total' => (clone $baseQuery)->count(),
			'new_this_week' => (clone $baseQuery)->where('submitted_at', '>=', now()->subDays(7))->count(),
			'avg_score' => round((float) ((clone $baseQuery)->whereNotNull('qualification_score')->avg('qualification_score') ?? 0), 1),
			'high_priority' => (clone $baseQuery)->whereIn('qualification_priority', ['urgent', 'high'])->count(),
		];

		return view('frontend.company-dashboard.leads.index', [
			'leads' => $leads,
			'filters' => $filters,
			'insights' => $insights,
			'availableStatuses' => $availableStatuses,
			'availablePriorities' => $availablePriorities,
			'availableTypes' => $availableTypes,
			'availableWindows' => $availableWindows,
		]);
	}

	public function show(Request $request, Lead $lead): View
	{
		$companyId = $this->ensureLeadBelongsToCompany($lead);
		$lead->loadMissing([
			'page',
			'assignedUser',
			'notes.author',
		]);

		$editingNoteId = $request->filled('edit_note') ? (int) $request->query('edit_note') : null;

		$recentLeads = Lead::query()
			->forCompany($companyId)
			->where('id', '!=', $lead->id)
			->orderByDesc('submitted_at')
			->orderByDesc('created_at')
			->take(4)
			->get(['id', 'contact_name', 'submitted_at', 'qualification_priority', 'qualification_score']);

		$statusOptions = [
			'new' => 'New',
			'contacted' => 'Contacted',
			'qualified' => 'Qualified',
			'nurturing' => 'Nurturing',
			'disqualified' => 'Disqualified',
		];

		$priorityLabels = [
			'urgent' => 'Urgent',
			'high' => 'High',
			'standard' => 'Standard',
			'low' => 'Low',
		];

		return view('frontend.company-dashboard.leads.show', [
			'lead' => $lead,
			'recentLeads' => $recentLeads,
			'statusOptions' => $statusOptions,
			'priorityLabels' => $priorityLabels,
			'noteCount' => $lead->notes->count(),
			'editingNoteId' => $editingNoteId,
		]);
	}

	public function storeNote(StoreLeadNoteRequest $request, Lead $lead): RedirectResponse
	{
		$this->ensureLeadBelongsToCompany($lead);
		$lead->notes()->create([
			'user_id' => Auth::id(),
			'body' => $request->validated('body'),
		]);

		return redirect()
			->route('company.leads.show', $lead)
			->with('status', 'Note added to the lead record.');
	}

	public function updateNote(UpdateLeadNoteRequest $request, Lead $lead, LeadNote $note): RedirectResponse
	{
		$this->ensureLeadBelongsToCompany($lead);
		$note = $this->resolveLeadNote($lead, $note);
		$this->ensureNoteIsManageableByCurrentUser($note);

		$note->update([
			'body' => $request->validated('body'),
		]);

		return redirect()
			->route('company.leads.show', $lead)
			->with('status', 'Note updated successfully.');
	}

	public function destroyNote(Lead $lead, LeadNote $note): RedirectResponse
	{
		$this->ensureLeadBelongsToCompany($lead);
		$note = $this->resolveLeadNote($lead, $note);
		$this->ensureNoteIsManageableByCurrentUser($note);

		$note->delete();

		return redirect()
			->route('company.leads.show', $lead)
			->with('status', 'Note removed.');
	}

	public function update(UpdateLeadStatusRequest $request, Lead $lead): RedirectResponse
	{
		$this->ensureLeadBelongsToCompany($lead);
		$lead->loadMissing('page');

		$data = $request->validated();

		$previousStatus = $lead->status;
		$statusChanged = array_key_exists('status', $data) && $lead->status !== $data['status'];
		$lead->status = $data['status'];

		if ($request->boolean('assign_to_me')) {
			$lead->assigned_to = Auth::id();
		} elseif ($request->boolean('clear_assignment')) {
			$lead->assigned_to = null;
		}

		$lead->save();

		if ($statusChanged) {
			$lead->notes()->create([
				'user_id' => Auth::id(),
				'body' => sprintf(
					'Status changed from %s to %s.',
					Str::headline($previousStatus ?? 'unknown'),
					Str::headline($lead->status)
				),
				'is_system' => true,
				'metadata' => [
					'type' => 'status_changed',
					'from' => $previousStatus,
					'to' => $lead->status,
				],
			]);
		}

		if ($statusChanged || $request->boolean('requalify')) {
			$this->qualificationService->evaluate($lead->fresh());
			$lead->refresh();
		}

		return redirect()
			->route('company.leads.show', $lead)
			->with('status', 'Lead updated. Score '.$lead->qualification_score.' ('.$lead->qualification_grade.')');
	}

	private function ensureLeadBelongsToCompany(Lead $lead): int
	{
		$user = Auth::user();
		$companyId = $user?->company?->id;

		abort_if(!$companyId, Response::HTTP_FORBIDDEN);

		$lead->loadMissing('page');

		if ((int) optional($lead->page)->company_id !== (int) $companyId) {
			abort(Response::HTTP_FORBIDDEN);
		}

		return (int) $companyId;
	}

	private function resolveLeadNote(Lead $lead, LeadNote $note): LeadNote
	{
		abort_if((int) $note->lead_id !== (int) $lead->id, Response::HTTP_NOT_FOUND);

		return $note;
	}

	private function ensureNoteIsManageableByCurrentUser(LeadNote $note): void
	{
		abort_if($note->is_system, Response::HTTP_FORBIDDEN);
		abort_if($note->user_id !== Auth::id(), Response::HTTP_FORBIDDEN);
	}
}

