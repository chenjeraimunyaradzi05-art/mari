<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Frontend\JobCreateRequest;
use App\Models\AppliedJob;
use App\Models\Benefits;
use App\Models\City;
use App\Models\Company;
use App\Models\Country;
use App\Models\Education;
use App\Models\Experience;
use App\Models\Job;
use App\Models\JobBenefits;
use App\Models\JobCategory;
use App\Models\JobRole;
use App\Models\JobSkills;
use App\Models\JobTag;
use App\Models\JobType;
use App\Models\SalaryType;
use App\Models\Skill;
use App\Models\State;
use App\Models\Tag;
use App\Services\Notify;
use App\Traits\Searchable;
use App\Support\EmployerAccessGate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class jobController extends Controller
{
    use Searchable;
    /**
     * Display a listing of the resource.
     */
    public function index(): \Illuminate\Contracts\View\View
    {
        $companyId = EmployerAccessGate::resolveCompanyId();

        $query = Job::query()
            ->where('company_id', $companyId)
            ->withCount('applications');

        $this->search($query, ['title', 'slug']);

        $jobs = $query->orderByDesc('id')->paginate(20);
        return view('frontend.company-dashboard.job.index', compact('jobs'));
    }

    function applications(string $id) : View {
        $job = EmployerAccessGate::ensureJobAccess((int) $id);

        $applications = AppliedJob::query()
            ->where('job_id', $job->getKey())
            ->latest()
            ->paginate(20);

        $jobTitle = $job;

        return view('frontend.company-dashboard.applications.index', compact('applications', 'jobTitle'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create() : View|RedirectResponse
    {
        EmployerAccessGate::resolveCompanyId();
        storePlanInformation();
        $userPlan = session('user_plan');
        $jobLimit = data_get($userPlan, 'job_limit', 0);
        if($jobLimit < 1) {
            Notify::errorNotification('You have reached your plan limit please upgrade your plan');
            return to_route('company.jobs.index');
        }

        $companies = Company::where(['profile_completion' => 1, 'visibility' => 1])->get();
        $categories = JobCategory::all();
        $countries = Country::all();
        $salaryTypes = SalaryType::all();
        $experiences = Experience::all();
        $jobRoles = JobRole::all();
        $educations = Education::all();
        $jobTypes = JobType::all();
        $tags = Tag::all();
        $skills = Skill::all();
        return view('frontend.company-dashboard.job.create', compact(
            'companies',
            'categories',
            'countries',
            'salaryTypes',
            'experiences',
            'jobRoles',
            'educations',
            'jobTypes',
            'tags',
            'skills'
        ));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(JobCreateRequest $request) : RedirectResponse
    {
        $featuredLimit = data_get(session('user_plan'), 'featured_job_limit', 0);
        if($featuredLimit < 1) {
            Notify::errorNotification('You have reached your Featured job limit please upgrade your plan');
            return redirect()->back();
        }
        $highlightLimit = data_get(session('user_plan'), 'highlight_job_limit', 0);
        if($highlightLimit < 1) {
            Notify::errorNotification('You have reached your Highlight job limit please upgrade your plan');
            return redirect()->back();
        }

        $companyId = EmployerAccessGate::resolveCompanyId();
        $company = auth()->user()?->company;

        $job = new Job();
        $job->title = $request->title;
        $job->company_id = $companyId;
        $job->job_category_id = $request->category;
        $job->vacancies = $request->vacancies;
        $job->deadline = $request->deadline;

        $job->country_id = $request->country;
        $job->state_id = $request->state;
        $job->city_id = $request->city;
        $job->address = $request->address;

        $job->salary_mode = $request->salary_mode;
        $job->min_salary = $request->min_salary;
        $job->max_salary = $request->max_salary;
        $job->custom_salary = $request->custom_salary;
        $job->salary_type_id = $request->salary_type;
        $job->job_experience_id = $request->experience;
        $job->job_role_id = $request->job_role;
        $job->education_id = $request->education;
        $job->job_type_id = $request->job_type;
        $job->job_type_id = $request->job_type;
        $job->featured = $request->featured;
        $job->highlight = $request->highlight;
        $job->description = $request->description;
        $job->save();

        // insert tags
        foreach($request->tags as $tag) {
            $createTag = new JobTag();
            $createTag->job_id = $job->id;
            $createTag->tag_id = $tag;
            $createTag->save();
        }

        $benefits = explode(',', $request->benefits);

        foreach($benefits as $benefit) {
            $createBenefit = new Benefits();
            $createBenefit->company_id = $job->company_id;
            $createBenefit->name = $benefit;
            $createBenefit->save();
            // store job benefit
            $jobBenefit = new JobBenefits();
            $jobBenefit->job_id = $job->id;
            $jobBenefit->benefit_id = $createBenefit->id;
            $jobBenefit->save();
        }

        // insert skills
        foreach($request->skills as $skill) {
            $createSkill = new JobSkills();
            $createSkill->job_id = $job->id;
            $createSkill->skill_id = $skill;
            $createSkill->save();
        }

        if($job && $company?->userPlan) {
            $userPlan = $company->userPlan;
            $userPlan->job_limit = max(0, $userPlan->job_limit - 1);
            if($job->featured == 1) {
                $userPlan->featured_job_limit = max(0, $userPlan->featured_job_limit - 1);
            }
            if($job->highlight == 1) {
                $userPlan->highlight_job_limit = max(0, $userPlan->highlight_job_limit - 1);
            }
            $userPlan->save();
            storePlanInformation();
        }

        Notify::createdNotification();

        return to_route('company.jobs.index');
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): void
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id): \Illuminate\Contracts\View\View
    {
        $job = EmployerAccessGate::ensureJobAccess((int) $id);
        $companies = Company::where(['profile_completion' => 1, 'visibility' => 1])->get();
        $categories = JobCategory::all();
        $countries = Country::all();
        $states = State::where('country_id', $job->country_id)->get();
        $cities = City::where('state_id', $job->state_id)->get();
        $salaryTypes = SalaryType::all();
        $experiences = Experience::all();
        $jobRoles = JobRole::all();
        $educations = Education::all();
        $jobTypes = JobType::all();
        $tags = Tag::all();
        $skills = Skill::all();
        return view('frontend.company-dashboard.job.edit', compact(
            'companies',
            'categories',
            'countries',
            'states',
            'cities',
            'salaryTypes',
            'experiences',
            'jobRoles',
            'educations',
            'jobTypes',
            'tags',
            'skills',
            'job'
        ));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(JobCreateRequest $request, string $id): RedirectResponse
    {
        $job = EmployerAccessGate::ensureJobAccess((int) $id);

        $job->title = $request->title;
        $job->job_category_id = $request->category;
        $job->vacancies = $request->vacancies;
        $job->deadline = $request->deadline;

        $job->country_id = $request->country;
        $job->state_id = $request->state;
        $job->city_id = $request->city;
        $job->address = $request->address;

        $job->salary_mode = $request->salary_mode;
        $job->min_salary = $request->min_salary;
        $job->max_salary = $request->max_salary;
        $job->custom_salary = $request->custom_salary;
        $job->salary_type_id = $request->salary_type;
        $job->job_experience_id = $request->experience;
        $job->job_role_id = $request->job_role;
        $job->education_id = $request->education;
        $job->job_type_id = $request->job_type;
        $job->job_type_id = $request->job_type;
        $job->featured = $request->featured;
        $job->highlight = $request->highlight;
        $job->description = $request->description;
        $job->save();

        // insert tags
        JobTag::where('job_id', $id)->delete();
        foreach($request->tags as $tag) {
            $createTag = new JobTag();
            $createTag->job_id = $job->id;
            $createTag->tag_id = $tag;
            $createTag->save();
        }

        $selectedBenefits = JobBenefits::where('job_id', $id);
        foreach($selectedBenefits->get() as $selectedBenefit) {
            Benefits::find($selectedBenefit->benefit_id)->delete();
        }
        $selectedBenefits->delete();

        $benefits = explode(',', $request->benefits);

        foreach($benefits as $benefit) {
            $createBenefit = new Benefits();
            $createBenefit->company_id = $job->company_id;
            $createBenefit->name = $benefit;
            $createBenefit->save();
            // store job benefit
            $jobBenefit = new JobBenefits();
            $jobBenefit->job_id = $job->id;
            $jobBenefit->benefit_id = $createBenefit->id;
            $jobBenefit->save();
        }

        // insert skills
        JobSkills::where('job_id', $id)->delete();
        foreach($request->skills as $skill) {
            $createSkill = new JobSkills();
            $createSkill->job_id = $job->id;
            $createSkill->skill_id = $skill;
            $createSkill->save();
        }

        Notify::createdNotification();

        return to_route('company.jobs.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): \Illuminate\Http\Response
    {
        try {
            $job = EmployerAccessGate::ensureJobAccess((int) $id);
            $job->delete();
            Notify::deletedNotification();
            return response(['message' => 'success'], 200);

        }catch(\Exception $e) {
            logger($e);
            return response(['message' => 'Something Went Wrong Please Try Again!'], 500);
        }
    }
}

