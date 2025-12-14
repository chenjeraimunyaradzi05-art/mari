<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->foreignId('social_profile_id')
                ->nullable()
                ->after('user_id')
                ->constrained('social_profiles')
                ->nullOnDelete();

            $table->unique('social_profile_id');
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropUnique('profiles_social_profile_id_unique');
            $table->dropConstrainedForeignId('social_profile_id');
        });
    }
};
