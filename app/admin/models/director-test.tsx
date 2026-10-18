"use client";

import { useActionState } from "react";
import { type DirectorTestResult, testDirector } from "./actions";

const input = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#4f8ff0]/70";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50";
const tone = (n: number) => (n >= 85 ? "text-emerald-300" : n >= 70 ? "text-amber-300" : "text-rose-300");

// The Director's test set: real scripts read by the typed model, every beat
// scored against a good reading — choose the model by its score.
export function DirectorTest({ defaults, reasonings }: { defaults: { model: string; reasoning: string; temperature: number | null }; reasonings: readonly string[] }) {
  const [result, action, pending] = useActionState<DirectorTestResult | null, FormData>(testDirector, null);
  const run = result?.run;
  return (
    <form action={action} className="flex flex-col gap-3 text-sm">
      <p className="text-zinc-400">10 real scripts (60 beats). Each beat scores 100 when the reading is right: the intent (30), the words shown (25), the key word (15), the things named (20), the number said (10).</p>
      <div className="grid gap-2 md:grid-cols-[1fr_140px_120px]">
        <input name="model" list="text-models" defaultValue={defaults.model} placeholder="google/gemini-2.5-flash" className={input} />
        <select name="reasoning" defaultValue={defaults.reasoning} className={input}>
          {reasonings.map((r) => (
            <option key={r} value={r}>{r === "default" ? "reasoning: default" : `reasoning: ${r}`}</option>
          ))}
        </select>
        <input name="temperature" defaultValue={defaults.temperature ?? ""} placeholder="temperature" className={input} />
      </div>
      <div className="flex items-center gap-3">
        <button className={btn} disabled={pending}>{pending ? "Reading 10 scripts…" : "Run the Director test"}</button>
        <span className="text-xs text-zinc-500">20 real, paid calls (the story and the beats, for 10 scripts) · about two minutes. A temperature is only sent with reasoning default or none.</span>
      </div>
      {result?.error && <p className="rounded-lg border border-rose-400/20 bg-rose-500/5 p-3 text-rose-200">{result.error}</p>}
      {run && (
        <div className="flex flex-col gap-3 rounded-lg border border-white/10 p-3">
          <p>
            <b className={`text-2xl ${tone(run.score)}`}>{run.score}</b>
            <span className="text-zinc-400"> / 100 · {run.model} · reasoning {run.reasoning}{run.temperature !== null ? ` · temperature ${run.temperature}` : ""} · {(run.ms / 1000).toFixed(0)} s · {result?.cost}</span>
          </p>
          <ul className="flex flex-col gap-2">
            {run.cases.map((c) => (
              <li key={c.id}>
                <details>
                  <summary className="cursor-pointer">
                    <b className={tone(c.score)}>{c.score}</b> <span className="text-zinc-200">{c.brand}</span> <span className="text-xs text-zinc-500">({(c.ms / 1000).toFixed(1)} s){c.error ? ` · ${c.error}` : ""}</span>
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1.5 border-l border-white/10 pl-3 text-xs">
                    {c.beats.map((b) => (
                      <li key={b.beat}>
                        <span className={tone(b.score)}>{b.score}</span> <span className="text-zinc-400">beat {b.beat}: “{b.said}”</span>
                        <br />
                        <span className="text-zinc-300">read: {b.got}</span>
                        {b.misses.length > 0 && <span className="text-amber-300/90"> — {b.misses.join("; ")}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
