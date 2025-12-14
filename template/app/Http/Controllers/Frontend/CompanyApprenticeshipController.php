<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\ApprenticeshipProgram;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class CompanyApprenticeshipController extends Controller
{
	public function __invoke(Request $request): View
	{
		$filters = [
			'location' => trim((string) $request->input('location', '')),
			'keyword' => trim((string) $request->input('keyword', '')),
			'max_duration' => $request->integer('max_duration'),
		];

		$programsQuery = ApprenticeshipProgram::query()
			->with(['page' => function ($query): void {
				$query->select('id', 'name', 'slug', 'tagline', 'safety_score', 'verification_status');
			}])
			->where('status', 'published');

		if ($filters['location'] !== '') {
			$programsQuery->where('location', 'like', '%'.$filters['location'].'%');
		}

		if ($filters['keyword'] !== '') {
			$programsQuery->where(function ($query) use ($filters) {
				$query
					->where('title', 'like', '%'.$filters['keyword'].'%')
					->orWhere('summary', 'like', '%'.$filters['keyword'].'%');
			});
		}

		if ($filters['max_duration']) {
			$programsQuery->where('duration_weeks', '<=', $filters['max_duration']);
		}

		$programs = $programsQuery
			->orderByDesc('published_at')
			->orderBy('title')
			->paginate(9)
			->withQueryString();

		$publishedPrograms = ApprenticeshipProgram::query()->where('status', 'published');
		$stats = [
			'active_partners' => (int) (clone $publishedPrograms)->distinct('org_page_id')->count('org_page_id'),
			'open_roles' => (int) (clone $publishedPrograms)->count(),
			'avg_duration' => (int) round((clone $publishedPrograms)->avg('duration_weeks') ?? 0),
		];

		$pathways = [
			[
				'title' => 'Civil & Infrastructure',
				'summary' => 'Tier-two projects, road upgrades, and regional renewables builds.',
				'slots' => 86,
				'regions' => ['QLD', 'NSW', 'NT'],
				'focus' => ['Traffic control', 'Formwork', 'Utility installs'],
			],
			[
				'title' => 'Mechanical & Advanced Manufacturing',
				'summary' => 'Toolmaking, mechatronics, and precision fabrication partnerships.',
				'slots' => 54,
				'regions' => ['VIC', 'SA'],
				'focus' => ['CNC', 'Programmable logic', 'Plant maintenance'],
			],
			[
				'title' => 'Community Housing & Care',
				'summary' => 'Retrofit social housing, community clinics, and mixed-care hubs.',
				'slots' => 41,
				'regions' => ['WA', 'NSW', 'TAS'],
				'focus' => ['Accessible fitouts', 'Solar installs', 'Aged care upgrades'],
			],
		];

		$subsidies = [
			[
				'title' => 'Women in Trades Wage Subsidy',
				'value' => '$10k per apprentice',
				'sponsor' => 'Dept. Employment & Workplace Relations',
				'status' => 'Open now',
				'summary' => 'Offset first-year wages for women entering mechanical, electrical, or civil trades.',
				'link' => 'https://www.dewr.gov.au/apprenticeships/women-trades',
			],
			[
				'title' => 'Regional Relocation Travel & Rent',
				'value' => 'Up to $6k in support',
				'sponsor' => 'State Skills Fund',
				'status' => 'Closes 30 Jun',
				'summary' => 'Supports apprentices relocating to remote projects or FIFO rotations.',
				'link' => 'https://business.gov.au/grants-and-programs',
			],
			[
				'title' => 'First Nations Pathways Mentor Pool',
				'value' => 'Mentor + $4k tooling',
				'sponsor' => 'Indigenous Business Australia',
				'status' => 'Expressions of interest',
				'summary' => 'Pair apprentices with funded mentors plus tooling grants for regional workshops.',
				'link' => 'https://iba.gov.au/',
			],
		];

		$aiContext = [
			'context' => 'career-placement-apprenticeships',
			'title' => 'Apprenticeship placement explainer',
			'guardrails' => 'Career planning and wage subsidy education only. Not migration or visa advice.',
		];

		return view('apprenticeships.index', [
			'programs' => $programs,
			'filters' => $filters,
			'stats' => $stats,
			'pathways' => $pathways,
			'subsidies' => $subsidies,
			'aiContext' => $aiContext,
		]);
	}
}

