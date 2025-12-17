<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Profile;
use App\Models\Post;

class SocialDemoSeeder extends Seeder
{
    public function run(): void
    {
        $u = User::first() ?? User::factory()->create(['name' => 'Demo User','email'=>'demo@example.com']);
        $p = Profile::firstOrCreate(['user_id'=>$u->id], [
            'type' => 'candidate',
            'display_name' => $u->name,
            'handle' => 'demo',
            'bio' => 'Aspiring engineer | She/Her',
        ]);

        Post::factory()->count(5)->create([
            'author_type' => Profile::class,
            'author_id' => $p->id,
            'media_type' => 'none',
            'visibility' => 'public',
            'body' => 'Welcome to the women-first social feed!',
        ]);
    }
}
