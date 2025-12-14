<?php

use App\Enums\IdentityFlagStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('identity_flags')) {
            return;
        }

        Schema::create('identity_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('source', 50)->default('registration');
            $table->string('type', 50)->default('male_signal');
            $table->string('status', 30)->default(IdentityFlagStatus::Pending->value);
            $table->string('severity', 30)->default('medium');
            $table->decimal('score', 5, 2)->default(0);
            $table->string('reason')->nullable();
            $table->json('signals')->nullable();
            $table->json('metadata')->nullable();
            $table->json('actions_taken')->nullable();
            $table->timestamp('flagged_at')->nullable();
            $table->foreignId('resolved_by_admin_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'severity']);
            $table->index(['type', 'source']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('identity_flags');
    }
};
