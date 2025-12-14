<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('lead_notes', function (Blueprint $table) {
            $table->boolean('is_system')->default(false)->after('body');
            $table->json('metadata')->nullable()->after('is_system');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_notes', function (Blueprint $table) {
            $table->dropColumn(['is_system', 'metadata']);
        });
    }
};
