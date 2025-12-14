<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('member_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Personal Details
            $table->string('resume_path')->nullable();
            $table->string('marital_status')->nullable();
            $table->string('children_details')->nullable(); // e.g. "2 kids"
            $table->string('religion')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('phone_number')->nullable();

            // Education & Career
            $table->string('education_level')->nullable();
            $table->text('qualifications')->nullable(); // JSON or text
            $table->string('dream_job')->nullable();
            $table->string('dream_qualification')->nullable();
            $table->string('dream_company')->nullable();

            // Life & Goals
            $table->text('life_inspiration')->nullable();
            $table->text('life_goals')->nullable();

            // Interests
            $table->text('favorite_music')->nullable();
            $table->text('hobbies')->nullable();
            $table->text('sporting_teams')->nullable();
            $table->text('outdoor_leisure')->nullable();

            // History (JSON for structured lists)
            $table->json('schools_attended')->nullable();
            $table->json('previous_experiences')->nullable();

            // Privacy Settings (JSON: { "field_name": "public|private|friends|recruiters" })
            $table->json('privacy_settings')->nullable();

            $table->timestamps();
        });

        Schema::create('member_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_profile_id')->constrained('member_profiles')->cascadeOnDelete();
            $table->string('file_path');
            $table->string('media_type'); // photo, video
            $table->string('caption')->nullable();
            $table->enum('privacy_level', ['public', 'private', 'friends', 'recruiters'])->default('private');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('member_media');
        Schema::dropIfExists('member_profiles');
    }
};
