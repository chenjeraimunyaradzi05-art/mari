<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class FollowController extends Controller
{
    public function follow(string $handle)
    {
        $me = Profile::where('user_id', Auth::id())->firstOrFail();
        $target = Profile::where('handle',$handle)->firstOrFail();
        DB::table('follows')->updateOrInsert([
            'follower_id' => $me->id,
            'followed_id' => $target->id,
        ], ['created_at' => now(), 'updated_at' => now()]);
        return back()->with('ok','Following');
    }

    public function unfollow(string $handle)
    {
        $me = Profile::where('user_id', Auth::id())->firstOrFail();
        $target = Profile::where('handle',$handle)->firstOrFail();
        DB::table('follows')->where([
            'follower_id' => $me->id, 'followed_id' => $target->id
        ])->delete();
        return back()->with('ok','Unfollowed');
    }
}
