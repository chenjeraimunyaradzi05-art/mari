<?php
namespace App\Http\Controllers;
use App\Models\Connection;
use Illuminate\Http\Request;
final class ConnectionController extends Controller {
    public function index(): \Illuminate\Contracts\View\View {
        $connections = Connection::where('user_id', auth()->id())->get();
        return view('connections.index', compact('connections'));
    }
    public function store(Request $request): \Illuminate\Http\RedirectResponse {
        Connection::create([
            'user_id' => auth()->id(),
            'connected_user_id' => $request->connected_user_id,
            'status' => 'pending',
            'type' => $request->type,
            'initiator_id' => auth()->id()
        ]);

        // Award badge for first connection
        if (Connection::where('user_id', auth()->id())->count() === 1) {
            \App\Models\Badge::firstOrCreate([
                'user_id' => auth()->id(),
                'name' => 'First Connection'
            ], [
                'description' => 'Made your first connection',
                'icon' => 'fas fa-user-friends',
                'criteria' => 'first_connection',
                'awarded_at' => now()
            ]);

            // Onboarding progress: mark first connection as complete
            \App\Models\Progress::updateOrCreate([
                'user_id' => auth()->id(),
                'type' => 'first_connection'
            ], [
                'value' => 100,
                'target' => 100,
                'completed_at' => now()
            ]);
        }

        // Optionally notify the other user
        return redirect()->back()->with('success', 'Connection request sent!');
    }
    public function update(Request $request, $id): \Illuminate\Http\RedirectResponse {
        $connection = Connection::findOrFail($id);
        $connection->update(['status' => $request->status]);
        return redirect()->back()->with('success', 'Connection updated!');
    }
    public function destroy($id): \Illuminate\Http\RedirectResponse {
        Connection::destroy($id);
        return redirect()->back()->with('success', 'Connection removed!');
    }
}

