<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\OrganizationPage;
use App\Models\OrgMediaAsset;

class OrgMediaController extends Controller
{
    public function store(string $slug, Request $request)
    {
        $page = OrganizationPage::where('slug', $slug)->firstOrFail();
        // Simple local upload example; replace with signed URLs -> transcode pipeline
        $request->validate([
            'file' => ['required','file','mimetypes:video/*,image/*','max:512000'], // ~500MB
            'type' => ['required','in:video,image']
        ]);
        $path = $request->file('file')->store("org_media/{$page->id}", 'public');
        $media = OrgMediaAsset::create([
            'org_page_id' => $page->id,
            'type' => $request->input('type'),
            'storage_path' => $path,
            'duration' => $request->input('duration', null),
            'captions_path' => null,
            'safety_labels' => [],
            'status' => 'uploaded'
        ]);
        // TODO: dispatch job -> transcode + captions + safety scan
        return response()->json($media, 201);
    }
}
