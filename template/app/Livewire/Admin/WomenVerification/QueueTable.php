<?php

declare(strict_types=1);

namespace App\Livewire\Admin\WomenVerification;

use App\Enums\WomenRealEstate\VerificationStage;
use App\Models\Admin;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Services\WomenRealEstate\WomenVerificationService;
use App\Support\Livewire\FallbackComponent;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Livewire\WithPagination;

trait QueueTableBehavior
{
    use WithPagination;

    public string $statusFilter = 'pending';

    public string $stageFilter = '';

    public string $search = '';

    public int $perPage = 15;

    public ?int $selectedAgentId = null;

    public string $notes = '';

    public array $assessment = [];

    public ?string $flashMessage = null;

    public ?string $flashType = null;

    protected string $paginationTheme = 'bootstrap';

    protected WomenVerificationService $service;

    protected $queryString = [
        'statusFilter' => ['as' => 'status'],
        'stageFilter' => ['as' => 'stage'],
        'search' => ['as' => 'q'],
    ];

    public function boot(WomenVerificationService $service): void
    {
        $this->service = $service;

        if (! Gate::allows('womenRealEstate.reviewVerification')) {
            throw new AuthorizationException('You are not authorized to review WomenRise verifications.');
        }
    }

    public function updatingStatusFilter(): void
    {
        $this->resetPage();
    }

    public function updatingStageFilter(): void
    {
        $this->resetPage();
    }

    public function updatingSearch(): void
    {
        $this->resetPage();
    }

    public function resetFilters(): void
    {
        $this->statusFilter = 'pending';
        $this->stageFilter = '';
        $this->search = '';
        $this->resetPage();
    }

    public function selectAgent(int $agentId): void
    {
        $agent = $this->ensureAgent($agentId);

        $this->selectedAgentId = $agent->id;
        $this->assessment = $this->service->assessApplication($agent);
        $this->notes = '';
        $this->flashMessage = null;
        $this->flashType = null;
    }

    public function clearSelection(): void
    {
        $this->selectedAgentId = null;
        $this->assessment = [];
        $this->notes = '';
    }

    public function dismissFlash(): void
    {
        $this->flashMessage = null;
        $this->flashType = null;
    }

    public function submitAction(string $action): void
    {
        $agent = $this->ensureAgent($this->selectedAgentId);
        $admin = $this->currentAdmin();

        if (in_array($action, ['request-info', 'reject', 'escalate'], true) && trim($this->notes) === '') {
            throw ValidationException::withMessages([
                'notes' => 'Please add a note before requesting more information, escalating, or rejecting.',
            ]);
        }

        $notes = $this->formatNotes($admin);

        switch ($action) {
            case 'approve':
                $this->service->recordDecision($agent, 'verified', null, $notes, null, 'admin_queue');
                break;
            case 'request-info':
                $this->service->recordDecision($agent, 'pending_information', null, $notes, null, 'admin_queue');
                break;
            case 'reject':
                $this->service->recordDecision($agent, 'rejected', null, $notes, null, 'admin_queue');
                break;
            case 'schedule-reverify':
                $this->service->scheduleReverification($agent);
                break;
            case 'escalate':
                $this->service->escalateToCompliance($agent, $notes, null, null, 'admin_queue');
                break;
            default:
                throw ValidationException::withMessages([
                    'action' => 'Unknown verification action.',
                ]);
        }

        $agent->refresh();
        $agent->load('user');
        $this->assessment = $this->service->assessApplication($agent);

        $flash = $this->flashConfigForAction($action);
        $timelineNote = $this->buildTimelineNote($agent);

        if ($timelineNote !== null) {
            $flash['message'] .= ' '.$timelineNote;
        }

        $this->flashType = $flash['type'];
        $this->flashMessage = $flash['message'];

        $this->resetPage();
    }

    public function getStatusOptionsProperty(): array
    {
        return [
            'pending' => 'Pending',
            'pending_information' => 'Pending Information',
            'pending_compliance' => 'Pending Compliance Review',
            'verified' => 'Verified',
            'rejected' => 'Rejected',
            'all' => 'All statuses',
        ];
    }

    public function render()
    {
        $agents = $this->buildQuery()->paginate($this->perPage);

        $selectedAgent = $this->selectedAgentId
            ? WomenVerifiedAgent::query()->with('user')->find($this->selectedAgentId)
            : null;

        $assessment = $this->assessment;
        if ($selectedAgent !== null && $assessment === []) {
            $assessment = $this->service->assessApplication($selectedAgent);
        }

        return view('livewire.admin.women-verification.queue-table', [
            'agents' => $agents,
            'selectedAgent' => $selectedAgent,
            'assessment' => $assessment,
            'stages' => VerificationStage::cases(),
        ]);
    }

    private function buildQuery(): Builder
    {
        return WomenVerifiedAgent::query()
            ->with('user')
            ->when($this->statusFilter !== '' && $this->statusFilter !== 'all', function (Builder $query): void {
                $query->where('status', $this->statusFilter);
            })
            ->when($this->stageFilter !== '', function (Builder $query): void {
                $query->where('verification_stage', $this->stageFilter);
            })
            ->when(trim($this->search) !== '', function (Builder $query): void {
                $term = '%'.trim($this->search).'%';

                $query->where(function (Builder $builder) use ($term): void {
                    $builder
                        ->where('license_number', 'like', $term)
                        ->orWhere('regulator', 'like', $term)
                        ->orWhereHas('user', function (Builder $userQuery) use ($term): void {
                            $userQuery
                                ->where('name', 'like', $term)
                                ->orWhere('email', 'like', $term);
                        });
                });
            })
            ->tap(function (Builder $builder): void {
                $builder
                    ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
                    ->orderBy('last_reviewed_at')
                    ->orderBy('created_at');
            });
    }

    private function ensureAgent(?int $agentId): WomenVerifiedAgent
    {
        if ($agentId === null) {
            throw ValidationException::withMessages([
                'agent' => 'Select a verification to review before performing actions.',
            ]);
        }

        $agent = WomenVerifiedAgent::query()->with('user')->find($agentId);

        if ($agent === null) {
            throw ValidationException::withMessages([
                'agent' => 'The selected verification is no longer available.',
            ]);
        }

        return $agent;
    }

    private function currentAdmin(): Admin
    {
        $admin = auth('admin')->user();

        if (! $admin instanceof Admin) {
            throw new AuthorizationException('Admin authentication is required.');
        }

        return $admin;
    }

    private function formatNotes(Admin $admin): array
    {
        $notes = [
            'source' => 'admin_queue',
            'admin' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
            ],
        ];

        if (trim($this->notes) !== '') {
            $notes['comment'] = trim($this->notes);
        }

        return $notes;
    }

    private function flashConfigForAction(string $action): array
    {
        return match ($action) {
            'approve' => [
                'type' => 'success',
                'message' => 'Agent marked as verified. Notification email queued for the agent.',
            ],
            'request-info' => [
                'type' => 'warning',
                'message' => 'Additional information requested from the agent. Notification email queued for the agent.',
            ],
            'reject' => [
                'type' => 'danger',
                'message' => 'Agent application rejected. Notification email queued for the agent.',
            ],
            'schedule-reverify' => [
                'type' => 'info',
                'message' => 'Reverification window scheduled. Reminder email queued for the agent.',
            ],
            'escalate' => [
                'type' => 'danger',
                'message' => 'Escalated to compliance review. Internal case file updated and audit logged.',
            ],
            default => [
                'type' => 'info',
                'message' => 'Verification action completed.',
            ],
        };
    }

    private function buildTimelineNote(WomenVerifiedAgent $agent): ?string
    {
        $reverifyAfter = Arr::get($agent->verification_payload ?? [], 'reverify_after');

        if ($reverifyAfter === null) {
            return null;
        }

        $reverifyDate = CarbonImmutable::make($reverifyAfter);

        if ($reverifyDate === null) {
            return null;
        }

        $reverifyDate = $reverifyDate->timezone('Australia/Sydney');

        return sprintf(
            'Next reverification window begins %s (%s).',
            $reverifyDate->isoFormat('MMM D, YYYY'),
            $reverifyDate->diffForHumans()
        );
    }
}

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class QueueTable extends LivewireComponent
{
    use QueueTableBehavior;
}

