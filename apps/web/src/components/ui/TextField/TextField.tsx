import { useId } from "react";

import { control } from "@/components/ui/Field";

import type { TextFieldProps } from "./type.ts";

/** A labelled input, with its error under it. */
export function TextField({ label, error, ...props }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
        className={control({ state: error === undefined ? "default" : "error" })}
      />
      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
