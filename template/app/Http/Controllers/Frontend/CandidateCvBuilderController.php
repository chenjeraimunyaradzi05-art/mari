<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\CandidateCV;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

final class CandidateCvBuilderController extends Controller
{
	/**
	 * Available templates key => label.
	 *
	 * @var array<string, string>
	 */
	protected array $templates = [
		'modern' => 'Modern',
		'classic' => 'Classic',
		'creative' => 'Creative',
		'minimal' => 'Minimal',
	];

	public function index(): Response
	{
		$candidate = $this->candidate();
		$cvs = $candidate->cvs()->latest('updated_at')->get();

		return response()->view('frontend.candidate-dashboard.cv-builder.index', compact('cvs'));
	}

	public function create(): Response
	{
		$candidate = $this->candidate()->load(['skills.skill', 'experiences', 'educations', 'languages.language', 'user', 'candidateCountry', 'candidateState', 'candidateCity']);
		$form = $this->buildCreateFormState($candidate);

		return response()->view('frontend.candidate-dashboard.cv-builder.create', [
			'form' => $form,
			'templates' => $this->templates,
		]);
	}

	public function store(Request $request): RedirectResponse
	{
		$candidate = $this->candidate();
		$data = $this->validatePayload($request);
		$payload = $this->preparePayload($candidate, $data);

		$cv = new CandidateCV($payload);
		$cv->candidate_id = $candidate->id;
		$cv->slug = CandidateCV::generateUniqueSlug($payload['title'] ?? 'cv');
		$cv->share_token = $cv->share_token ?: (string) Str::uuid();
		$cv->ats_score = $this->calculateAtsScore($payload);
		$cv->save();

		return redirect()
			->route('member.cv-builder.edit', $cv->slug)
			->with('success', 'CV created successfully.');
	}

	public function edit(CandidateCV $cv): Response
	{
		$candidate = $this->candidate();
		$this->authorizeCv($cv, $candidate);

		$form = $this->buildEditFormState($cv);

		return response()->view('frontend.candidate-dashboard.cv-builder.edit', [
			'cv' => $cv->loadMissing('member.user'),
			'form' => $form,
			'templates' => $this->templates,
		]);
	}

	public function update(Request $request, CandidateCV $cv): RedirectResponse
	{
		$candidate = $this->candidate();
		$this->authorizeCv($cv, $candidate);

		$data = $this->validatePayload($request);
		$payload = $this->preparePayload($candidate, $data);
		$payload['slug'] = CandidateCV::generateUniqueSlug($payload['title'] ?? $cv->title, $cv->id);
		$payload['ats_score'] = $this->calculateAtsScore($payload);

		$cv->fill($payload);
		$cv->save();

		return redirect()
			->route('member.cv-builder.edit', $cv->slug)
			->with('success', 'CV updated successfully.');
	}

	public function destroy(CandidateCV $cv): RedirectResponse
	{
		$candidate = $this->candidate();
		$this->authorizeCv($cv, $candidate);

		$cv->delete();

		return redirect()
			->route('member.cv-builder.index')
			->with('success', 'CV deleted successfully.');
	}

	public function toggleVisibility(CandidateCV $cv): RedirectResponse
	{
		$candidate = $this->candidate();
		$this->authorizeCv($cv, $candidate);

		$cv->is_public = ! $cv->is_public;
		if ($cv->is_public && empty($cv->share_token)) {
			$cv->share_token = (string) Str::uuid();
		}
		$cv->save();

		return back()->with('success', $cv->is_public ? 'CV is now public.' : 'CV is now private.');
	}

	public function createVersion(CandidateCV $cv): RedirectResponse
	{
		$candidate = $this->candidate();
		$this->authorizeCv($cv, $candidate);

		$newCv = $cv->replicate([
			'slug',
			'share_token',
			'view_count',
			'download_count',
			'share_count',
			'pdf_path',
			'pdf_generated_at',
		]);

		$newCv->title = $cv->title.' Copy';
		$newCv->slug = CandidateCV::generateUniqueSlug($newCv->title);
		$newCv->share_token = (string) Str::uuid();
		$newCv->version = ($cv->version ?? 1) + 1;
		$newCv->is_public = false;
		$newCv->view_count = 0;
		$newCv->download_count = 0;
		$newCv->share_count = 0;
		$newCv->ats_score = $this->calculateAtsScore($newCv->toArray());
		$newCv->save();

		return redirect()
			->route('member.cv-builder.edit', $newCv->slug)
			->with('success', 'CV duplicated.');
	}

	public function preview(CandidateCV $cv): Response
	{
		$candidate = $this->candidate();
		$this->authorizeCv($cv, $candidate);

		$cv->loadMissing('member.user');

		return response()->view('frontend.candidate-dashboard.cv-builder.preview', [
			'cv' => $cv,
			'template' => $this->templateView($cv->template),
		]);
	}

	public function download(CandidateCV $cv): Response
	{
		$candidate = $this->candidate();
		$this->authorizeCv($cv, $candidate);

		$cv->increment('download_count');
		$cv->loadMissing('member.user');

		$html = view($this->templateView($cv->template), ['cv' => $cv])->render();

		$filename = Str::slug($cv->title ?: 'cv').'.html';

		return response($html, 200, [
			'Content-Type' => 'text/html',
			'Content-Disposition' => 'attachment; filename="'.$filename.'"',
		]);
	}

	public function share(string $token): Response
	{
		$cv = CandidateCV::query()
			->where('share_token', $token)
			->where('is_public', true)
			->firstOrFail();

		$cv->increment('view_count');
		$cv->loadMissing('member.user');

		return response()->view('frontend.candidate-dashboard.cv-builder.share', [
			'cv' => $cv,
			'template' => $this->templateView($cv->template),
		]);
	}

	protected function validatePayload(Request $request): array
	{
		return $request->validate([
			'title' => ['required', 'string', 'max:255'],
			'template' => ['required', 'in:'.implode(',', array_keys($this->templates))],
			'professional_summary' => ['nullable', 'string'],
			'skills' => ['nullable', 'string'],
			'experience' => ['nullable', 'string'],
			'education' => ['nullable', 'string'],
			'certifications' => ['nullable', 'string'],
			'projects' => ['nullable', 'string'],
			'languages' => ['nullable', 'string'],
			'achievements' => ['nullable', 'string'],
			'custom_sections' => ['nullable', 'string'],
		]);
	}

	/**
	 * @return (array|mixed|null|string)[]
	 *
	 * @psalm-return array{title: mixed, template: mixed, professional_summary: mixed|null, skills: array, work_experience: array, education: array, certifications: array, projects: array, languages: array, achievements: array, custom_sections: array, email: string, phone: null|string, website: null|string, location: null|string}
	 */
	protected function preparePayload(Candidate $candidate, array $data): array
	{
		$payload = [
			'title' => $data['title'],
			'template' => $data['template'],
			'professional_summary' => $data['professional_summary'] ?? null,
			'skills' => $this->parseCommaSeparated($data['skills'] ?? ''),
			'work_experience' => $this->parseExperienceLines($data['experience'] ?? ''),
			'education' => $this->parseEducationLines($data['education'] ?? ''),
			'certifications' => $this->parseCertificationLines($data['certifications'] ?? ''),
			'projects' => $this->parseProjectLines($data['projects'] ?? ''),
			'languages' => $this->parseLanguageLines($data['languages'] ?? ''),
			'achievements' => $this->parseAchievements($data['achievements'] ?? ''),
			'custom_sections' => $this->parseCustomSections($data['custom_sections'] ?? ''),
			'email' => $candidate->email ?: optional($candidate->user)->email,
			'phone' => $candidate->phone_one ?: $candidate->phone_two,
			'website' => $candidate->website,
			'location' => $this->candidateLocation($candidate),
		];

		return $payload;
	}

	/**
	 * @return string[]
	 *
	 * @psalm-return array{title: string, template: 'modern', professional_summary: string, skills: string, experience: string, education: string, certifications: '', projects: '', languages: string, achievements: '', custom_sections: ''}
	 */
	protected function buildCreateFormState(Candidate $candidate): array
	{
		return [
			'title' => $candidate->full_name ? $candidate->full_name.' Resume' : 'My AI Resume',
			'template' => 'modern',
			'professional_summary' => $candidate->bio ?? '',
			'skills' => $candidate->skills
				->pluck('skill.name')
				->filter()
				->implode(', '),
			'experience' => $candidate->experiences
				->map(fn($exp) => $this->formatExperienceLine($exp->designation, $exp->company, $exp->start, $exp->end, $exp->responsibilities, $exp->currently_working))
				->filter()
				->implode(PHP_EOL),
			'education' => $candidate->educations
				->map(fn($edu) => $this->formatEducationLine($edu->degree, $edu->level, $edu->year))
				->filter()
				->implode(PHP_EOL),
			'certifications' => '',
			'projects' => '',
			'languages' => $candidate->languages
				->map(fn($lang) => optional($lang->language)->name)
				->filter()
				->implode(PHP_EOL),
			'achievements' => '',
			'custom_sections' => '',
		];
	}

	/**
	 * @return (null|string)[]
	 *
	 * @psalm-return array{title: string, template: string, professional_summary: null|string, skills: string, experience: string, education: string, certifications: string, projects: string, languages: string, achievements: string, custom_sections: string}
	 */
	protected function buildEditFormState(CandidateCV $cv): array
	{
		return [
			'title' => $cv->title,
			'template' => $cv->template,
			'professional_summary' => $cv->professional_summary,
			'skills' => implode(', ', $cv->all_skills),
			'experience' => collect($cv->work_experience ?? [])
				->map(fn($exp) => $this->formatExperienceLine($exp['position'] ?? null, $exp['company'] ?? null, $exp['start_date'] ?? null, $exp['end_date'] ?? null, $exp['description'] ?? null))
				->filter()
				->implode(PHP_EOL),
			'education' => collect($cv->education ?? [])
				->map(fn($edu) => $this->formatEducationLine($edu['degree'] ?? null, $edu['institution'] ?? null, $edu['year'] ?? null))
				->filter()
				->implode(PHP_EOL),
			'certifications' => collect($cv->certifications ?? [])
				->map(fn($cert) => $this->formatCertificationLine($cert))
				->filter()
				->implode(PHP_EOL),
			'projects' => collect($cv->projects ?? [])
				->map(fn($project) => $this->formatProjectLine($project))
				->filter()
				->implode(PHP_EOL),
			'languages' => collect($cv->languages ?? [])
				->map(fn($lang) => $this->formatLanguageLine($lang))
				->filter()
				->implode(PHP_EOL),
			'achievements' => collect($cv->achievements ?? [])->map(fn($achievement) => (string) $achievement)->implode(PHP_EOL),
			'custom_sections' => $this->formatCustomSections($cv->custom_sections ?? []),
		];
	}

	/**
	 * @return string[]
	 *
	 * @psalm-return array<int, string>
	 */
	protected function parseCommaSeparated(string $value): array
	{
		return collect(explode(',', $value))
			->map(fn($item) => trim($item))
			->filter()
			->values()
			->all();
	}

	/**
	 * @return (null|string)[][]
	 *
	 * @psalm-return array<int, array{position: null|string, company: null|string, start_date: null|string, end_date: null|string, description: null|string}>
	 */
	protected function parseExperienceLines(string $value): array
	{
		return collect(preg_split('/\r\n|\r|\n/', $value))
			->map(fn($line) => trim($line))
			->filter()
			->map(function (string $line) {
				$parts = array_map('trim', explode('|', $line));

				return [
					'position' => $parts[0] ?? null,
					'company' => $parts[1] ?? null,
					'start_date' => $parts[2] ?? null,
					'end_date' => $parts[3] ?? null,
					'description' => $parts[4] ?? null,
				];
			})
			->values()
			->all();
	}

	/**
	 * @return (null|string)[][]
	 *
	 * @psalm-return array<int, array{degree: null|string, institution: null|string, year: null|string}>
	 */
	protected function parseEducationLines(string $value): array
	{
		return collect(preg_split('/\r\n|\r|\n/', $value))
			->map(fn($line) => trim($line))
			->filter()
			->map(function (string $line) {
				$parts = array_map('trim', explode('|', $line));

				return [
					'degree' => $parts[0] ?? null,
					'institution' => $parts[1] ?? null,
					'year' => $parts[2] ?? null,
				];
			})
			->values()
			->all();
	}

	/**
	 * @return (null|string)[][]
	 *
	 * @psalm-return array<int, array{name: null|string, issuer: null|string, year: null|string}>
	 */
	protected function parseCertificationLines(string $value): array
	{
		return collect(preg_split('/\r\n|\r|\n/', $value))
			->map(fn($line) => trim($line))
			->filter()
			->map(function (string $line) {
				$parts = array_map('trim', explode('|', $line));

				return [
					'name' => $parts[0] ?? null,
					'issuer' => $parts[1] ?? null,
					'year' => $parts[2] ?? null,
				];
			})
			->values()
			->all();
	}

	/**
	 * @return (null|string)[][]
	 *
	 * @psalm-return array<int, array{name: null|string, description: null|string}>
	 */
	protected function parseProjectLines(string $value): array
	{
		return collect(preg_split('/\r\n|\r|\n/', $value))
			->map(fn($line) => trim($line))
			->filter()
			->map(function (string $line) {
				$parts = array_map('trim', explode('|', $line));

				return [
					'name' => $parts[0] ?? null,
					'description' => $parts[1] ?? null,
				];
			})
			->values()
			->all();
	}

	/**
	 * @return (null|string)[][]
	 *
	 * @psalm-return array<int, array{name: null|string, proficiency: null|string}>
	 */
	protected function parseLanguageLines(string $value): array
	{
		return collect(preg_split('/\r\n|\r|\n/', $value))
			->map(fn($line) => trim($line))
			->filter()
			->map(function (string $line) {
				$parts = array_map('trim', explode('|', $line));

				return [
					'name' => $parts[0] ?? null,
					'proficiency' => $parts[1] ?? null,
				];
			})
			->values()
			->all();
	}

	/**
	 * @return string[]
	 *
	 * @psalm-return array<int, string>
	 */
	protected function parseAchievements(string $value): array
	{
		return collect(preg_split('/\r\n|\r|\n/', $value))
			->map(fn($line) => trim($line))
			->filter()
			->values()
			->all();
	}

	/**
	 * @return string[][]
	 *
	 * @psalm-return array<string, list<string>>
	 */
	protected function parseCustomSections(string $value): array
	{
		if (trim($value) === '') {
			return [];
		}

		$sections = [];
		$current = null;

		foreach (preg_split('/\r\n|\r|\n/', $value) as $line) {
			$line = trim($line);

			if ($line === '') {
				continue;
			}

			if (str_ends_with($line, ':')) {
				$current = rtrim($line, ':');
				$sections[$current] = [];
				continue;
			}

			$text = $line;
			if (str_starts_with($text, '-')) {
				$text = ltrim(substr($text, 1));
			}

			if ($current === null) {
				$current = 'Additional Highlights';
				$sections[$current] = [];
			}

			$sections[$current][] = $text;
		}

		return $sections;
	}

	/**
	 * @param null|string $description
	 * @param false|int $current
	 */
	protected function formatExperienceLine(string $role, string $company, string $start, string $end, string|null $description = null, int|false $current = false): ?string
	{
		if (! $role && ! $company) {
			return null;
		}

		$startDate = $this->formatDate($start);
		$endDate = $current ? 'Present' : $this->formatDate($end);
		$parts = array_filter([
			$role,
			$company,
			$startDate,
			$endDate,
			$description,
		]);

		return implode(' | ', $parts);
	}

	protected function formatEducationLine(string $degree, string $institution, string $year): ?string
	{
		if (! $degree && ! $institution) {
			return null;
		}

		return implode(' | ', array_filter([$degree, $institution, $year]));
	}

	protected function formatCertificationLine(array $cert): string
	{
		return implode(' | ', array_filter([
			$cert['name'] ?? null,
			$cert['issuer'] ?? null,
			$cert['year'] ?? null,
		]));
	}

	protected function formatProjectLine(array $project): string
	{
		return implode(' | ', array_filter([
			$project['name'] ?? null,
			$project['description'] ?? null,
		]));
	}

	protected function formatLanguageLine(array $language): string
	{
		return implode(' | ', array_filter([
			$language['name'] ?? null,
			$language['proficiency'] ?? null,
		]));
	}

	protected function formatCustomSections(array $sections): string
	{
		if (empty($sections)) {
			return '';
		}

		return collect($sections)
			->map(function ($items, $title) {
				$lines = collect($items)->map(fn($item) => '- '.$item)->implode(PHP_EOL);
				return $title.':'.PHP_EOL.$lines;
			})
			->implode(PHP_EOL.PHP_EOL);
	}

	/**
	 * @psalm-return int<45, 100>
	 */
	protected function calculateAtsScore(array $payload): int
	{
		$score = 40;

		$score += min(count($payload['skills'] ?? []), 10) * 4;
		$score += min(count($payload['work_experience'] ?? []), 5) * 5;
		$score += min(count($payload['education'] ?? []), 3) * 5;

		if (! empty($payload['professional_summary'])) {
			$score += 10;
		}

		if (! empty($payload['projects'])) {
			$score += 5;
		}

		return (int) max(45, min(100, $score));
	}

	protected function candidateLocation(Candidate $candidate): ?string
	{
		$parts = collect([
			optional($candidate->candidateCity)->name,
			optional($candidate->candidateState)->name,
			optional($candidate->candidateCountry)->name,
		])
			->filter()
			->values();

		if ($parts->isEmpty() && $candidate->address) {
			return $candidate->address;
		}

		return $parts->isEmpty() ? null : $parts->implode(', ');
	}

	protected function templateView(string $template): string
	{
		$key = array_key_exists($template, $this->templates) ? $template : 'modern';

		return 'frontend.candidate-dashboard.cv-builder.templates.'.$key;
	}

	protected function candidate(): Candidate
	{
		return Candidate::query()
			->where('user_id', Auth::id())
			->firstOrFail();
	}

	protected function authorizeCv(CandidateCV $cv, Candidate $candidate): void
	{
		if ($cv->candidate_id !== $candidate->id) {
			abort(403);
		}
	}

	protected function formatDate(string $value): ?string
	{
		if (! $value) {
			return null;
		}

		try {
			return Carbon::parse($value)->format('Y-m');
		} catch (\Throwable $e) {
			return is_string($value) ? $value : null;
		}
	}
}


