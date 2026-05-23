import { AdminCard, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import {
  extendCourseWithAiLessons,
  generateAiCourseDraft,
} from "@/app/admin/courses/ai-actions";
import { getAiLearningConfig } from "@/lib/ai-learning-generator";
import { getAdminCourses, requireAdmin } from "@/lib/admin";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#087f5b] focus:ring-4 focus:ring-[#087f5b]/10";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function sharedFields() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Topic</span>
          <input className={fieldClasses()} name="topic" required placeholder="Everyday civic values" />
        </label>
        <label>
          <span className={labelClasses()}>Target audience</span>
          <input className={fieldClasses()} name="audience" required placeholder="Young adults, community learners" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label>
          <span className={labelClasses()}>Country/region</span>
          <input className={fieldClasses()} name="region" required placeholder="Nigeria" />
        </label>
        <label>
          <span className={labelClasses()}>Course level</span>
          <select className={fieldClasses()} defaultValue="beginner" name="difficulty">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label>
          <span className={labelClasses()}>Tone</span>
          <input className={fieldClasses()} defaultValue="practical and encouraging" name="tone" required />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Number of lessons</span>
          <input className={fieldClasses()} defaultValue={4} max={8} min={1} name="lessonCount" required type="number" />
        </label>
        <label>
          <span className={labelClasses()}>Questions per lesson</span>
          <input className={fieldClasses()} defaultValue={3} max={6} min={1} name="questionsPerLesson" required type="number" />
        </label>
      </div>

      <label className="block">
        <span className={labelClasses()}>Notes / source guidance</span>
        <textarea
          className={`${fieldClasses()} min-h-32 resize-none`}
          name="notes"
          placeholder="Add safe examples to include, references to stay close to, language constraints, or local context to consider."
        />
      </label>
    </>
  );
}

export default async function AdminAiCourseCreatorPage() {
  const config = getAiLearningConfig();
  const { supabase } = await requireAdmin();
  const courses = await getAdminCourses(supabase);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/courses"
        backLabel="Courses"
        eyebrow="Learning"
        title="AI Course Creator"
        subtitle="Create a new AI course or append AI lessons to an existing course, then review text before media and publishing."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <AdminCard>
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">Mode 1</p>
              <h2 className="mt-2 text-lg font-black">Create New AI Course</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Generates a brand-new course with lessons, quizzes, and media planning rows. Text review still comes first.
              </p>
            </div>

            <form action={generateAiCourseDraft} className="space-y-5">
              {sharedFields()}
              <button
                className="inline-flex items-center justify-center rounded-[14px] bg-[#087f5b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#066f4f]"
                type="submit"
              >
                Generate Course Draft
              </button>
            </form>
          </AdminCard>

          <AdminCard>
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">Mode 2</p>
              <h2 className="mt-2 text-lg font-black">Extend Existing Course</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Adds new draft lessons to an existing course. Existing lessons are preserved and the new AI work re-enters review.
              </p>
            </div>

            <form action={extendCourseWithAiLessons} className="space-y-5">
              <label className="block">
                <span className={labelClasses()}>Course to extend</span>
                <select className={fieldClasses()} name="courseId" required>
                  <option value="">Select an existing course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} ({course.status})
                    </option>
                  ))}
                </select>
              </label>

              {sharedFields()}

              <label className="block">
                <span className={labelClasses()}>Continuity instruction</span>
                <textarea
                  className={`${fieldClasses()} min-h-24 resize-none`}
                  name="continuityInstruction"
                  placeholder="Example: Add two follow-up lessons that deepen the fairness module without repeating the introductory content."
                />
              </label>

              <button
                className="inline-flex items-center justify-center rounded-[14px] bg-[#0d5f85] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0a4b69]"
                type="submit"
              >
                Add AI Lessons To Course
              </button>
            </form>
          </AdminCard>
        </div>

        <AdminCard className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">Workflow</p>
            <h2 className="mt-2 text-lg font-black">Human approval stays in control</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              AI can draft structure and lesson text, but it cannot publish. Text approval unlocks media. Media approval unlocks publishing.
            </p>
          </div>

          <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Server models</p>
            <p className="mt-2 text-sm font-black">{config.textModel}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
              Review model placeholder: {config.reviewModel}
            </p>
          </div>

          <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Environment</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              {config.hasApiKey
                ? "OPENAI_API_KEY is available for draft generation."
                : "OPENAI_API_KEY is not configured. Draft generation will fail until it is added to the server environment."}
            </p>
          </div>

          <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Existing courses</p>
            <div className="mt-3 space-y-3">
              {courses.length === 0 ? (
                <p className="text-sm font-semibold text-[var(--ve-muted)]">No courses available yet.</p>
              ) : (
                courses.slice(0, 8).map((course) => (
                  <div className="flex items-center justify-between gap-3" key={course.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{course.title}</p>
                      <p className="text-xs font-semibold text-[var(--ve-muted)]">{course.category}</p>
                    </div>
                    <AdminStatusBadge tone={course.ai_generated ? "good" : "neutral"}>
                      {course.ai_generated ? "AI workflow" : "Manual"}
                    </AdminStatusBadge>
                  </div>
                ))
              )}
            </div>
          </div>
        </AdminCard>
      </div>
    </>
  );
}
