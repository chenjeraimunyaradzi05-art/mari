<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Org\OrganizationPageController;
use App\Http\Controllers\Org\OrgMediaController;
use App\Http\Controllers\Org\OrgPostController;
use App\Http\Controllers\Org\CourseController;
use App\Http\Controllers\Org\IntakeController;
use App\Http\Controllers\Org\AdCampaignController;
use App\Http\Controllers\Org\AdCreativeController;

Route::prefix('org')->group(function () {
    // Public
    Route::get('{slug}', [OrganizationPageController::class, 'show']);
    Route::get('{slug}/videos', [OrganizationPageController::class, 'videos']);
    Route::get('{slug}/courses', [OrganizationPageController::class, 'courses']);
    Route::get('{slug}/apprenticeships', [OrganizationPageController::class, 'apprenticeships']);
    Route::post('{slug}/lead', [OrganizationPageController::class, 'lead']);

    // Authenticated
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('{slug}/follow', [OrganizationPageController::class, 'follow']);
        Route::post('{slug}/invite', [OrganizationPageController::class, 'invite']);
        Route::post('{slug}/post', [OrgPostController::class, 'store']);
        Route::post('{slug}/media', [OrgMediaController::class, 'store']);
    });
});

Route::prefix('courses')->middleware('auth:sanctum')->group(function () {
    Route::post('/', [CourseController::class, 'store']);
    Route::put('{id}', [CourseController::class, 'update']);
    Route::delete('{id}', [CourseController::class, 'destroy']);
    Route::post('{id}/intakes', [IntakeController::class, 'store']);
});

Route::prefix('ads')->middleware('auth:sanctum')->group(function () {
    Route::post('campaigns', [AdCampaignController::class, 'store']);
    Route::get('campaigns/{id}/metrics', [AdCampaignController::class, 'metrics']);
    Route::post('creatives', [AdCreativeController::class, 'store']);
});
