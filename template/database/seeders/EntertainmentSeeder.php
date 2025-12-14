<?php

namespace Database\Seeders;

use App\Models\Entertainment\Documentary;
use App\Models\Entertainment\EducationalVideo;
use App\Models\Entertainment\Movie;
use App\Models\Entertainment\ShortVideo;
use App\Models\SocialMedia;
use App\Models\SocialPost;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

final class EntertainmentSeeder extends Seeder
{
    public function run(): void
    {
        // Ensure we have a user
        $user = User::first() ?? User::factory()->create([
            'name' => 'Content Creator',
            'email' => 'creator@example.com',
        ]);

        // Ensure user has a social profile
        $profile = $user->socialProfile ?? \App\Models\SocialProfile::factory()->create(['user_id' => $user->id]);

        // 1. Seed Movies
        $this->command->info('Seeding Movies...');
        $movies = [
            [
                'title' => 'The Last Horizon',
                'description' => 'A sci-fi epic about the journey to the edge of the universe.',
                'director' => 'Christopher Nolan',
                'cast' => 'Matthew McConaughey, Anne Hathaway',
                'duration' => 7200, // 2 hours
            ],
            [
                'title' => 'Midnight in Paris',
                'description' => 'A nostalgic writer travels back in time to 1920s Paris.',
                'director' => 'Woody Allen',
                'cast' => 'Owen Wilson, Rachel McAdams',
                'duration' => 5400, // 1.5 hours
            ],
            [
                'title' => 'The Grand Hotel',
                'description' => 'Drama, intrigue, and romance in a luxury hotel.',
                'director' => 'Wes Anderson',
                'cast' => 'Ralph Fiennes, Tony Revolori',
                'duration' => 6000,
            ],
        ];

        foreach ($movies as $data) {
            $post = Movie::create([
                'user_id' => $user->id,
                'social_profile_id' => $profile->id,
                'postable_type' => \App\Models\SocialProfile::class,
                'postable_id' => $profile->id,
                'post_type' => 'movie',
                'type' => 'post',
                'caption' => $data['title'],
                'content' => $data['description'],
                'visibility' => 'public',
                'moderation_status' => 'approved',
                'published_at' => now(),
                'views_count' => rand(1000, 50000),
                'likes_count' => rand(100, 5000),
                'meta' => [
                    'director' => $data['director'],
                    'cast' => $data['cast'],
                    'duration' => $data['duration'],
                ],
            ]);

            $this->attachDummyMedia($post, 'video');
        }

        // 2. Seed Short Videos (Pulse)
        $this->command->info('Seeding Pulse Videos...');
        $shorts = [
            ['title' => 'Amazing Sunset 🌅', 'music' => 'Chill Vibes - LoFi'],
            ['title' => 'My Dog is Crazy! 🐶', 'music' => 'Funny Song - TikTok'],
            ['title' => 'How to cook pasta 🍝', 'music' => 'Italian Cooking - Chef'],
            ['title' => 'Dance Challenge 💃', 'music' => 'Top Hit 2025 - Pop'],
            ['title' => 'Travel Vlog: Tokyo 🇯🇵', 'music' => 'Travel - Adventure'],
            ['title' => 'Gym Motivation 💪', 'music' => 'Workout Mix - Power'],
        ];

        foreach ($shorts as $data) {
            $post = ShortVideo::create([
                'user_id' => $user->id,
                'social_profile_id' => $profile->id,
                'postable_type' => \App\Models\SocialProfile::class,
                'postable_id' => $profile->id,
                'post_type' => 'short_video',
                'type' => 'post',
                'caption' => $data['title'],
                'content' => $data['title'], // Short videos often just have a caption
                'visibility' => 'public',
                'moderation_status' => 'approved',
                'published_at' => now(),
                'views_count' => rand(5000, 100000),
                'likes_count' => rand(500, 10000),
                'meta' => [
                    'music_track' => $data['music'],
                    'duration' => rand(15, 60),
                ],
            ]);

            $this->attachDummyMedia($post, 'video', true);
        }

        // 3. Seed Documentaries
        $this->command->info('Seeding Documentaries...');
        $docs = [
            ['title' => 'Planet Earth III', 'director' => 'David Attenborough'],
            ['title' => 'The Social Dilemma', 'director' => 'Jeff Orlowski'],
        ];

        foreach ($docs as $data) {
            $post = Documentary::create([
                'user_id' => $user->id,
                'social_profile_id' => $profile->id,
                'postable_type' => \App\Models\SocialProfile::class,
                'postable_id' => $profile->id,
                'post_type' => 'documentary',
                'type' => 'post',
                'caption' => $data['title'],
                'content' => 'An insightful documentary.',
                'visibility' => 'public',
                'moderation_status' => 'approved',
                'published_at' => now(),
                'views_count' => rand(1000, 20000),
                'meta' => [
                    'director' => $data['director'],
                    'duration' => rand(3000, 5000),
                ],
            ]);

            $this->attachDummyMedia($post, 'video');
        }
    }

    private function attachDummyMedia(SocialPost $post, string $type, bool $isVertical = false): void
    {
        // In a real app, these would be real URLs. For dev, we use placeholders.
        // Using a sample video URL that works (e.g., from a public CDN or placeholder)
        // Big Buck Bunny is a common test video.
        $videoUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

        if ($isVertical) {
             // Vertical placeholder (using same video for now, but in real life would be vertical)
             $videoUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';
        }

        SocialMedia::create([
            'social_post_id' => $post->id,
            'media_type' => $type,
            'file_path' => $videoUrl, // Storing URL directly for seeder
            'thumbnail_path' => 'https://via.placeholder.com/640x360.png?text=' . urlencode($post->caption),
            'mime_type' => 'video/mp4',
            'file_size' => 1024 * 1024 * 10, // 10MB
            'order' => 0,
        ]);
    }
}

