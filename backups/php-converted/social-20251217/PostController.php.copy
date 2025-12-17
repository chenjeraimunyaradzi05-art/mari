<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\Profile;
use App\Services\Ai\Ai;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PostController extends Controller
{
    public function create()
    {
        return view('social.post.create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'body' => 'nullable|string|max:2000',
            'media' => 'nullable|file|mimetypes:image/jpeg,image/png,video/mp4,video/quicktime|max:512000',
            'media_type' => 'required|in:none,image,video',
            'visibility' => 'required|in:public,followers'
        ]);

        $author = Profile::where('user_id', Auth::id())->firstOrFail();

        $mediaPath = null;
        if ($request->hasFile('media')) {
            $disk = config('filesystems.default','public');
            $mediaPath = $request->file('media')->store('posts', $disk);
        }

        $post = Post::create([
            'author_type' => Profile::class,
            'author_id' => $author->id,
            'body' => $data['body'] ?? null,
            'media_path' => $mediaPath,
            'media_type' => $data['media_type'],
            'visibility' => $data['visibility'],
        ]);

        // AI Assist (caption + tags + moderation) - best effort
        try {
            $ai = app(Ai::class);
            $post->ai_caption = $ai->caption($post->body ?? '');
            $post->ai_tags = $ai->tags($post->body ?? '');
            $post->is_moderated = $ai->moderate($post->body ?? '');
            $post->save();
        } catch (\Throwable $e) {
            // swallow AI errors; post still goes through
        }

        return redirect()->route('feed')->with('ok','Posted!');
    }

    public function destroy(Post $post)
    {
        $this->authorize('delete', $post);
        $post->delete();
        return back()->with('ok','Post deleted');
    }
}
