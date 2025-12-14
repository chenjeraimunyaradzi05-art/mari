<?php

declare(strict_types=1);

use App\Models\GrantProgram;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('grant_applications', function (Blueprint $table): void {
            $table->id();
            $table->foreignIdFor(GrantProgram::class)->constrained()->cascadeOnDelete();
            $table->foreignIdFor(User::class)->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('draft');
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->unsignedBigInteger('funding_requested_cents')->default(0);
            $table->string('funding_use')->nullable();
            $table->text('project_summary')->nullable();
            $table->text('impact_statement')->nullable();
            $table->json('documents')->nullable();
            $table->boolean('ready_for_review')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->index(['grant_program_id', 'user_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grant_applications');
    }
};
