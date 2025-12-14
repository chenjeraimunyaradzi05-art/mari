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
        Schema::table('candidates', function (Blueprint $table) {
            // Remove fields
            if (Schema::hasColumn('candidates', 'gender')) {
                $table->dropColumn('gender');
            }
            if (Schema::hasColumn('candidates', 'website')) {
                $table->dropColumn('website');
            }

            // Make nullable: profile_picture, cv (resume)
            if (Schema::hasColumn('candidates', 'image')) {
                $table->text('image')->nullable()->change();
            }
            if (Schema::hasColumn('candidates', 'cv')) {
                $table->text('cv')->nullable()->change();
            }

            // Add new fields
            $table->foreignId('pronoun_id')->nullable()->after('birth_date')->constrained('pronouns')->nullOnDelete();
            $table->string('mobile', 20)->nullable()->after('pronoun_id');
            $table->foreignId('ethnicity_id')->nullable()->after('mobile')->constrained('ethnicities')->nullOnDelete();
            $table->foreignId('driver_license_type_id')->nullable()->after('ethnicity_id')->constrained('driver_license_types')->nullOnDelete();
            $table->unsignedTinyInteger('number_of_kids')->nullable()->after('driver_license_type_id');
            $table->foreignId('marital_status_id')->nullable()->after('number_of_kids')->constrained('marital_statuses')->nullOnDelete();

            // Career Aspirations
            $table->text('dream_job')->nullable()->after('marital_status_id');
            $table->foreignId('religion_id')->nullable()->after('dream_job')->constrained('religions')->nullOnDelete();

            // Work Preferences
            $table->boolean('willing_fifo')->default(false)->after('religion_id')->comment('Fly-In Fly-Out work');
            $table->boolean('willing_relocate')->default(false)->after('willing_fifo');
            $table->json('willing_government_service')->nullable()->after('willing_relocate')->comment('ABF, Police, Navy, Army, Mining, Oil Rigs');

            // Video Introductions (URLs to uploaded videos)
            $table->text('profile_video_url')->nullable()->after('willing_government_service')->comment('Professional introduction video - max 15 min');
            $table->json('profile_video_analysis')->nullable()->after('profile_video_url')->comment('AI analysis of professional video');
            $table->text('personality_video_url')->nullable()->after('profile_video_analysis')->comment('Personality showcase video - max 15 min');
            $table->json('personality_video_analysis')->nullable()->after('personality_video_url')->comment('AI analysis: hobbies, music, shows, food, personality traits');

            // Video metadata
            $table->timestamp('profile_video_uploaded_at')->nullable()->after('personality_video_analysis');
            $table->timestamp('personality_video_uploaded_at')->nullable()->after('profile_video_uploaded_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            // Remove new columns
            $table->dropForeign(['pronoun_id']);
            $table->dropForeign(['ethnicity_id']);
            $table->dropForeign(['driver_license_type_id']);
            $table->dropForeign(['marital_status_id']);
            $table->dropForeign(['religion_id']);

            $table->dropColumn([
                'pronoun_id',
                'mobile',
                'ethnicity_id',
                'driver_license_type_id',
                'number_of_kids',
                'marital_status_id',
                'dream_job',
                'religion_id',
                'willing_fifo',
                'willing_relocate',
                'willing_government_service',
                'profile_video_url',
                'profile_video_analysis',
                'personality_video_url',
                'personality_video_analysis',
                'profile_video_uploaded_at',
                'personality_video_uploaded_at',
            ]);

            // Restore removed fields
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->string('website')->nullable();
        });
    }
};
