<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileSafetyRequest;
use App\Http\Resources\ProfileResource;
use App\Models\Profile;
use App\Services\Privacy\ProfilePrivacyService;
use Illuminate\Http\Request;

final class ProfilePrivacyController extends Controller
{
    public function __construct(private readonly ProfilePrivacyService $privacy)
    {
        $this->middleware(['auth:sanctum']);
    }

    public function update(UpdateProfileSafetyRequest $request, Profile $profile): ProfileResource
    {
        $this->assertOwnership($request, $profile);

        $updated = $this->privacy->update($profile, $request->validated(), $request->user());

        return new ProfileResource($updated);
    }

    private function assertOwnership(Request $request, Profile $profile): void
    {
        abort_if($profile->user_id !== $request->user()->id, 403, 'You do not have access to this persona.');
    }
}

