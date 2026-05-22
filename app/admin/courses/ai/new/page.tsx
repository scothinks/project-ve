import { AdminCard, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { generateAiCourseDraft } from "@/app/admin/courses/ai-actions";
import { getAiLearningConfig } from "@/lib/ai-learning-generator";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#087f5b] focus:ring-4 focus:ring-[#087f5b]/10";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

export default function AdminAiCourseCreatorPage() {
  const config = getAiLearningConfig();

  return (
    <>
      <AdminPageHeader
        backHref="/admin/courses"
        backLabel="Courses"
        eyebrow="Learning"
        title="AI Course Creator"
        subtitle="Generate a structured draft, review the text, then unlock media and publishing in stages."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <form action={generateAiCourseDraft} className="space-y-5">
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

            <button
              className="inline-flex items-center justify-center rounded-[14px] bg-[#087f5b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#066f4f]"
              type="submit"
            >
              Generate Course Draft
            </button>
          </form>
        </AdminCard>

        <AdminCard className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">Workflow</p>
            <h2 className="mt-2 text-lg font-black">Human approval stays in control</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              AI can draft the structure and text, but it cannot publish. Text approval unlocks media work. Media approval unlocks publishing.
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
        </AdminCard>
      </div>
    </>
  );
}
