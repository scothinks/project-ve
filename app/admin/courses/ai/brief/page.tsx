import { getCourseAvailability } from "@/features/ai-generation/authoring/course-availability";
import { AiCourseAuthoring } from "@/components/admin/ai/AiCourseAuthoring";
export default async function AiBriefPage({searchParams}:{searchParams:Promise<{aiResult?:string}>}) {
  const availability=await getCourseAvailability();
  const {aiResult}=await searchParams;
  return <AiCourseAuthoring key={aiResult??'new'} availability={availability} initialId={aiResult}/>;
}
