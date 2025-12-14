<?php

namespace App\Http\Controllers\Api\Money;

use App\Http\Controllers\Controller;
use App\Models\Debt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DebtController extends Controller
{
    public function destroy(Request $request, Debt $debt): JsonResponse
    {
        $user = $request->user();

        abort_if($debt->user_id !== $user->id, 403);

        $debt->delete();

        return response()->json([
            'message' => 'Debt deleted.',
        ]);
    }
}

