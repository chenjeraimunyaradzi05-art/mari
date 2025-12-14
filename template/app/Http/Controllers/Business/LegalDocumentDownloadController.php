<?php

namespace App\Http\Controllers\Business;

use App\Http\Controllers\Controller;
use App\Models\LegalDocument;
use App\Services\Business\LegalDocumentLabService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class LegalDocumentDownloadController extends Controller
{
    public function __invoke(Request $request, LegalDocument $legalDocument, string $format, LegalDocumentLabService $service): StreamedResponse
    {
        $this->authorizeAccess($request, $legalDocument);

        $path = $service->export($legalDocument, $format);
        $disk = $service->disk();

        if (! $disk->exists($path)) {
            abort(404, 'Document not found');
        }

        return $disk->download($path, $legalDocument->filename($format));
    }

    private function authorizeAccess(Request $request, LegalDocument $document): void
    {
        if ($request->user()?->id !== $document->user_id) {
            abort(403, 'Document access denied');
        }
    }
}

