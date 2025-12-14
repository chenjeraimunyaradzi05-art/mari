<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\User;
use App\Services\ResumeParserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;

final class ResumeParserController extends Controller
{
	private const SESSION_KEY = 'resume_parser.preview';

	public function __construct(private ResumeParserService $parserService)
	{
	}

	public function index(): View
	{
		$this->resolveCandidateProfile();

		return view('frontend.candidates.resume-parser');
	}

	public function upload(Request $request): JsonResponse
	{
		$candidate = $this->resolveCandidateProfile();

		$validated = $request->validate([
			'resume' => 'required|file|max:5120|mimetypes:application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
		]);

		/** @var UploadedFile $file */
		$file = $validated['resume'];

		$path = $file->store('resume-parser/uploads');

		try {
			$parsed = $this->parserService->parse($file, $candidate);
		} catch (\Throwable $throwable) {
			Log::error('Resume parsing failed', [
				'name' => $file->getClientOriginalName(),
				'message' => $throwable->getMessage(),
			]);

			return response()->json([
				'status' => 'error',
				'error' => 'We could not parse this file. Please upload a different format or try again.',
			], 422);
		}

		session()->put(self::SESSION_KEY, [
			'path' => $path,
			'original_name' => $file->getClientOriginalName(),
			'size' => $file->getSize(),
			'mime_type' => $file->getMimeType(),
			'confidence' => $parsed['confidence'] ?? null,
			'parsed' => $parsed,
			'uploaded_at' => now(),
		]);

		return response()->json([
			'status' => 'success',
			'preview_url' => route('member.resume-parser.preview'),
		]);
	}

	public function preview(): View|RedirectResponse
	{
		$this->resolveCandidateProfile();

		$data = session()->get(self::SESSION_KEY);

		if (!$data) {
			return redirect()
				->route('member.resume-parser.index')
				->with('error', 'Your resume session has expired. Please upload the file again.');
		}

		return view('frontend.candidates.resume-preview', [
			'resume' => $data,
		]);
	}

	private function resolveCandidateProfile(): Candidate
	{
		/** @var User|null $user */
		$user = Auth::user();

		abort_unless($user, 403, 'You must be signed in.');

		if ($user->candidateProfile) {
			return $user->candidateProfile;
		}

		return $user->candidateProfile()->create([
			'full_name' => $user->name ?? 'Candidate ' . $user->id,
			'email' => $user->email,
		]);
	}

}


