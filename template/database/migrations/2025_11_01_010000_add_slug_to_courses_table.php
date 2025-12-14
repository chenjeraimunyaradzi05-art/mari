<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (! Schema::hasColumn('courses', 'slug')) {
                $table->string('slug')->nullable()->after('title');
                $table->unique('slug');
            }
        });

        $this->backfillSlugs();
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (Schema::hasColumn('courses', 'slug')) {
                $table->dropUnique('courses_slug_unique');
                $table->dropColumn('slug');
            }
        });
    }

    private function backfillSlugs(): void
    {
        if (! Schema::hasColumn('courses', 'slug')) {
            return;
        }

        DB::table('courses')
            ->select(['id', 'title', 'slug'])
            ->orderBy('id')
            ->chunkById(100, function ($courses): void {
                foreach ($courses as $course) {
                    if (! empty($course->slug)) {
                        continue;
                    }

                    $base = Str::slug((string) $course->title) ?: 'course-'.$course->id;
                    $slug = $base;
                    $suffix = 1;

                    while (DB::table('courses')->where('slug', $slug)->where('id', '!=', $course->id)->exists()) {
                        $slug = $base.'-'.$suffix++;
                    }

                    DB::table('courses')
                        ->where('id', $course->id)
                        ->update(['slug' => $slug]);
                }
            });

        if (DB::getDriverName() === 'mysql') {
            DB::table('courses')
                ->whereNull('slug')
                ->update(['slug' => DB::raw("CONCAT('course-', id)")]);

            return;
        }

        DB::table('courses')
            ->whereNull('slug')
            ->select('id')
            ->orderBy('id')
            ->chunkById(100, function ($rows): void {
                foreach ($rows as $row) {
                    DB::table('courses')
                        ->where('id', $row->id)
                        ->update(['slug' => 'course-'.$row->id]);
                }
            });
    }
};
