import type { AuthoringResult, ApplicationReceipt } from './contracts';
import type { ImageStyle } from './image-style';
export type ImageTarget = { target: 'block' | 'page_cover' | 'lesson_thumbnail' | 'course_thumbnail' | 'course_cover'; targetId: string };
export type ImageSetup = { courseId: string; lessonId: string | null; revision: number; brief: string; aspectRatio: string; style: ImageStyle | 'inherit'; courseStyle: ImageStyle | null };
export type ImageResult = Omit<AuthoringResult, 'candidate'> & {
  image: ImageTarget & { brief: string; style: ImageStyle; aspectRatio: string; altText: string; caption: string };
  candidate: { title: string; versionId: string; url: string; altText: string; caption: string } | null;
};
export type ImageDraft = { resolveTarget?: (target: ImageTarget) => ImageTarget; beforeAction: () => Promise<number>; onApplied: (receipt: ApplicationReceipt) => void };
