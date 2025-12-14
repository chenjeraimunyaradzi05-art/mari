<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\OrgInviteLog;
use App\Models\OrganizationPage;
use App\Services\Notify;
use App\Services\OrgMedia\OrgMediaUploader;
use App\Services\Org\OrgInviteService;
use App\Traits\Searchable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Throwable;

final class OrgPageController extends Controller
{
    use Searchable;

    public function __construct(private readonly OrgMediaUploader $mediaUploader, private readonly OrgInviteService $invites)
    {
    }

    public function index(Request $request): View
    {
        $query = OrganizationPage::query()->with('company')->withCount('followers')->latest();
        $this->search($query, ['name','slug','tagline']);

        $pages = $query->paginate(20);

        return view('admin.org-pages.index', [
            'pages' => $pages,
        ]);
    }

    public function create(): View
    {
        return view('admin.org-pages.create', [
            'companies' => Company::orderBy('name')->pluck('name', 'id'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validatePayload($request);

        $page = OrganizationPage::create($data);

        if ($request->hasFile('hero_media')) {
            $mediaType = $request->input('hero_media_type', 'image');
            $media = $this->mediaUploader->upload($page, $request->file('hero_media'), $mediaType);
            $page->update(['cover_media_id' => $media->id]);
        }

        Notify::createdNotification();

        return to_route('admin.organization-pages.edit', $page->id);
    }

    public function edit(int $id): View
    {
        $page = OrganizationPage::with(['company','coverMedia'])->findOrFail($id);

        return view('admin.org-pages.edit', [
            'page' => $page,
            'companies' => Company::orderBy('name')->pluck('name', 'id'),
        ]);
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $page = OrganizationPage::findOrFail($id);
        $data = $this->validatePayload($request, $page);

        if ($request->boolean('remove_cover')) {
            $data['cover_media_id'] = null;
        }

        $page->update($data);

        if ($request->hasFile('hero_media')) {
            $mediaType = $request->input('hero_media_type', 'image');
            $media = $this->mediaUploader->upload($page, $request->file('hero_media'), $mediaType);
            $page->update(['cover_media_id' => $media->id]);
        }

        Notify::updatedNotification();

        return to_route('admin.organization-pages.edit', $page->id);
    }

    public function destroy(int $id): \Illuminate\Http\Response
    {
        $page = OrganizationPage::findOrFail($id);

        try {
            $page->delete();
            Notify::deletedNotification();

            return response(['message' => 'success'], 200);
        } catch (\Throwable $exception) {
            logger()->error('Failed to delete organization page', [
                'id' => $id,
                'message' => $exception->getMessage(),
            ]);

            return response(['message' => 'Unable to delete organization page at this time'], 500);
        }
    }

    public function invites(OrganizationPage $organizationPage, Request $request): View
    {
        $filters = $request->validate([
            'status' => ['nullable','in:pending,queued,sent,failed'],
            'channel' => ['nullable','in:email,sms,slack'],
            'search' => ['nullable','string','max:255'],
        ]);

        $logsQuery = $organizationPage->inviteLogs()->with('inviter')->latest();

        if (! empty($filters['status'])) {
            $logsQuery->where('status', $filters['status']);
        }

        if (! empty($filters['channel'])) {
            $logsQuery->where('channel', $filters['channel']);
        }

        if (! empty($filters['search'])) {
            $logsQuery->where('email', 'like', '%'.$filters['search'].'%');
        }

        $invites = $logsQuery->paginate(25)->withQueryString();

        $stats = $organizationPage->inviteLogs()
            ->select('status', DB::raw('count(*) as aggregate'))
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return view('admin.org-pages.invites', [
            'page' => $organizationPage,
            'invites' => $invites,
            'filters' => $filters,
            'stats' => $stats,
        ]);
    }

    public function retryInvite(Request $request, OrganizationPage $organizationPage, OrgInviteLog $invite): RedirectResponse
    {
        if ($invite->org_page_id !== $organizationPage->id) {
            abort(404);
        }

        $options = ['send_summary' => false];

        if ($message = $request->input('message')) {
            $options['message'] = $message;
        }

        try {
            $this->invites->retryInvite($invite, $request->user(), $options);
            Notify::successNotification('Invite has been re-queued.');
        } catch (Throwable $exception) {
            Notify::errorNotification('Unable to retry invite: '.$exception->getMessage());
        }

        return redirect()->route('admin.organization-pages.invites', $organizationPage);
    }

    public function exportInvites(OrganizationPage $organizationPage): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $filename = 'org-invites-'.$organizationPage->slug.'-'.now()->format('Ymd_His').'.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ];

        $callback = function () use ($organizationPage): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Email', 'Status', 'Channel', 'Sent At', 'Invited By']);

            $organizationPage->inviteLogs()
                ->with('inviter:id,name,email')
                ->orderByDesc('created_at')
                ->chunk(200, function ($logs) use ($handle) {
                    foreach ($logs as $log) {
                        fputcsv($handle, [
                            $log->email,
                            $log->status,
                            $log->channel,
                            optional($log->sent_at)->toDateTimeString(),
                            optional($log->inviter)->name ?? optional($log->inviter)->email ?? '—',
                        ]);
                    }
                });

            fclose($handle);
        };

        return response()->streamDownload($callback, $filename, $headers);
    }

    /**
     * @return (\Illuminate\Support\Carbon|array|mixed|null|string)[]
     *
     * @psalm-return array{slug: mixed|string, highlights: array|null, policies: array|null, verification_status: 'unverified'|mixed, profile_status: 'draft'|mixed, published_at: \Illuminate\Support\Carbon|null,...}
     */
    private function validatePayload(Request $request, ?OrganizationPage $page = null): array
    {
        $pageId = $page?->id;
        $validated = $request->validate([
            'company_id' => ['nullable','exists:companies,id'],
            'name' => ['required','string','max:255'],
            'slug' => ['nullable','string','max:255', Rule::unique('organization_pages','slug')->ignore($pageId)],
            'type' => ['required', Rule::in(['university','tafe','rto','employer','tradie','government','association'])],
            'tagline' => ['nullable','string','max:255'],
            'about' => ['nullable','string'],
            'mission' => ['nullable','string'],
            'highlights' => ['nullable','string'],
            'policies' => ['nullable','string'],
            'hero_cta_label' => ['nullable','string','max:120'],
            'hero_cta_url' => ['nullable','url','max:255'],
            'website_url' => ['nullable','url','max:255'],
            'contact_email' => ['nullable','email','max:255'],
            'contact_phone' => ['nullable','string','max:120'],
            'verification_status' => ['nullable', Rule::in(['unverified','pending','verified'])],
            'profile_status' => ['nullable', Rule::in(['draft','published','archived'])],
            'hero_media' => ['nullable','file','mimetypes:video/*,image/*','max:'.config('org.max_upload_size', 524288)],
            'hero_media_type' => ['required_with:hero_media','in:video,image'],
            'remove_cover' => ['sometimes','boolean'],
        ]);

        $validated['slug'] = $validated['slug'] ?? Str::slug($validated['name']);
        $validated['highlights'] = $this->stringToArray($validated['highlights'] ?? null);
        $validated['policies'] = $this->stringToArray($validated['policies'] ?? null);
        $validated['verification_status'] = $validated['verification_status'] ?? 'unverified';
        $validated['profile_status'] = $validated['profile_status'] ?? 'draft';

        if (($validated['profile_status'] ?? null) === 'published') {
            $validated['published_at'] = $page?->published_at ?? now();
        } else {
            $validated['published_at'] = null;
        }

        return Arr::except($validated, ['hero_media', 'hero_media_type', 'remove_cover']);
    }

    /**
     * @return null|string[]
     *
     * @psalm-return array<int, string>|null
     */
    private function stringToArray(?string $value): array|null
    {
        if (! $value) {
            return null;
        }

        $items = collect(preg_split('/\r\n|\r|\n/', $value))
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->values()
            ->all();

        return empty($items) ? null : $items;
    }
}

