<?php
namespace App\Http\Controllers;
use App\Models\Post;
use Illuminate\Http\Request;
final class PostController extends Controller {
    public function index(): \Illuminate\Contracts\View\View {
        // Only show posts that are public and have passed moderation
        $posts = Post::public()->latest()->get();
        return view('posts.index', compact('posts'));
    }
    public function store(Request $request): \Illuminate\Http\RedirectResponse {
        $request->validate([
            'content' => ['nullable', 'string', 'max:5000'],
            'media' => ['nullable'],
            'type' => ['nullable', 'string'],
            'visibility' => ['nullable', 'in:public,private,friends,recruiters'],
        ]);

        $content = (string) $request->input('content', '');

        // age check: if user has a member profile with a date_of_birth and is under 18,
        // they should not publish certain content publicly.
        $user = auth()->user();
        $profile = \App\Models\MemberProfile::where('user_id', $user->id)->first();
        $isUnder18 = false;
        if ($profile && $profile->date_of_birth) {
            try {
                $dob = \Carbon\Carbon::parse($profile->date_of_birth);
                $isUnder18 = $dob->age < 18;
            } catch (\Throwable $e) {
                $isUnder18 = false;
            }
        }

        // Run basic moderation checks
        $moderator = app(\App\Services\ContentModerationService::class);
        $violations = $moderator->scanText($content);

        $isFlagged = false;
        $flagReasons = [];
        $visibility = $request->input('visibility', 'public');

        if (!empty($violations)) {
            foreach ($violations as $v) {
                $flagReasons[] = $v['type'];
            }

            // Pornographic content: block public posting and reject for minors
            if (collect($violations)->contains('type', 'pornographic')) {
                if ($isUnder18) {
                    return redirect()->back()->withErrors([ 'content' => 'Your post contains sexual content which is not allowed for under 18 accounts.']);
                }

                // disallow public posting of pornographic content
                if ($visibility === 'public') {
                    return redirect()->back()->withErrors([ 'content' => 'Public posting of explicit sexual content is not allowed.']);
                }

                $isFlagged = true;
            }

            // For sexist/homophobic/racist/abusive terms: do not allow to be public.
            $disallowed = collect($violations)->pluck('type')->intersect(['sexist', 'homophobic', 'racist', 'abusive'])->values();
            if ($disallowed->isNotEmpty()) {
                // If user attempted to publish publicly, block and ask to moderate
                if ($visibility === 'public') {
                    // prevent public posting of hate/abuse content
                    return redirect()->back()->withErrors([ 'content' => 'Your post contains language not permitted on public posts. Please remove abusive or discriminatory language.']);
                }

                $isFlagged = true;
            }
        }

        // Create post; if flagged, mark moderation status accordingly and ensure it isn't public
        if ($isFlagged) {
            if ($visibility === 'public') {
                $visibility = 'private';
            }
            $moderationStatus = 'pending';
        } else {
            $moderationStatus = 'approved';
        }

        Post::create([
            'user_id' => $user->id,
            'content' => $content,
            'media' => $request->input('media'),
            'type' => $request->input('type'),
            'visibility' => $visibility,
            'is_flagged' => $isFlagged,
            'flag_reasons' => !empty($flagReasons) ? json_encode($flagReasons) : null,
            'moderation_status' => $moderationStatus,
        ]);

        // Award badge for first post
        if (Post::where('user_id', auth()->id())->count() === 1) {
            \App\Models\Badge::firstOrCreate([
                'user_id' => auth()->id(),
                'name' => 'First Post'
            ], [
                'description' => 'Shared your first post',
                'icon' => 'fas fa-bullhorn',
                'criteria' => 'first_post',
                'awarded_at' => now()
            ]);

            // Onboarding progress: mark first post as complete
            \App\Models\Progress::updateOrCreate([
                'user_id' => auth()->id(),
                'type' => 'first_post'
            ], [
                'value' => 100,
                'target' => 100,
                'completed_at' => now()
            ]);
        }

        // Optionally notify followers
        return redirect()->back()->with('success', 'Post shared!');
    }
    public function destroy($id): \Illuminate\Http\RedirectResponse {
        Post::destroy($id);
        return redirect()->back()->with('success', 'Post deleted!');
    }
}

