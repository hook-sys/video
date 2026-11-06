// Bangla words for the engine's rules (docs/video-spec.md, Bangla): which a
// line may not end on, which it may not start with, a word's stem (its case
// endings off), and the asks a video may end on.

// (NFC: "য়" "ড়" "ঢ়" are one letter and a nukta however they were typed — as in the width table)
export const bare = (t: string) => t.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "");

// (words that lead the next — and, or, but, this, that: never the last of a line)
const LEAD = new Set("ও এবং আর বা কিংবা অথবা কিন্তু তবে যে যা যদি এই সেই ওই এমন যেমন তাই তাহলে কারণ যখন তখন আপনার আমাদের তাদের তার একটি একটা কোন কোনো প্রতি প্রতিটি সব সকল".split(" "));
// (words that follow the one before — from, for, with, after, the particles: never the first of a line)
const TRAIL = new Set("থেকে জন্য দিয়ে নিয়ে সাথে সঙ্গে মধ্যে মাঝে পরে আগে উপর ওপর নিচে কাছে ভিতরে ভেতরে বাইরে পর্যন্ত মতো মত দ্বারা কর্তৃক তো".split(" "));
export const leadsBn = (t: string) => LEAD.has(bare(t));
export const trailsBn = (t: string) => TRAIL.has(bare(t));

// a word's stem: the plural and case endings off ("ডেলিভারির" → "ডেলিভারি", "অর্ডারগুলো" → "অর্ডার")
const ENDINGS = ["গুলোর", "গুলোকে", "গুলো", "গুলি", "দেরকে", "দের", "টির", "টার", "টিকে", "টাকে", "টি", "টা", "য়ের", "য়ে", "ের", "রা", "তে", "কে", "র", "ে", "য়"];
export function stemsBn(t: string): string[] {
  const w = bare(t);
  const out = [w];
  for (const e of ENDINGS) if (w.length > e.length + 1 && w.endsWith(e)) out.push(w.slice(0, -e.length));
  return out;
}

// The ask a Bangla video ends on: a short last sentence whose last word asks
// ("এখনই অর্ডার করুন", "আজই যোগাযোগ করুন", "লিংকে ক্লিক করুন")
const ASK_VERBS = new Set("করুন নিন দিন দেখুন জানুন কিনুন আসুন রাখুন পড়ুন শুনুন খুলুন লিখুন পাঠান জানান পান বুক ঘুরে".split(" "));
export const asksBn = (said: string[]) => said.length >= 2 && said.length <= 7 && ASK_VERBS.has(bare(said[said.length - 1]));

// Bangla digits ↔ ASCII (a number said is shown as written; counted in ASCII)
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const hasDigit = (t: string) => /[0-9০-৯]/.test(t);
export const toAscii = (t: string) => t.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
export const toBnDigits = (t: string) => t.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

// ── numbers said in words ("পাঁচ হাজার" → "৫,০০০", "পঞ্চাশ শতাংশ" → "৫০%") ──
// Only with a unit after them or a power of ten in them: "নয়" is nine and
// also "not", "এক" is one and also "a" — alone they are no number.
const ONES = "শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো তেরো চৌদ্দ পনেরো ষোলো সতেরো আঠারো উনিশ বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আটাশ উনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ উনচল্লিশ চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ উনপঞ্চাশ পঞ্চাশ একান্ন বাহান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন উনষাট ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি উনসত্তর সত্তর একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর উনআশি আশি একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি উননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই"
  .normalize("NFC")
  .split(" ");
const VALUE = new Map(ONES.map((w, i) => [w, i]));
const POWERS: Record<string, number> = { শো: 100, শ: 100, শত: 100, হাজার: 1000, লাখ: 100000, লক্ষ: 100000, কোটি: 10000000 };
// (a power written onto its number: "একশো", "দুইশো", "তিনশ")
const HUNDREDS = /^(.+?)(শো|শ)$/;
// what follows a number and is kept with it
const UNITS: Record<string, (n: string) => string> = { শতাংশ: (n) => `${n}%`, পার্সেন্ট: (n) => `${n}%`, টাকা: (n) => `৳${n}`, টাকার: (n) => `৳${n}`, জন: (n) => `${n} জন`, গুণ: (n) => `${n} গুণ`, দিন: (n) => `${n} দিন`, দিনে: (n) => `${n} দিনে`, ঘণ্টা: (n) => `${n} ঘণ্টা`, মিনিট: (n) => `${n} মিনিট`, মিনিটে: (n) => `${n} মিনিটে` };
const group = (n: number) => {
  // Bangla grouping: the last three, then twos (১২,৩৪,৫৬৭)
  const s = String(n);
  if (s.length <= 3) return s;
  const head = s.slice(0, -3), tail = s.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
};
// one word as a number part: a value, a power, or a value with its power written on ("একশো")
function partOf(w: string): { value?: number; power?: number } | null {
  if (VALUE.has(w)) return { value: VALUE.get(w)! };
  if (POWERS[w]) return { power: POWERS[w] };
  const h = HUNDREDS.exec(w);
  if (h && VALUE.has(h[1])) return { value: VALUE.get(h[1])! * 100 };
  return null;
}
// The first number said in words in these words, as digits, with its unit; null when none
export function numberInWords(words: string[]): string | null {
  const ws = words.map((w) => bare(w));
  for (let i = 0; i < ws.length; i++) {
    // ("পাঁচজন" — a number with জন on it)
    const glued = /^(.+?)(জন)$/.exec(ws[i]);
    const head = glued && VALUE.has(glued[1]) ? glued[1] : ws[i];
    if (!partOf(head)) continue;
    let total = 0, cur = 0, j = i, powered = false, last: number | "power" | null = null;
    for (; j < ws.length; j++) {
      const w = j === i ? head : ws[j];
      const p = partOf(w);
      // (a number after a number is another number — "পঁচিশ, পঞ্চাশ" — not one sum; a comma ends one too)
      // (but a smaller one after hundreds is part of it: "একশো বিশ")
      if (!p || (p.value != null && typeof last === "number" && !(last % 100 === 0 && p.value < 100)) || (j > i && /[,;।]$/.test(words[j - 1]))) break;
      last = p.value != null ? p.value : "power";
      if (p.value != null) {
        if (p.value >= 100) powered = true;
        cur += p.value;
      } else if (p.power) {
        powered = true;
        if (p.power === 100) cur = (cur || 1) * 100;
        else {
          total += (cur || 1) * p.power;
          cur = 0;
        }
      }
      if (j === i && glued && VALUE.has(glued[1])) {
        j++;
        break;
      }
    }
    total += cur;
    const unit = glued && VALUE.has(glued[1]) ? "জন" : ws[j];
    const make = unit ? UNITS[unit] : undefined;
    if (!make && !powered) continue;
    const digits = toBnDigits(group(total));
    return make ? make(digits) : digits;
  }
  return null;
}

// ── points: a script told as numbered points (docs/video-spec.md, Points) ──
// A point opens with its ordinal ("প্রথমত, …", "দ্বিতীয়ত …") or its number ("১.", "২)").
const ORDINALS = ["প্রথমত", "দ্বিতীয়ত", "তৃতীয়ত", "চতুর্থত", "পঞ্চমত", "ষষ্ঠত", "সপ্তমত", "অষ্টমত", "নবমত", "দশমত"].map((w) => w.normalize("NFC"));
export function ordinalOf(word: string): number | null {
  const w = bare(word);
  const k = ORDINALS.indexOf(w);
  if (k >= 0) return k + 1;
  // ("১." "২)" "3." — a number and a stop, alone)
  const m = /^([০-৯0-9]{1,2})[.)।:]$/.exec(word.trim());
  return m ? Number(toAscii(m[1])) : null;
}
// what ends the last point: the script's conclusion ("কারণ…", "মনে রাখবেন…", "সবশেষে…")
const CLOSES = new Set(["কারণ", "মনে", "সবশেষে", "সুতরাং", "অতএব", "শেষ", "তাই", "তাহলে"].map((w) => w.normalize("NFC")));
export const closesBn = (word: string) => CLOSES.has(bare(word));
// a count said ("চারটি বিষয়", "৫টি টিপস", "তিনটি উপায়") — the number of points promised
const COUNTED = /^(বিষয়|টিপস|টিপ|উপায়|ধাপ|কৌশল|ভুল|কারণ|পয়েন্ট|জিনিস|নিয়ম|সুবিধা)/;
export function countOf(words: string[]): number | null {
  for (let i = 0; i < words.length - 1; i++) {
    const w = bare(words[i]);
    const m = /^(.+?)(টি|টা)$/.exec(w);
    if (!m || !COUNTED.test(bare(words[i + 1]))) continue;
    const n = VALUE.get(m[1]) ?? (/^[০-৯0-9]+$/.test(m[1]) ? Number(toAscii(m[1])) : null);
    if (n && n >= 2 && n <= 9) return n;
  }
  return null;
}
