"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/app/projects/actions";
import {
  DIRECTION_MAX,
  DURATIONS,
  FORMATS,
  VOICE_LANGUAGES,
  VOICE_STYLES,
} from "@/lib/projects";

const field = "rounded-md border border-foreground/20 bg-transparent px-3 py-2";
const label = "flex flex-col gap-1.5 text-sm font-medium";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, {});
  const [direction, setDirection] = useState("");
  const [files, setFiles] = useState<string[]>([]);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <label className={label}>
        Website URL (optional)
        <input name="website_url" type="url" placeholder="https://example.com" className={field} />
      </label>

      <label className={label}>
        Screenshots
        <span className="flex flex-col items-center gap-1 rounded-md border border-dashed border-foreground/30 px-3 py-6 text-center font-normal text-foreground/70">
          Click to choose product screenshots (PNG, JPG, WebP)
          <span className="text-xs">Uploading is not enabled yet.</span>
          {files.length > 0 && <span className="text-xs">{files.join(", ")}</span>}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => setFiles(Array.from(e.target.files ?? [], (f) => f.name))}
        />
      </label>

      <label className={label}>
        Video direction
        <textarea
          name="direction"
          required
          rows={4}
          maxLength={DIRECTION_MAX}
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className={field}
        />
        <span className="self-end text-xs font-normal text-foreground/60">
          {direction.length}/{DIRECTION_MAX}
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select name="duration_seconds" title="Duration" options={DURATIONS} format={(d) => `${d} sec`} />
        <Select name="format" title="Format" options={FORMATS} />
        <Select name="voice_language" title="Voice language" options={VOICE_LANGUAGES} />
        <Select name="voice_style" title="Voice style" options={VOICE_STYLES} />
      </div>

      <button
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-2 font-medium text-background disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create Project"}
      </button>
    </form>
  );
}

function Select<T extends string | number>({
  name,
  title,
  options,
  format = String,
}: {
  name: string;
  title: string;
  options: readonly T[];
  format?: (value: T) => string;
}) {
  return (
    <label className={label}>
      {title}
      <select name={name} required className={field}>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
