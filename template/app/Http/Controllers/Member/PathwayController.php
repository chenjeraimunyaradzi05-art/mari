<?php

namespace App\Http\Controllers\Member;

use App\Http\Controllers\Controller;
use App\Models\Pathways\LifePathway;
use App\Models\Pathways\PathwayTemplate;
use App\Services\PathwayOrchestrator;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;

final class PathwayController extends Controller
{
    protected $orchestrator;

    public function __construct(PathwayOrchestrator $orchestrator)
    {
        $this->orchestrator = $orchestrator;
    }

    public function index(Request $request): View
    {
        $pathways = $this->orchestrator->getUserPathways($request->user());
        return view('member.pathways.index', compact('pathways'));
    }

    public function create(): View
    {
        $templates = PathwayTemplate::all();
        return view('member.pathways.create', compact('templates'));
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'goal' => 'required_without:template_id|string|nullable',
            'template_id' => 'required_without:goal|exists:pathway_templates,id|nullable',
        ]);

        $user = $request->user();
        $goal = $request->input('goal');
        $templateId = $request->input('template_id');

        if ($templateId) {
            $template = PathwayTemplate::find($templateId);
            // Pass the template name as the goal, the orchestrator will handle looking it up or using it
            $pathway = $this->orchestrator->createPathway($user, $template->template_name);
        } else {
            $pathway = $this->orchestrator->createPathway($user, $goal);
        }

        return redirect()->route('member.pathways.show', $pathway)
            ->with('success', 'Pathway created successfully!');
    }

    public function show(LifePathway $pathway): View
    {
        $this->authorize('view', $pathway);

        $pathway->load(['phases.milestones']);
        $progress = $this->orchestrator->calculateProgress($pathway);

        return view('member.pathways.show', compact('pathway', 'progress'));
    }
}

