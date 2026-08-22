import { notFound } from "next/navigation";
import Link from "next/link";
import { submitOrganizationValuesAssessment } from "@/app/o/[organizationSlug]/assessments/actions";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";
import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { ValuesAssessmentFlow } from "@/components/onboarding/ValuesAssessmentFlow";
import {
  OrgBottomNav,
  OrgLearnerChrome,
} from "@/components/organizations/OrgLearnerMobile";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
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
  const { profile, supabase, user, workspace } = await requireOrgLearnerRoute(params);
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
  const myOrgsState = await getMyOrganizationState(supabase, user.id);

  return (
    <main className="learner-system orgs-learner min-h-screen">
      <OrgLearnerChrome
        active="Lessons"
        balance={workspace.xpAccount.balance}
        logoUrl={workspace.branding.logoUrl}
        organizationName={organizationName}
        organizationSlug={workspace.organizationSlug}
        pointsLabel={workspace.xpAccount.label}
        workspaceSwitcher={
          <LearnerWorkspaceSwitcher
            currentOrganizationSlug={workspace.organizationSlug}
            organizations={myOrgsState.organizations}
          />
        }
      />
      <section className="learner-page learner-page--standard org-assessment-page">
        <Link
          className="mb-4 inline-flex text-[0.72rem] font-semibold text-[var(--learner-green-deep)]"
          href={orgHref(workspace, "/learn")}
        >
          Return to Learning
        </Link>
        <ValuesAssessmentFlow
          action={submitOrganizationValuesAssessment}
          assessment={assessment}
          contextLabel={organizationName}
          errorMessage={errorMessage}
          heading={assessment.title}
          hiddenFields={[
            { name: "organizationSlug", value: workspace.organizationSlug },
            { name: "programmeId", value: programmeId },
          ]}
          introCopy={programmeAssessment.introduction_copy || assessment.introductionCopy || assessment.description}
          nextLabel="Next Question"
          preferredName={profile.display_name ?? null}
          unitLabel={workspace.xpAccount.label}
          variant="organization"
        />
      </section>
      <OrgBottomNav active="Lessons" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
