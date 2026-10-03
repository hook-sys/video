import type { Moments } from "../refs/beats";
import { type Role, ROLES } from "./looks";

// Where each part begins (frames): just before its first word.
export function partCuts(T: Moments): { role: Role; from: number }[] {
  const at: Record<Role, number> = { hook: 0, trio: T.sales - 6, reveal: T.flowly - 10, pay: T.when1 - 6, growth: T.when2 - 6, nomore: T.no1 - 6, cta: T.just - 6, end: T.end + 6 };
  return ROLES.map((role) => ({ role, from: at[role] }));
}
