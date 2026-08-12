import Link from "next/link";
import { notFound } from "next/navigation";
import { submitOrganizationValuesAssessment } from "@/app/o/[organizationSlug]/assessments/actions";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ValuesAssessmentFlow } from "@/components/onboarding/ValuesAssessmentFlow";
import { getPublishedValuesAssessmentById } from "@/lib/values-assessment";

type OrgAssessmentRouteParams = Promise<{
  assessmentVersionId: string;
  organizationSlug: string;
}>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrganizationAssessmentPage({
  params,
  searchParams,
}: {
  params: OrgAssessmentRouteParams;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const { profile, supabase, workspace } = await requireOrgLearnerRoute(params);
  const programmeId = firstParam((await searchParams)?.programmeId)?.trim() ?? "";

  if (!programmeId || !workspace.programmeIds.includes(programmeId)) {
    notFound();
  }

  const { data: programmeAssessment, error: programmeAssessmentError } = await supabase
    .from("programme_assessments")
    .select("programme_id, assessment_version_id, introduction_copy")
    .eq("programme_id", programmeId)
    .eq("assessment_version_id", resolvedParams.assessmentVersionId)
    .maybeSingle();

  if (programmeAssessmentError) {
    throw programmeAssessmentError;
  }

  if (!programmeAssessment) {
    notFound();
  }

  const assessment = await getPublishedValuesAssessmentById(
    supabase,
    resolvedParams.assessmentVersionId,
  );

  if (!assessment) {
    notFound();
  }

  const paramsObject = (await searchParams) ?? {};
  const errorMessage = firstParam(paramsObject.error) ?? null;
  const organizationName = workspace.branding.shortName || workspace.branding.name;

  return (
    <main className="mobile-shell min-h-screen">
      <AppHeader
        title={`${organizationName} Assessment`}
        backHref={orgHref(workspace, "/learn")}
        showMenu={false}
      />
      <section className="learner-page learner-page--standard pb-28">
        <div className="mb-4">
          <Link className="text-sm font-black text-[var(--ve-green)]" href={orgHref(workspace, "/learn")}>
            Return to {organizationName} learning
          </Link>
        </div>
        <ValuesAssessmentFlow
          action={submitOrganizationValuesAssessment}
          assessment={assessment}
          errorMessage={errorMessage}
          heading={assessment.title}
          hiddenFields={[
            { name: "organizationSlug", value: workspace.organizationSlug },
            { name: "programmeId", value: programmeId },
          ]}
          introCopy={programmeAssessment.introduction_copy || assessment.introductionCopy || assessment.description}
          preferredName={profile.display_name ?? null}
        />
      </section>
      <BottomNav active="Lesson" />
    </main>
  );
}
