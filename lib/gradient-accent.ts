const coverAccents = [
  "var(--ui-learning-bg), var(--ui-current-bg)",
  "var(--ui-support-bg), var(--ui-learning-bg)",
  "var(--ui-learning-bg), var(--ui-support-bg)",
  "var(--ui-mission-bg), var(--ui-reward-bg)",
  "var(--ui-current-bg), var(--ui-support-bg)",
];

export function coverAccent(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return coverAccents[hash % coverAccents.length];
}
