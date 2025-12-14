<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SocialMedia;
use App\Models\SocialPost;
use App\Services\Social\GuardianSignalService;
use App\Services\Social\SocialShareService;
use App\Traits\FileUploadTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

final class EntertainmentController extends Controller
{
    use FileUploadTrait;

    public function index(): \Illuminate\Contracts\View\View
    {
        $posts = SocialPost::with(['user', 'media'])
            ->whereIn('post_type', ['short_video', 'movie', 'documentary', 'educational', 'success_story'])
            ->latest()
            ->paginate(10);

        $totalContent = SocialPost::whereIn('post_type', ['short_video', 'movie', 'documentary', 'educational', 'success_story'])->count();
        $shortVideos = SocialPost::where('post_type', 'short_video')->count();
        $movies = SocialPost::where('post_type', 'movie')->count();
        $educational = SocialPost::where('post_type', 'educational')->count();

        return view('admin.entertainment.index', compact('posts', 'totalContent', 'shortVideos', 'movies', 'educational'));
    }

    public function create(): \Illuminate\Contracts\View\View
    {
        return view('admin.entertainment.create');
    }

    public function store(Request $request, GuardianSignalService $guardian, SocialShareService $shareService): \Illuminate\Http\RedirectResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|in:short_video,movie,documentary,educational,success_story',
            'video_file' => 'required|file|mimetypes:video/mp4,video/quicktime,video/x-msvideo|max:102400', // 100MB max for demo
            'thumbnail_file' => 'nullable|image|max:5120', // 5MB
            'share_to' => 'nullable|array',
            'share_to.*' => 'string|in:facebook,twitter,linkedin,instagram',
            // Metadata validation
            'director' => 'nullable|string|max:255',
            'cast' => 'nullable|string',
            'music_track' => 'nullable|string|max:255',
            'difficulty_level' => 'nullable|string|in:beginner,intermediate,advanced',
            'duration' => 'nullable|integer|min:1',
        ]);

        DB::beginTransaction();

        try {
            // Prepare metadata
            $meta = [];
            if ($request->filled('director')) $meta['director'] = $request->director;
            if ($request->filled('cast')) $meta['cast'] = $request->cast;
            if ($request->filled('music_track')) $meta['music_track'] = $request->music_track;
            if ($request->filled('difficulty_level')) $meta['difficulty_level'] = $request->difficulty_level;
            if ($request->filled('duration')) $meta['duration'] = (int) $request->duration;

            // 1. Create SocialPost
            $post = SocialPost::create([
                'user_id' => Auth::id() ?? 1, // Fallback to ID 1 if not logged in as user (admin context)
                'post_type' => $request->type,
                'type' => 'post', // Generic type
                'caption' => $request->title, // Using caption as title
                'content' => $request->description,
                'visibility' => 'public',
                'moderation_status' => 'approved',
                'published_at' => now(),
                'meta' => $meta,
            ]);

            // 2. Upload Files
            $videoPath = $this->uploadFile($request, 'video_file', null, '/uploads/entertainment/videos');
            $thumbnailPath = $this->uploadFile($request, 'thumbnail_file', null, '/uploads/entertainment/thumbnails');

            // 3. Create SocialMedia
            $media = SocialMedia::create([
                'social_post_id' => $post->id,
                'media_type' => 'video',
                'file_path' => $videoPath,
                'thumbnail_path' => $thumbnailPath,
                'mime_type' => $request->file('video_file')->getMimeType(),
                'file_size' => $request->file('video_file')->getSize(),
                'order' => 0,
            ]);

            // 4. AI Analysis
            $guardian->analyze($media);

            // 5. Social Sharing
            if ($request->has('share_to')) {
                $user = Auth::user() ?? \App\Models\User::find(1);
                $shareService->sharePost($user, $post, $request->share_to);
            }

            DB::commit();

            return redirect()->route('admin.entertainment.index')->with('success', 'Content uploaded successfully.');

        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Failed to upload content: ' . $e->getMessage())->withInput();
        }
    }

    public function edit($id): \Illuminate\Contracts\View\View
    {
        $post = SocialPost::with('media')->findOrFail($id);
        return view('admin.entertainment.edit', compact('post'));
    }

    public function update(Request $request, $id, GuardianSignalService $guardian, SocialShareService $shareService): \Illuminate\Http\RedirectResponse
    {
        $post = SocialPost::findOrFail($id);

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|in:short_video,movie,documentary,educational,success_story',
            'video_file' => 'nullable|file|mimetypes:video/mp4,video/quicktime,video/x-msvideo|max:102400',
            'thumbnail_file' => 'nullable|image|max:5120',
            'share_to' => 'nullable|array',
            'share_to.*' => 'string|in:facebook,twitter,linkedin,instagram',
            // Metadata validation
            'director' => 'nullable|string|max:255',
            'cast' => 'nullable|string',
            'music_track' => 'nullable|string|max:255',
            'difficulty_level' => 'nullable|string|in:beginner,intermediate,advanced',
            'duration' => 'nullable|integer|min:1',
        ]);

        DB::beginTransaction();

        try {
            // Update metadata
            if ($request->filled('director')) $post->setMeta('director', $request->director);
            if ($request->filled('cast')) $post->setMeta('cast', $request->cast);
            if ($request->filled('music_track')) $post->setMeta('music_track', $request->music_track);
            if ($request->filled('difficulty_level')) $post->setMeta('difficulty_level', $request->difficulty_level);
            if ($request->filled('duration')) $post->setMeta('duration', (int) $request->duration);

            $post->update([
                'post_type' => $request->type,
                'caption' => $request->title,
                'content' => $request->description,
                // meta is updated via setMeta but needs to be saved. update() saves the model, but setMeta modifies the attribute.
                // Since setMeta modifies $this->meta, and update() reloads attributes or merges, we should be careful.
                // Better to pass meta to update()
                'meta' => $post->meta,
            ]);

            $media = $post->media()->first();
            $mediaUpdated = false;

            if ($request->hasFile('video_file')) {
                $videoPath = $this->uploadFile($request, 'video_file', $media?->file_path, '/uploads/entertainment/videos');

                if ($media) {
                    $media->update([
                        'file_path' => $videoPath,
                        'mime_type' => $request->file('video_file')->getMimeType(),
                        'file_size' => $request->file('video_file')->getSize(),
                    ]);
                } else {
                     $media = SocialMedia::create([
                        'social_post_id' => $post->id,
                        'media_type' => 'video',
                        'file_path' => $videoPath,
                        'order' => 0,
                    ]);
                }
                $mediaUpdated = true;
            }

            if ($request->hasFile('thumbnail_file')) {
                $thumbnailPath = $this->uploadFile($request, 'thumbnail_file', $media?->thumbnail_path, '/uploads/entertainment/thumbnails');

                if ($media) {
                    $media->update(['thumbnail_path' => $thumbnailPath]);
                }
            }

            // AI Analysis if media updated
            if ($mediaUpdated && $media) {
                $guardian->analyze($media);
            }

            // Social Sharing
            if ($request->has('share_to')) {
                $user = Auth::user() ?? \App\Models\User::find(1);
                $shareService->sharePost($user, $post, $request->share_to);
            }

            DB::commit();

            return redirect()->route('admin.entertainment.index')->with('success', 'Content updated successfully.');

        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Failed to update content: ' . $e->getMessage())->withInput();
        }
    }

    public function destroy($id): \Illuminate\Http\RedirectResponse
    {
        $post = SocialPost::findOrFail($id);
        // Soft delete is enabled on model, but we might want to delete media files too?
        // For now, just delete the post record.
        $post->delete();

        return redirect()->route('admin.entertainment.index')->with('success', 'Content deleted successfully.');
    }
}

