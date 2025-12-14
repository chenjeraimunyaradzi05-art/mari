<?php

namespace App\Http\Controllers\Business;

use App\Http\Controllers\Controller;
use App\Services\Business\FormationStudioService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class TemplateDownloadController extends Controller
{
    public function __construct(private readonly FormationStudioService $studio)
    {
    }

    public function index(): JsonResponse
    {
        $templates = collect($this->studio->templates())
            ->map(function (array $template) {
                return [
                    'slug' => $template['slug'],
                    'label' => $template['label'],
                    'jurisdiction' => $template['jurisdiction'],
                    'complexity' => $template['complexity'],
                    'updated_at' => $template['updated_at'],
                    'prerequisites' => $template['prerequisites'],
                    'download_url' => route('business.templates.download', $template['slug']),
                ];
            })
            ->values();

        return response()->json(['data' => $templates]);
    }

    public function download(Request $request, string $slug): BinaryFileResponse
    {
        $template = collect($this->studio->templates())
            ->firstWhere('slug', $slug);

        abort_unless((bool) $template, 404, 'Template not found.');

        $disk = Storage::disk('local');
        $path = Arr::get($template, 'path');

        abort_unless($path && $disk->exists($path), 404, 'Template file missing.');

        $extension = pathinfo($path, PATHINFO_EXTENSION);
        $filename = sprintf('%s-%s.%s',
            Str::slug($slug),
            now()->format('Ymd-His'),
            $extension ?: 'md'
        );

        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Athena-Disclaimer' => 'Educational information only – seek professional advice.',
        ];

        return response()->download($disk->path($path), $filename, $headers);
    }
}

