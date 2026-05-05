/**
 * 해당 월에 적용할 유효 비율 반환
 * ratio_changes = { "4": 0.07 } 이면 4월~ 0.07 적용, 그 이전은 base ratio
 */
export function effectiveRatio(
  deal: { ratio: number; ratio_changes?: Record<string, number> | null },
  month: number
): number {
  const changes = deal.ratio_changes ?? {}
  const applicable = Object.keys(changes)
    .map(Number)
    .filter(k => k <= month)
  if (applicable.length === 0) return deal.ratio
  const latest = Math.max(...applicable)
  return changes[String(latest)]
}
