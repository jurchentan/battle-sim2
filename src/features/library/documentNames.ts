export function uniqueName(preferred: string, existingNames: readonly string[]): string {
  if (!existingNames.includes(preferred)) return preferred;

  let suffix = 2;
  while (existingNames.includes(`${preferred} ${suffix}`)) {
    suffix += 1;
  }
  return `${preferred} ${suffix}`;
}

export function copyName(sourceName: string, existingNames: readonly string[]): string {
  return uniqueName(`${sourceName} copy`, existingNames);
}
