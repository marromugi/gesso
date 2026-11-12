import { useId } from "react";
import { apiFailureText } from "@/lib/ui/apiFailureText";
import { useControlsGuide } from "./useControlsGuide";

/** How the version being played is played: each action's name and keys, from `controls.json`. */
export function ControlsGuide({ prototypeId, number }: { prototypeId: string; number: number }) {
  const headingId = useId();
  const guide = useControlsGuide(prototypeId, number);

  if (guide.state === "loading" || guide.state === "none") return null;
  if (guide.state === "failed") {
    return (
      <output className="text-sm opacity-70">
        操作を読めません（{apiFailureText(guide.failure)}）
      </output>
    );
  }
  if (guide.state === "invalid") {
    return (
      <output className="text-sm opacity-70">controls.json を読めません: {guide.problem}</output>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold">
        操作
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {guide.lines.map((line) => (
          <div key={line.id} className="contents">
            <dt>{line.label}</dt>
            <dd className="flex flex-wrap gap-1">
              {line.keys.map((key) => (
                <kbd
                  key={key.code}
                  className="rounded border border-edge bg-surface-raised px-1.5 font-mono text-xs"
                >
                  {key.label}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
