<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('org_page_admins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role')->default('admin');
            $table->timestamps();
            $table->unique(['org_page_id','user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('org_page_admins');
    }
};
