"use client";

import { useActionState, useState } from "react";
import { type TestResult, testAiModel } from "./actions";

const input = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#4f8ff0]/70";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50";

// One real call with the typed model: output, time and cost side by side.
export function ModelTest({ defaults }: { defaults: { text: { provider: string; model: string }; voice: { model: string; template: string } } }) {
  const [kind, setKind] = useState<"text" | "voice">("text");
  const [result, action, pending] = useActionState<TestResult | null, FormData>(testAiModel, null);
  return (
    <form action={action} className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {(["text", "voice"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${kind === k ? "bg-[#0a66d6] text-white" : "bg-white/[0.06] text-zinc-300"}`}>
            {k === "text" ? "Script / director" : "Voice"}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      {kind === "text" && (
        <div className="grid gap-2 md:grid-cols-[140px_1fr]">
          <select key="p" name="provider" defaultValue={defaults.text.provider} className={input}>
            <option value="fal">fal</option>
            <option value="openai">OpenAI</option>
          </select>
          <input key="m" name="model" list="text-models" defaultValue={defaults.text.model} placeholder="google/gemini-2.5-flash" className={input} />
        </div>
      )}
      {kind === "voice" && (
        <>
          <input key="vm" name="model" list="voice-models" defaultValue={defaults.voice.model} placeholder="empty = the saved / environment model" className={input} />
          <textarea key="vt" name="template" rows={2} defaultValue={defaults.voice.template} placeholder='Input template, e.g. {"text":"{{text}}","voice":"{{voice}}"} (empty = saved / environment)' className={`${input} font-mono text-xs`} />
          <div className="grid gap-2 md:grid-cols-3">
            <select key="g" name="gender" defaultValue="female" className={input}>
              <option value="female">Female voice</option>
              <option value="male">Male voice</option>
            </select>
            <input key="vf" name="female" placeholder="Female voice name (optional)" className={input} />
            <input key="vmale" name="male" placeholder="Male voice name (optional)" className={input} />
          </div>
        </>
      )}
      <div className="flex items-center gap-3">
        <button className={btn} disabled={pending}>{pending ? "Testing…" : "Run a test call"}</button>
        <span className="text-xs text-zinc-500">One real, paid call.</span>
      </div>
      {result && (
        <div className={`rounded-lg border p-3 ${result.ok ? "border-emerald-400/20 bg-emerald-500/5" : "border-rose-400/20 bg-rose-500/5"}`}>
          <p className={result.ok ? "text-emerald-300" : "text-rose-300"}>
            {result.ok ? "Worked" : "Failed"}
            {result.ms !== undefined && <span className="text-zinc-400"> · {(result.ms / 1000).toFixed(1)} s</span>}
            {result.tokens && <span className="text-zinc-400"> · {result.tokens}</span>}
          </p>
          {result.cost && <p className="mt-1 text-zinc-300">Cost: {result.cost}</p>}
          {result.error && <p className="mt-1 break-words text-rose-200">{result.error}</p>}
          {result.output && <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-300">{result.output}</pre>}
          {result.audioUrl && <audio controls src={result.audioUrl} className="mt-2 w-full" />}
        </div>
      )}
    </form>
  );
}
