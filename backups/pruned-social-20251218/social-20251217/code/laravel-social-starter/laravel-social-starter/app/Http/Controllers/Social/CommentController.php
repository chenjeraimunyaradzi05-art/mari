<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\Comment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CommentController extends Controller
{
    public function store(Request $request, Post $post)
    {
        $data = $request->validate([
            'body' => 'required|string|max:1000',
            'parent_id' => 'nullable|exists:comments,id'
        ]);
        $comment = Comment::create([
            'user_id' => Auth::id(),
            'post_id' => $post->id,
            'body' => $data['body'],
            'parent_id' => $data['parent_id'] ?? null,
        ]);
        return back();
    }
}
