<?php
namespace App\Http\Controllers;
use App\Models\Invite;
use Illuminate\Http\Request;
final class InviteController extends Controller {
    public function index(): \Illuminate\Contracts\View\View {
        $invites = Invite::where('sender_id', auth()->id())->get();
        return view('invites.index', compact('invites'));
    }
    public function store(Request $request): \Illuminate\Http\RedirectResponse {
    $userId = \Illuminate\Support\Facades\Auth::user()->id;
        Invite::create([
            'sender_id' => $userId,
            'recipient_email' => $request->recipient_email,
            'recipient_phone' => $request->recipient_phone,
            'type' => $request->type,
            'message' => $request->message,
            'status' => 'pending',
            'token' => uniqid('invite_')
        ]);

        // Award badge for first invite
        if (Invite::where('sender_id', $userId)->count() === 1) {
            \App\Models\Badge::firstOrCreate([
                'user_id' => $userId,
                'name' => 'First Invite'
            ], [
                'description' => 'Sent your first invite',
                'icon' => 'fas fa-paper-plane',
                'criteria' => 'first_invite',
                'awarded_at' => now()
            ]);

            // Onboarding progress: mark first invite as complete
            \App\Models\Progress::updateOrCreate([
                'user_id' => $userId,
                'type' => 'first_invite'
            ], [
                'value' => 100,
                'target' => 100,
                'completed_at' => now()
            ]);
        }

        // Optionally send email/SMS invite
        return redirect()->back()->with('success', 'Invite sent!');
    }
    public function destroy($id): \Illuminate\Http\RedirectResponse {
        Invite::destroy($id);
        return redirect()->back()->with('success', 'Invite deleted!');
    }
}

