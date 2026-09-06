const coverAccents = [
  "#2f8f6e, #6fa8ff",
  "#8d68f2, #2f8f6e",
  "#6fa8ff, #8d68f2",
  "#a7391e, #f1bf4f",
  "#2f8f6e, #8d68f2",
];

export function coverAccent(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return coverAccents[hash % coverAccents.length];
}
