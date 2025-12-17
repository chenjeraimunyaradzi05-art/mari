<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Support\Facades\Auth;

class FeedController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        $posts = Post::query()
            ->with(['author','reactions','comments.user'])
            ->latest()
            ->paginate(15);

        return view('social.feed.index', compact('posts','user'));
    }
}
