<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\Reaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ReactionController extends Controller
{
    public function store(Request $request, Post $post)
    {
        $data = $request->validate([ 'type' => 'required|in:like,heart,celebrate,support,useful' ]);
        $reaction = Reaction::firstOrCreate([
            'user_id' => Auth::id(),
            'post_id' => $post->id,
            'type' => $data['type'],
        ]);
        return response()->json(['ok' => true, 'count' => $post->reactions()->count()]);
    }
}
