import type { Block } from "../kit";
import type { Role } from "../looks";
import { CTA_BLOCKS } from "./cta";
import { END_BLOCKS } from "./end";
import { GROWTH_BLOCKS } from "./growth";
import { HOOK_BLOCKS } from "./hook";
import { NOMORE_BLOCKS } from "./nomore";
import { PAY_BLOCKS } from "./pay";
import { REVEAL_BLOCKS } from "./reveal";
import { TRIO_BLOCKS } from "./trio";

// Every block, by part. A video takes one block per part.
export const BLOCKS: Block[] = [...HOOK_BLOCKS, ...TRIO_BLOCKS, ...REVEAL_BLOCKS, ...PAY_BLOCKS, ...GROWTH_BLOCKS, ...NOMORE_BLOCKS, ...CTA_BLOCKS, ...END_BLOCKS];
export const BLOCK_BY_ID: Record<string, Block> = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));
export const blocksFor = (role: Role) => BLOCKS.filter((b) => b.role === role);
