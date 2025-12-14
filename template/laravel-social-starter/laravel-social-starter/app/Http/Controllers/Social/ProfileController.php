<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function show(string $handle)
    {
        $profile = Profile::where('handle',$handle)->firstOrFail();
        $posts = $profile->posts()->with(['reactions','comments.user'])->latest()->paginate(12);
        return view('social.profile.show', compact('profile','posts'));
    }

    public function edit(string $handle)
    {
        $profile = Profile::where('handle',$handle)->firstOrFail();
        $this->authorize('update', $profile);
        return view('social.profile.edit', compact('profile'));
    }

    public function update(Request $request, string $handle)
    {
        $profile = Profile::where('handle',$handle)->firstOrFail();
        $this->authorize('update', $profile);

        $data = $request->validate([
            'display_name' => 'required|string|max:80',
            'bio' => 'nullable|string|max:1000',
            'avatar' => 'nullable|image|max:4096',
            'banner' => 'nullable|image|max:8192',
            'links_json' => 'nullable|array'
        ]);

        if ($request->hasFile('avatar')) {
            $data['avatar_path'] = $request->file('avatar')->store('avatars', 'public');
        }
        if ($request->hasFile('banner')) {
            $data['banner_path'] = $request->file('banner')->store('banners', 'public');
        }
        if (isset($data['links_json'])) {
            $data['links_json'] = array_values($data['links_json']);
        }

        $profile->update($data);
        return redirect()->route('profile.show', $profile->handle)->with('ok','Profile updated');
    }
}
