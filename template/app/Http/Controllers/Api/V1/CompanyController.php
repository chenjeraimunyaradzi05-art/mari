<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\Request;

final class CompanyController extends Controller
{
    /**
     * List all companies with filters
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $query = Company::with([
            'organizationType:id,name',
            'industryType:id,name',
            'teamSize:id,name',
            'country:id,name',
            'state:id,name',
            'city:id,name'
        ])->where('visibility', 1);

        // Apply filters
        if ($request->has('industry_type_id')) {
            $query->where('industry_type_id', $request->industry_type_id);
        }

        if ($request->has('organization_type_id')) {
            $query->where('organization_type_id', $request->organization_type_id);
        }

        if ($request->has('team_size_id')) {
            $query->where('team_size_id', $request->team_size_id);
        }

        if ($request->has('country_id')) {
            $query->where('country_id', $request->country_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('bio', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->input('per_page', 15);
        $companies = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $companies
        ], 200);
    }

    /**
     * Get company details
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        $company = Company::with([
            'user:id,name,email',
            'organizationType:id,name',
            'industryType:id,name',
            'teamSize:id,name',
            'country:id,name',
            'state:id,name',
            'city:id,name'
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $company
        ], 200);
    }

    /**
     * Get company jobs
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function jobs($id)
    {
        $company = Company::findOrFail($id);

        $jobs = $company->jobs()
            ->with(['category:id,name,slug', 'jobType:id,name', 'salaryType:id,name'])
            ->where('status', 'active')
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $jobs
        ], 200);
    }
}

