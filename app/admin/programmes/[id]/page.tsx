import { notFound } from "next/navigation";
import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { ProgrammeEditorForm } from "@/components/admin/ProgrammeEditorForm";
import {
  getAdminAssessmentVersionOptions,
  getAdminCourses,
  getAdminMissions,
  getAdminOrganizations,
  getAdminProgramme,
  getAdminRewards,
  requireAdmin,
} from "@/lib/admin";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProgrammeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [assessmentVersions, courses, missions, organizations, programme, rewards] = await Promise.all([
    getAdminAssessmentVersionOptions(supabase),
    getAdminCourses(supabase),
    getAdminMissions(supabase),
    getAdminOrganizations(supabase),
    getAdminProgramme(supabase, id),
    getAdminRewards(supabase, { distributionMode: "direct" }),
  ]);
  const notice = firstSearchValue((await searchParams)?.notice);

  if (!programme) {
    notFound();
  }

  return (
    <>
      <AdminPageHeader
        backHref="/admin/programmes"
        backLabel="Programmes"
        eyebrow="Programmes"
        title={programme.title}
        subtitle="Manage the programme container, course sequence, reinforcement missions, rewards, assessment checkpoints and completion rules."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <ProgrammeEditorForm
        assessmentVersions={assessmentVersions}
        courses={courses}
        missions={missions}
        organizations={organizations}
        programme={programme}
        rewards={rewards}
      />
    </>
  );
}
