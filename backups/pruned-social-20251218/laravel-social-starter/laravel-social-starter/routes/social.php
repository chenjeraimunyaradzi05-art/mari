<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Social\FeedController;
use App\Http\Controllers\Social\ProfileController;
use App\Http\Controllers\Social\PostController;
use App\Http\Controllers\Social\FollowController;
use App\Http\Controllers\Social\ReactionController;
use App\Http\Controllers\Social\CommentController;
use App\Http\Controllers\Social\AiAssistController;

Route::middleware(['web','auth'])->group(function () {
    Route::get('/feed', [FeedController::class,'index'])->name('feed');

    // Profiles
    Route::get('/p/{handle}', [ProfileController::class,'show'])->name('profile.show');
    Route::get('/p/{handle}/edit', [ProfileController::class,'edit'])->name('profile.edit');
    Route::post('/p/{handle}', [ProfileController::class,'update'])->name('profile.update');
    Route::post('/p/{handle}/follow', [FollowController::class,'follow'])->name('profile.follow');
    Route::delete('/p/{handle}/unfollow', [FollowController::class,'unfollow'])->name('profile.unfollow');

    // Posts
    Route::get('/compose', [PostController::class,'create'])->name('post.create');
    Route::post('/posts', [PostController::class,'store'])->name('post.store');
    Route::delete('/posts/{post}', [PostController::class,'destroy'])->name('post.destroy');

    // Reactions & Comments (AJAX)
    Route::post('/posts/{post}/react', [ReactionController::class,'store'])->name('reaction.store');
    Route::post('/posts/{post}/comment', [CommentController::class,'store'])->name('comment.store');

    // AI Assist
    Route::post('/ai/caption', [AiAssistController::class,'caption'])->name('ai.caption');
    Route::post('/ai/moderate', [AiAssistController::class,'moderate'])->name('ai.moderate');
    Route::post('/ai/tags', [AiAssistController::class,'tags'])->name('ai.tags');
});
