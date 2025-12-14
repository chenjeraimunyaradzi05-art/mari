<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ProfileVerification */
final class ProfileVerificationResource extends JsonResource
{
    /**
     * @param Request $request
     */
    #[\Override]
    /**
     * @return (\Illuminate\Http\Resources\Json\AnonymousResourceCollection|\Illuminate\Http\Resources\MissingValue|array|float|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, profile_id: int, user_id: int|null, request_type: string, status: string, submitted_data: array|null, attachment_manifest: array|null, risk_score: float|null, fraud_flags: array|null, submitted_at: string, reviewed_by: null|string, assigned_reviewer_id: int|null, assigned_reviewer: \Illuminate\Http\Resources\MissingValue|mixed, reviewed_at: string, decision_at: string, decision_reason: null|string, license_expires_at: string, notes: null|string, created_at: string, documents: \Illuminate\Http\Resources\Json\AnonymousResourceCollection, audits: \Illuminate\Http\Resources\Json\AnonymousResourceCollection}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'profile_id' => $this->profile_id,
            'user_id' => $this->user_id,
            'request_type' => $this->request_type,
            'status' => $this->status instanceof \BackedEnum ? $this->status->value : $this->status,
            'submitted_data' => $this->submitted_data,
            'attachment_manifest' => $this->attachment_manifest,
            'risk_score' => $this->risk_score !== null ? (float) $this->risk_score : null,
            'fraud_flags' => $this->fraud_flags,
            'submitted_at' => optional($this->submitted_at)->toIso8601String(),
            'reviewed_by' => $this->reviewed_by,
            'assigned_reviewer_id' => $this->assigned_reviewer_id,
            'assigned_reviewer' => $this->when($this->relationLoaded('assignedReviewer') && $this->assignedReviewer, fn () => [
                'id' => $this->assignedReviewer->id,
                'name' => $this->assignedReviewer->name,
                'email' => $this->assignedReviewer->email,
            ]),
            'reviewed_at' => optional($this->reviewed_at)->toIso8601String(),
            'decision_at' => optional($this->decision_at)->toIso8601String(),
            'decision_reason' => $this->decision_reason,
            'license_expires_at' => optional($this->license_expires_at)->toDateString(),
            'notes' => $this->notes,
            'created_at' => optional($this->created_at)->toIso8601String(),
            'documents' => VerificationDocumentResource::collection(
                $this->whenLoaded('documents')
            ),
            'audits' => VerificationAuditResource::collection(
                $this->whenLoaded('audits')
            ),
        ];
    }
}
