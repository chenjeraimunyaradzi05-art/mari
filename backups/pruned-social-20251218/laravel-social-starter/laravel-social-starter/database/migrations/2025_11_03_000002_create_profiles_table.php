<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('organization_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->enum('type', ['candidate','trainee','provider','sole_trader','company','government']);
            $table->string('display_name');
            $table->string('handle')->unique();
            $table->text('bio')->nullable();
            $table->string('avatar_path')->nullable();
            $table->string('banner_path')->nullable();
            $table->json('links_json')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('profiles');
    }
};
