<?php

use App\Models\IncidentReport;
use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_message_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_message_id')->constrained('social_messages')->cascadeOnDelete();
            $table->foreignIdFor(SocialProfile::class, 'reporter_social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignIdFor(IncidentReport::class, 'incident_report_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 32)->default('open');
            $table->foreignIdFor(SocialProfile::class, 'resolved_by_social_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'resolved_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_message_reports');
    }
};
