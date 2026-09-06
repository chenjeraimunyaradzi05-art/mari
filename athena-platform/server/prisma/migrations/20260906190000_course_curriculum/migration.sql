-- Courses can carry their own lessons: modules and lessons the provider's
-- team builds, per-learner lesson progress, and a certificate with a public
-- verification code once every lesson is done.
CREATE TYPE "CourseLessonType" AS ENUM ('VIDEO', 'ARTICLE', 'RESOURCE');

CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseModule_courseId_position_idx" ON "CourseModule"("courseId", "position");
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseLesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CourseLessonType" NOT NULL DEFAULT 'ARTICLE',
    "content" TEXT,
    "videoUrl" TEXT,
    "resourceUrl" TEXT,
    "durationMinutes" INTEGER,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseLesson_moduleId_position_idx" ON "CourseLesson"("moduleId", "position");
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LessonProgress_lessonId_userId_key" ON "LessonProgress"("lessonId", "userId");
CREATE INDEX "LessonProgress_userId_idx" ON "LessonProgress"("userId");
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseCertificate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseCertificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourseCertificate_code_key" ON "CourseCertificate"("code");
CREATE UNIQUE INDEX "CourseCertificate_courseId_userId_key" ON "CourseCertificate"("courseId", "userId");
CREATE INDEX "CourseCertificate_userId_idx" ON "CourseCertificate"("userId");
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
