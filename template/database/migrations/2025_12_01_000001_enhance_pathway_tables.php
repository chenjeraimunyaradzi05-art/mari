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
        // Update life_pathways table
        Schema::table('life_pathways', function (Blueprint $table) {
            if (!Schema::hasColumn('life_pathways', 'pathway_type')) {
                $table->enum('pathway_type', ['career', 'housing', 'business', 'education', 'money_stability', 'custom'])->nullable()->after('user_id');
            }
            if (!Schema::hasColumn('life_pathways', 'goal_title')) {
                $table->string('goal_title')->nullable()->after('pathway_type');
            }
            if (!Schema::hasColumn('life_pathways', 'goal_description')) {
                $table->text('goal_description')->nullable()->after('goal_title');
            }
            if (!Schema::hasColumn('life_pathways', 'target_completion_date')) {
                $table->date('target_completion_date')->nullable()->after('goal_description');
            }
            if (!Schema::hasColumn('life_pathways', 'current_phase')) {
                $table->integer('current_phase')->default(1)->after('status');
            }
            if (!Schema::hasColumn('life_pathways', 'total_phases')) {
                $table->integer('total_phases')->default(0)->after('current_phase');
            }
        });

        // Update pathway_phases table
        Schema::table('pathway_phases', function (Blueprint $table) {
            if (!Schema::hasColumn('pathway_phases', 'phase_number')) {
                $table->integer('phase_number')->nullable()->after('life_pathway_id');
            }
            if (!Schema::hasColumn('pathway_phases', 'phase_title')) {
                $table->string('phase_title')->nullable()->after('phase_number');
            }
            if (!Schema::hasColumn('pathway_phases', 'phase_description')) {
                $table->text('phase_description')->nullable()->after('phase_title');
            }
            if (!Schema::hasColumn('pathway_phases', 'status')) {
                 $table->enum('status', ['locked', 'active', 'completed', 'skipped'])->default('locked')->after('estimated_cost_aud');
            }
            if (!Schema::hasColumn('pathway_phases', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('status');
            }
            if (!Schema::hasColumn('pathway_phases', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('started_at');
            }
        });

        // Update pathway_milestones table
        Schema::table('pathway_milestones', function (Blueprint $table) {
            if (!Schema::hasColumn('pathway_milestones', 'milestone_type')) {
                $table->enum('milestone_type', ['action', 'submission', 'verification', 'payment', 'appointment'])->nullable()->after('pathway_phase_id');
            }
            if (!Schema::hasColumn('pathway_milestones', 'linkable_type')) {
                $table->nullableMorphs('linkable');
            }
            if (!Schema::hasColumn('pathway_milestones', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('status');
            }
            if (!Schema::hasColumn('pathway_milestones', 'evidence_data')) {
                $table->json('evidence_data')->nullable()->after('completed_at');
            }
            if (!Schema::hasColumn('pathway_milestones', 'due_date')) {
                $table->date('due_date')->nullable()->after('status');
            }
        });

        // Create new tables
        if (!Schema::hasTable('pathway_templates')) {
            Schema::create('pathway_templates', function (Blueprint $table) {
                $table->id();
                $table->string('pathway_type');
                $table->string('template_name');
                $table->text('description')->nullable();
                $table->text('target_audience')->nullable();
                $table->foreignId('partner_id')->nullable();
                $table->json('phases_json');
                $table->integer('usage_count')->default(0);
                $table->decimal('success_rate', 5, 2)->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('pathway_outcomes')) {
            Schema::create('pathway_outcomes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pathway_id')->constrained('life_pathways')->onDelete('cascade');
                $table->string('outcome_type');
                $table->decimal('outcome_value', 10, 2)->nullable();
                $table->text('outcome_description')->nullable();
                $table->timestamp('verified_at')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pathway_outcomes');
        Schema::dropIfExists('pathway_templates');

        if (Schema::hasTable('pathway_milestones')) {
            Schema::table('pathway_milestones', function (Blueprint $table) {
                $columns = ['milestone_type', 'linkable_type', 'linkable_id', 'evidence_data', 'due_date'];
                foreach ($columns as $column) {
                    if (Schema::hasColumn('pathway_milestones', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('pathway_phases')) {
            Schema::table('pathway_phases', function (Blueprint $table) {
                $columns = ['phase_number', 'phase_title', 'phase_description', 'status', 'started_at', 'completed_at'];
                foreach ($columns as $column) {
                    if (Schema::hasColumn('pathway_phases', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('life_pathways')) {
            Schema::table('life_pathways', function (Blueprint $table) {
                $columns = ['pathway_type', 'goal_title', 'goal_description', 'target_completion_date', 'current_phase', 'total_phases'];
                foreach ($columns as $column) {
                    if (Schema::hasColumn('life_pathways', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
