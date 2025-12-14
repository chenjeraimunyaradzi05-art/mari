<?php

namespace App\Http\Controllers\Admin;

use App\Enums\IdentityFlagStatus;
use App\Http\Controllers\Controller;
use App\Models\IdentityFlag;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class IdentityFlagController extends Controller
{
    public function index(Request $request): View
    {
        $query = IdentityFlag::query()
            ->with(['user'])
            ->orderByDesc('flagged_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('severity')) {
            $query->where('severity', $request->input('severity'));
        }

        $flags = $query->paginate(20);

        return view('admin.identity-flags.index', compact('flags'));
    }

    public function show(IdentityFlag $identityFlag): View
    {
        $identityFlag->load(['user', 'resolvedBy']);

        return view('admin.identity-flags.show', compact('identityFlag'));
    }

    public function update(Request $request, IdentityFlag $identityFlag): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string'],
            'resolution_notes' => ['nullable', 'string'],
        ]);

        $identityFlag->update([
            'status' => $validated['status'],
            'resolution_notes' => $validated['resolution_notes'],
            'resolved_at' => now(),
            'resolved_by_admin_id' => auth()->id(),
        ]);

        return redirect()->route('admin.identity-flags.show', $identityFlag)
            ->with('success', 'Flag updated successfully.');
    }
}

