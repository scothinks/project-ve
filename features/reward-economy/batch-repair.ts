/** Describe supplied entries without exposing code values in diagnostic messages. */
export function describeBatchRepair(entries: string[], existing: Set<string>) {
  const seen = new Set<string>();
  const retained: string[] = [];
  const issues: string[] = [];
  entries.forEach((entry, index) => {
    const value = entry.trim();
    if (!value) return;
    if (existing.has(value))
      issues.push(`Entry ${index + 1}: already uploaded for this reward.`);
    else if (seen.has(value))
      issues.push(`Entry ${index + 1}: repeats an earlier entry.`);
    else retained.push(value);
    seen.add(value);
  });
  return { issues, retained };
}
