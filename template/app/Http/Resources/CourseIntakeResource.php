<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class CourseIntakeResource extends JsonResource
{
    /**
     * @return array
     *
     * @psalm-return array{id: mixed, course_id: mixed, start_on: mixed, apply_by: mixed, seats: mixed, scholarships: mixed, status: mixed}
     */
    #[\Override]
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'course_id' => $this->course_id,
            'start_on' => $this->start_on,
            'apply_by' => $this->apply_by,
            'seats' => $this->seats,
            'scholarships' => $this->scholarships,
            'status' => $this->status,
        ];
    }
}

