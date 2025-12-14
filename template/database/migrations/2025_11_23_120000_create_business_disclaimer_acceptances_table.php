<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_disclaimer_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class)->nullable()->constrained()->cascadeOnDelete();
            $table->string('session_id')->nullable();
            $table->string('banner');
            $table->timestamp('dismissed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['banner', 'user_id']);
            $table->unique(['banner', 'session_id']);
            $table->index('dismissed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_disclaimer_acceptances');
    }
};
