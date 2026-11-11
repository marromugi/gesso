import { radio } from "./style.ts";
import type { RadioProps } from "./type.ts";

/** One choice among several with the same name, drawn with its own look and motion instead of the browser's. */
export function Radio({ label, ...props }: RadioProps) {
  const style = radio();

  return (
    <label className={style.root()}>
      <span className={style.circle()}>
        <input {...props} type="radio" className={style.input()} />
        <span aria-hidden className={style.dot()} />
      </span>
      {label}
    </label>
  );
}
