<?php

namespace App\Policies;

use App\Models\Post;
use App\Models\User;

class PostPolicy
{
    public function delete(User $user, Post $post): bool
    {
        if ($post->author_type === \App\Models\Profile::class) {
            return $post->author->user_id === $user->id || ($user->is_admin ?? false);
        }
        return $user->is_admin ?? false;
    }
}
