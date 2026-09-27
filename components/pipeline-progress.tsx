import { PIPELINE_STEPS, RENDER_WORKER_MESSAGE } from "@/lib/pipeline";

type Props = {
  status: string;
  step: string | null;
  error: string | null;
};

export function PipelineProgress({ status, step, error }: Props) {
  const current = PIPELINE_STEPS.findIndex((s) => s.key === step);
  const done = (i: number) => status === "completed" || (current >= 0 && i < current);
  const failedStep = PIPELINE_STEPS[current];

  return (
    <section className="flex flex-col gap-3 text-sm">
      <ol className="flex flex-col gap-1.5">
        {PIPELINE_STEPS.map((s, i) => {
          const state = done(i)
            ? "done"
            : i === current && status === "running"
              ? "active"
              : i === current && (status === "failed" || status === "needs_input")
                ? "failed"
                : i === current && status === "preview_ready"
                  ? "unavailable"
                  : "pending";
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  {
                    done: "bg-green-600",
                    active: "animate-pulse bg-blue-500",
                    failed: "bg-red-600",
                    unavailable: "bg-amber-500",
                    pending: "bg-foreground/20",
                  }[state]
                }`}
              />
              <span className={state === "pending" ? "text-foreground/50" : ""}>{s.label}</span>
            </li>
          );
        })}
        <li className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              status === "completed" ? "bg-green-600" : "bg-foreground/20"
            }`}
          />
          <span className={status === "completed" ? "" : "text-foreground/50"}>Complete</span>
        </li>
      </ol>

      {status === "idle" && (
        <p className="text-foreground/60">Video generation hasn&apos;t started for this project.</p>
      )}
      {status === "needs_input" && <p className="text-amber-600">{error}</p>}
      {status === "failed" && failedStep && (
        <div className="flex flex-col gap-1">
          <p className="text-red-600">{failedStep.error}</p>
          {error && <p className="text-xs text-foreground/60">Details: {error}</p>}
        </div>
      )}
      {status === "preview_ready" && (
        <p className="text-amber-600">
          Your video preview is ready. {error === RENDER_WORKER_MESSAGE ? `${error} ` : ""}
          The final MP4 isn&apos;t available in this environment yet.
        </p>
      )}
    </section>
  );
}
