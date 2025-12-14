<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Enums\WomenRealEstate\VerificationStage;
use App\Models\AIInferenceLog;
use App\Models\User;
use App\Models\WomenRealEstate\WomenAgentVerificationAudit;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Notifications\WomenRealEstate\WomenAgentComplianceEscalationNotification;
use App\Notifications\WomenRealEstate\WomenAgentReverificationScheduledNotification;
use App\Notifications\WomenRealEstate\WomenAgentVerificationStatusNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http as HttpFacade;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use RuntimeException;
use Throwable;

final class WomenVerificationService
{
    private LicenseRegulatorLookupService $regulatorLookup;

    private FraudDetectionService $fraudDetection;

    private WomenVerificationAiSummaryService $aiSummaryService;

    public function __construct(
        ?LicenseRegulatorLookupService $regulatorLookup = null,
        ?FraudDetectionService $fraudDetection = null,
        ?WomenVerificationAiSummaryService $aiSummaryService = null
    ) {
        $this->regulatorLookup = $regulatorLookup ?? app(LicenseRegulatorLookupService::class);
        $this->fraudDetection = $fraudDetection ?? app(FraudDetectionService::class);
        $this->aiSummaryService = $aiSummaryService ?? app(WomenVerificationAiSummaryService::class);
    }


    /**
     * @return (((mixed|string)[]|float|mixed|string)[]|VerificationStage|int|string)[]
     *
     * @psalm-return array{agent_id: int, stage: 'initial', risk_flags: list<mixed>, recommended_stage: VerificationStage, trust_delta: int, regulator: array{status: string, confidence: float, registry: array<string, mixed>, flags: array<int, string>, checked_at: string, meta: array<string, mixed>}, fraud: array{score: float, flags: array<int, string>, signals: array<string, mixed>}, ai_summary: array{overview: string, priority_flags: array<int, string>, recommendations: array<int, string>, fraud_score: float, regulator_status: string}}
     */
    public function assessApplication(WomenVerifiedAgent $agent, array $screeningSignals = []): array
    {
        $legalName = Arr::get($agent->verification_payload, 'application.profile.legal_name');

        $regulatorAssessment = $this->regulatorLookup->verify(
            $agent->license_number,
            $agent->regulator,
            ['legal_name' => $legalName]
        );

        $fraudAssessment = $this->fraudDetection->analyse($agent);

        $combinedSignals = array_merge($screeningSignals, [
            'regulator' => $regulatorAssessment,
            'fraud_score' => $fraudAssessment['score'],
        ]);

        $riskFlags = $this->detectRiskFlags($agent, $combinedSignals);
        $riskFlags = array_values(array_unique(array_merge(
            $riskFlags,
            $fraudAssessment['flags'],
            Arr::get($regulatorAssessment, 'flags', [])
        )));
        $stage = $agent->verification_stage ?? VerificationStage::INITIAL;

        $aiSummary = $this->aiSummaryService->summarise($agent, [
            'risk_flags' => $riskFlags,
            'fraud' => $fraudAssessment,
            'regulator' => $regulatorAssessment,
        ]);

        return [
            'agent_id' => $agent->id,
            'stage' => $stage->value,
            'risk_flags' => $riskFlags,
            'recommended_stage' => $this->nextStage($stage, $riskFlags),
            'trust_delta' => $this->calculateTrustDelta($agent, $riskFlags),
            'regulator' => $regulatorAssessment,
            'fraud' => $fraudAssessment,
            'ai_summary' => $aiSummary,
        ];
    }

    public function advanceStage(WomenVerifiedAgent $agent, VerificationStage $targetStage): WomenVerifiedAgent
    {
        if ($agent->verification_stage?->value === $targetStage->value) {
            return $agent;
        }

        $agent->verification_stage = $targetStage;
        $agent->last_reviewed_at = now();
        $agent->save();

        return $agent;
    }

    public function recordDecision(
        WomenVerifiedAgent $agent,
        string $statusAfter,
        ?User $reviewer,
        array $notes = [],
        ?array $aiSummary = null,
        ?string $pipeline = null
    ): WomenAgentVerificationAudit {
        $audit = null;
        $updatedAgent = null;

        DB::transaction(function () use ($agent, $statusAfter, $reviewer, $notes, $aiSummary, $pipeline, &$audit, &$updatedAgent) {
            $audit = WomenAgentVerificationAudit::create([
                'agent_id' => $agent->id,
                'reviewer_id' => $reviewer?->id,
                'status_before' => $agent->status,
                'status_after' => $statusAfter,
                'notes' => $notes ?: null,
                'ai_summary' => $aiSummary ?: null,
            ]);

            $agent->status = $statusAfter;
            if ($statusAfter === 'verified' && $agent->verification_stage !== VerificationStage::APPROVED) {
                $agent->verification_stage = VerificationStage::APPROVED;
                $agent->verified_at = now();
            }

            if ($statusAfter === 'pending_compliance') {
                $agent->verification_stage = VerificationStage::REGULATOR_CHECK;
                $payload = $agent->verification_payload ?? [];
                $payload['compliance_escalations'] ??= [];
                $payload['compliance_escalations'][] = [
                    'escalated_at' => now()->toIso8601String(),
                    'admin' => $notes['admin'] ?? null,
                    'comment' => $notes['comment'] ?? null,
                ];
                $agent->verification_payload = $payload;
            }

            if ($statusAfter === 'verified') {
                $agent->trust_badge_level = min(5, $agent->trust_badge_level + 1);
            } elseif (in_array($statusAfter, ['rejected', 'pending_information', 'pending_compliance'], true)) {
                $agent->trust_badge_level = max(0, $agent->trust_badge_level - 1);
            }

            $agent->last_reviewed_at = now();
            $agent->save();

            if ($pipeline !== null) {
                $this->logInference($pipeline, [
                    'agent_id' => $agent->id,
                    'audit_id' => $audit->id,
                    'status_after' => $statusAfter,
                ], $aiSummary ?? []);
            }

            $updatedAgent = $agent->fresh(['user']);
        });

        if ($updatedAgent !== null) {
            $comment = is_array($notes) ? ($notes['comment'] ?? null) : null;
            $this->notifyStatusChange($updatedAgent, $statusAfter, $comment);
        }

        if (! $audit instanceof WomenAgentVerificationAudit) {
            throw new RuntimeException('Unable to persist verification decision.');
        }

        return $audit;
    }

    public function scheduleReverification(WomenVerifiedAgent $agent, ?CarbonImmutable $when = null): void
    {
        $scheduledFor = $when ?? CarbonImmutable::now()->addMonths(12);

        $agent->verification_stage = VerificationStage::REVERIFICATION;
        $agent->last_reviewed_at = now();
        $agent->verification_payload = array_merge($agent->verification_payload ?? [], [
            'reverify_after' => $scheduledFor->toIso8601String(),
        ]);
        $agent->save();

        $this->notifyReverification($agent->fresh(['user']), $scheduledFor);
    }

    /**
     * Escalate an agent to the compliance workflow.
     *
     * Creates an audit record, updates agent status and verification stage,
     * appends a compliance escalation to the verification payload, optionally
     * logs an inference, and notifies the compliance channel.
     *
     * @param array<string, mixed> $notes
     */
    public function escalateToCompliance(WomenVerifiedAgent $agent, array $notes, ?User $reviewer = null, ?array $aiSummary = null, ?string $pipeline = null): WomenAgentVerificationAudit
    {
        $audit = null;

        DB::transaction(function () use ($agent, $notes, $reviewer, $aiSummary, $pipeline, &$audit) {
            $audit = WomenAgentVerificationAudit::create([
                'agent_id' => $agent->id,
                'reviewer_id' => $reviewer?->id,
                'status_before' => $agent->status,
                'status_after' => 'pending_compliance',
                'notes' => $notes ?: null,
                'ai_summary' => $aiSummary ?: null,
            ]);

            $agent->status = 'pending_compliance';
            $agent->verification_stage = VerificationStage::REGULATOR_CHECK;

            $payload = $agent->verification_payload ?? [];
            $payload['compliance_escalations'] ??= [];
            $payload['compliance_escalations'][] = [
                'escalated_at' => now()->toIso8601String(),
                'admin' => $notes['admin'] ?? null,
                'comment' => $notes['comment'] ?? null,
                'source' => $notes['source'] ?? null,
            ];

            $agent->verification_payload = $payload;
            $agent->last_reviewed_at = now();
            $agent->save();

            if ($pipeline !== null) {
                $this->logInference($pipeline, [
                    'agent_id' => $agent->id,
                    'audit_id' => $audit->id,
                    'status_after' => 'pending_compliance',
                ], $aiSummary ?? []);
            }
        });

        // Notify the external compliance channels (email and slack) — best effort.
        $this->notifyComplianceTeam($agent->fresh(['user']), $audit, $notes);

        if (! $audit instanceof WomenAgentVerificationAudit) {
            throw new RuntimeException('Unable to persist escalation to compliance.');
        }

        return $audit;
    }

    private function notifyComplianceTeam(WomenVerifiedAgent $agent, WomenAgentVerificationAudit $audit, array $notes): void
    {
        $email = config('women_real_estate.compliance.escalation_email');
        $slackWebhook = config('women_real_estate.compliance.slack_webhook');

        $queueUrl = $this->complianceQueueUrl();

        if ($email) {
            NotificationFacade::route('mail', $email)->notify(
                new WomenAgentComplianceEscalationNotification($agent, $audit, $notes, $queueUrl)
            );
        }

        if (! $slackWebhook) {
            return;
        }

        $fields = array_values(array_filter([
            $agent->user ? [
                'title' => 'Agent',
                'value' => sprintf('%s (%s)', $agent->user->name, $agent->user->email),
                'short' => false,
            ] : null,
            [
                'title' => 'Status After',
                'value' => ucfirst(str_replace('_', ' ', $audit->status_after ?? 'pending_compliance')),
                'short' => true,
            ],
            isset($notes['comment']) && trim((string) $notes['comment']) !== '' ? [
                'title' => 'Reviewer note',
                'value' => trim((string) $notes['comment']),
                'short' => false,
            ] : null,
        ]));

        $attachment = [
            'title' => 'Open verification queue',
            'color' => '#E53E3E',
            'fields' => $fields,
        ];

        if ($queueUrl !== null) {
            $attachment['title_link'] = $queueUrl;
        }

        $payload = [
            'text' => sprintf('Compliance escalation: Agent #%d requires review. Audit #%d.', $agent->id, $audit->id),
            'attachments' => [$attachment],
        ];

        try {
            HttpFacade::timeout(5)->post($slackWebhook, $payload);
        } catch (Throwable $exception) {
            // Best effort only; we intentionally swallow webhook failures.
        }
    }

    private function complianceQueueUrl(): ?string
    {
        try {
            return route('admin.women.verification.queue.index');
        } catch (Throwable) {
            $fallback = config('women_real_estate.compliance.queue_url')
                ?? config('app.url');

            return $fallback ?: null;
        }
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0?: string, 1?: string, 2?: string, 3?: 'high_fraud_score'|'regulator_manual_review'|'regulator_mismatch', 4?: 'regulator_manual_review'|'regulator_mismatch', 5?: 'regulator_manual_review'}
     */
    private function detectRiskFlags(WomenVerifiedAgent $agent, array $signals): array
    {
        $flags = [];

        $expiresAt = $agent->license_expires_at !== null ? CarbonImmutable::make($agent->license_expires_at) : null;

        if ($expiresAt !== null && $expiresAt->isPast()) {
            $flags[] = 'license_expired';
        }

        $documents = Arr::get($agent->verification_payload, 'application.documents', []);
        if (empty(Arr::get($documents, 'license_certificate.path'))) {
            $flags[] = 'missing_license_document';
        }
        if (empty(Arr::get($documents, 'photo_id.path'))) {
            $flags[] = 'missing_photo_id_document';
        }

        if ((float) ($signals['fraud_score'] ?? 0) >= 0.75) {
            $flags[] = 'high_fraud_score';
        }

        if (Arr::get($signals, 'regulator.status') === 'mismatch') {
            $flags[] = 'regulator_mismatch';
        }

        if (Arr::get($signals, 'regulator.status') === 'manual_review') {
            $flags[] = 'regulator_manual_review';
        }

        return $flags;
    }

    private function nextStage(VerificationStage $current, array $riskFlags): VerificationStage
    {
        if (in_array('high_fraud_score', $riskFlags, true)) {
            return VerificationStage::REGULATOR_CHECK;
        }

        if (in_array('regulator_mismatch', $riskFlags, true)) {
            return VerificationStage::REGULATOR_CHECK;
        }

        if ($current === VerificationStage::APPROVED) {
            return VerificationStage::REVERIFICATION;
        }

        return $current->next();
    }

    private function calculateTrustDelta(WomenVerifiedAgent $agent, array $riskFlags): int
    {
        $delta = 0;

        if ($riskFlags === []) {
            $delta += 1;
        }

        if (in_array('license_expired', $riskFlags, true)) {
            $delta -= 2;
        }

        if (in_array('high_fraud_score', $riskFlags, true)) {
            $delta -= 3;
        }

        if (in_array('duplicate_license_detected', $riskFlags, true)) {
            $delta -= 2;
        }

        if (
            in_array('missing_required_documents', $riskFlags, true)
            || in_array('missing_license_document', $riskFlags, true)
            || in_array('missing_photo_id_document', $riskFlags, true)
        ) {
            $delta -= 1;
        }

        if (in_array('regulator_manual_review', $riskFlags, true)) {
            $delta -= 1;
        }

        return $delta;
    }

    private function logInference(string $pipeline, array $meta, array $summary): void
    {
        AIInferenceLog::create([
            'pipeline' => $pipeline,
            'prompt_version' => $summary['prompt_version'] ?? 'v1',
            'prompt_hash' => $summary['prompt_hash'] ?? sha1(json_encode($summary)),
            'tokens_in' => $summary['tokens_in'] ?? 0,
            'tokens_out' => $summary['tokens_out'] ?? 0,
            'duration_ms' => $summary['duration_ms'] ?? null,
            'confidence' => $summary['confidence'] ?? null,
            'result_status' => $summary['result_status'] ?? 'success',
            'cache_hit' => (bool) ($summary['cache_hit'] ?? false),
            'override_flag' => (bool) ($summary['override_flag'] ?? false),
            'meta' => $meta,
        ]);
    }

    private function notifyStatusChange(WomenVerifiedAgent $agent, string $statusAfter, ?string $comment): void
    {
        $user = $agent->user;

        if (! $user) {
            return;
        }

        $user->notify(new WomenAgentVerificationStatusNotification($agent, $statusAfter, $comment));
    }

    private function notifyReverification(?WomenVerifiedAgent $agent, CarbonImmutable $when): void
    {
        if ($agent === null) {
            return;
        }

        $user = $agent->user;

        if (! $user) {
            return;
        }

        $user->notify(new WomenAgentReverificationScheduledNotification($agent, $when));
    }
}

