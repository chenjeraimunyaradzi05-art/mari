<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class IncidentReportResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return (\Illuminate\Http\Resources\MissingValue|mixed)[]
     *
     * @psalm-return array{id: mixed, uuid: mixed, category: mixed, severity: mixed, status: mixed, description: mixed, reporter_user_id: mixed, subject_user_id: mixed, metadata: mixed, occurred_at: mixed, resolved_at: mixed, created_at: mixed, updated_at: mixed, events: \Illuminate\Http\Resources\MissingValue|mixed}
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'category' => $this->category,
            'severity' => $this->severity,
            'status' => $this->status,
            'description' => $this->description,
            'reporter_user_id' => $this->reporter_user_id,
            'subject_user_id' => $this->subject_user_id,
            'metadata' => $this->metadata,
            'occurred_at' => optional($this->occurred_at)->toIso8601String(),
            'resolved_at' => optional($this->resolved_at)->toIso8601String(),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
            'events' => $this->whenLoaded('events', function () {
                return $this->events->map(function ($event) {
                    return [
                        'id' => $event->id,
                        'action' => $event->action,
                        'notes' => $event->notes,
                        'author_user_id' => $event->author_user_id,
                        'created_at' => optional($event->created_at)->toIso8601String(),
                    ];
                });
            }),
        ];
    }
}

