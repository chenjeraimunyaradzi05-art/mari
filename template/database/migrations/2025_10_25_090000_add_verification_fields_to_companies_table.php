<?php

use App\Enums\CompanyVerificationStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (!Schema::hasColumn('companies', 'abn')) {
                $table->string('abn', 20)->nullable()->after('phone');
                $table->unique('abn', 'companies_abn_unique');
            }

            if (!Schema::hasColumn('companies', 'asic_number')) {
                $table->string('asic_number', 20)->nullable()->after('abn');
            }

            if (!Schema::hasColumn('companies', 'domain')) {
                $table->string('domain')->nullable()->after('website');
                $table->index('domain', 'companies_domain_index');
            }

            if (!Schema::hasColumn('companies', 'verification_status')) {
                $table->string('verification_status', 50)
                    ->default(CompanyVerificationStatus::Pending->value)
                    ->after('vision');
            }

            if (!Schema::hasColumn('companies', 'verification_submitted_at')) {
                $table->timestamp('verification_submitted_at')->nullable()->after('verification_status');
            }

            if (!Schema::hasColumn('companies', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('verification_submitted_at');
            }

            if (!Schema::hasColumn('companies', 'verification_admin_id')) {
                $table->foreignId('verification_admin_id')
                    ->nullable()
                    ->after('verified_at')
                    ->constrained('admins')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('companies', 'verification_notes')) {
                $table->text('verification_notes')->nullable()->after('verification_admin_id');
            }

            if (!Schema::hasColumn('companies', 'verification_payload')) {
                $table->json('verification_payload')->nullable()->after('verification_notes');
            }

            if (!Schema::hasColumn('companies', 'verification_source')) {
                $table->string('verification_source', 50)->default('dashboard')->after('verification_payload');
            }
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (Schema::hasColumn('companies', 'verification_source')) {
                $table->dropColumn('verification_source');
            }

            if (Schema::hasColumn('companies', 'verification_payload')) {
                $table->dropColumn('verification_payload');
            }

            if (Schema::hasColumn('companies', 'verification_notes')) {
                $table->dropColumn('verification_notes');
            }

            if (Schema::hasColumn('companies', 'verification_admin_id')) {
                $table->dropForeign(['verification_admin_id']);
                $table->dropColumn('verification_admin_id');
            }

            if (Schema::hasColumn('companies', 'verified_at')) {
                $table->dropColumn('verified_at');
            }

            if (Schema::hasColumn('companies', 'verification_submitted_at')) {
                $table->dropColumn('verification_submitted_at');
            }

            if (Schema::hasColumn('companies', 'verification_status')) {
                $table->dropColumn('verification_status');
            }

            if (Schema::hasColumn('companies', 'domain')) {
                $table->dropIndex('companies_domain_index');
                $table->dropColumn('domain');
            }

            if (Schema::hasColumn('companies', 'asic_number')) {
                $table->dropColumn('asic_number');
            }

            if (Schema::hasColumn('companies', 'abn')) {
                $table->dropUnique('companies_abn_unique');
                $table->dropColumn('abn');
            }
        });
    }
};
