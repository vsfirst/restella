/** Next.js searchParams 값 하나를 문자열로 */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function intParam(value: string | string[] | undefined): number | undefined {
  const v = firstParam(value);
  if (!v || !/^\d+$/.test(v)) return undefined;
  return Number(v);
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
