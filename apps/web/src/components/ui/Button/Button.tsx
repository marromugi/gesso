import { button } from "./style.ts";
import type { ButtonProps } from "./type.ts";

export function Button({ tone, className, ...props }: ButtonProps) {
  return <button className={button({ tone, className })} {...props} />;
}
