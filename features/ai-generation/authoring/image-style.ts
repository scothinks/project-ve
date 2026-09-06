export const IMAGE_STYLES = [
  { id: 'photography', label: 'Photography', direction: 'Photographic image with natural light, believable materials and realistic detail.' },
  { id: 'realistic', label: 'Realistic illustration', direction: 'Drawn illustration with believable anatomy, dimensional shading and realistic materials.' },
  { id: 'flat', label: 'Flat illustration', direction: 'Flat vector-like illustration with simple shapes, clear silhouettes and minimal shading.' },
  { id: 'diagram', label: 'Diagram / infographic', direction: 'Precise instructional diagram with clear relationships, restrained symbols and minimal legible labels.' },
  { id: 'custom', label: 'Custom direction', direction: '' },
] as const;
export type ImageStyle = { preset: typeof IMAGE_STYLES[number]['id']; palette: string; direction: string };
export function resolveImageStyle(override: unknown, inherited: unknown): ImageStyle {
  const value = (override === 'inherit' ? inherited : override) as ImageStyle | null;
  if (!value || !IMAGE_STYLES.some(s => s.id === value.preset) || typeof value.palette !== 'string' || value.palette.length > 200
    || typeof value.direction !== 'string' || value.direction.length > 1000 || (value.preset === 'custom' && !value.direction.trim())) {
    throw new Error('Choose an image style and describe any custom direction.');
  }
  return { preset: value.preset, palette: value.palette.trim(), direction: value.direction.trim() };
}
export function imagePrompt(input: { brief: string; style: ImageStyle; aspectRatio: string }) {
  const style = resolveImageStyle(input.style, null);
  return ['Create one educational image.', `Instructional brief: ${input.brief}`, `Composition aspect ratio: ${input.aspectRatio}`,
    `Visual style: ${IMAGE_STYLES.find(s => s.id === style.preset)!.direction}`, style.palette && `Palette: ${style.palette}`,
    style.direction && `Look and feel: ${style.direction}`,
    'Keep the concept clear at mobile sizes. Keep key details within the crop. Only include text essential to understanding the concept.',
    'Represent people respectfully in the context of the brief. Safe, non-sexual and non-graphic content. Avoid party propaganda, logos and identifiable private people.',
  ].filter(Boolean).join('\n');
}

// Editable custom direction can be incomplete while autosaving. Generation uses
// the stricter resolver above; storing a draft never starts or charges a request.
export function imageStyleDraft(value: unknown): ImageStyle | 'inherit' | undefined {
  if (value === 'inherit') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const s = value as Partial<ImageStyle>;
  if (!IMAGE_STYLES.some(p => p.id === s.preset) || typeof s.palette !== 'string' || typeof s.direction !== 'string') return undefined;
  return { preset: s.preset!, palette: s.palette.slice(0, 200), direction: s.direction.slice(0, 1000) };
}
