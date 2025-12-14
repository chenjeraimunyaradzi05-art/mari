<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('legal_documents', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignIdFor(User::class)->constrained()->cascadeOnDelete();
            $table->string('document_type');
            $table->string('status')->default('draft');
            $table->string('grant_pack')->nullable();
            $table->json('wizard_payload')->nullable();
            $table->json('metadata')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('preview_hash')->nullable();
            $table->string('context_token')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->index(['user_id', 'document_type']);
            $table->index('grant_pack');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legal_documents');
    }
};
