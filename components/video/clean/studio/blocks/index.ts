import type { Block } from "../kit";
import { ROLES, type Role } from "../looks";
import { CTA_BLOCKS } from "./cta";
import { END_BLOCKS } from "./end";
import { GROWTH_BLOCKS } from "./growth";
import { HOOK_BLOCKS } from "./hook";
import { NOMORE_BLOCKS } from "./nomore";
import { PAY_BLOCKS } from "./pay";
import { R2_CLOSE } from "./r2-close";
import { R2_OPEN } from "./r2-open";
import { R3 } from "./r3";
import { REVEAL_BLOCKS } from "./reveal";
import { TRIO_BLOCKS } from "./trio";

// Every block, by part. A video takes one block per part.
// (part by part: the first set, then the second set's)
const ALL: Block[] = [...HOOK_BLOCKS, ...TRIO_BLOCKS, ...REVEAL_BLOCKS, ...PAY_BLOCKS, ...GROWTH_BLOCKS, ...NOMORE_BLOCKS, ...CTA_BLOCKS, ...END_BLOCKS, ...R2_OPEN, ...R2_CLOSE, ...R3];
export const BLOCKS: Block[] = ROLES.flatMap((r) => ALL.filter((b) => b.role === r));
export const BLOCK_BY_ID: Record<string, Block> = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));
export const blocksFor = (role: Role) => BLOCKS.filter((b) => b.role === role);
