<?php
namespace App\Http\Controllers;
use App\Models\Group;
use Illuminate\Http\Request;
final class GroupController extends Controller {
    public function index(): \Illuminate\Contracts\View\View {
        $groups = Group::where('visibility', 'public')->get();
        return view('groups.index', compact('groups'));
    }
    public function store(Request $request): \Illuminate\Http\RedirectResponse {
        Group::create([
            'name' => $request->name,
            'description' => $request->description,
            'type' => $request->type,
            'created_by' => auth()->id(),
            'visibility' => $request->visibility ?? 'public'
        ]);
        return redirect()->back()->with('success', 'Group created!');
    }
    public function destroy($id): \Illuminate\Http\RedirectResponse {
        Group::destroy($id);
        return redirect()->back()->with('success', 'Group deleted!');
    }
}

