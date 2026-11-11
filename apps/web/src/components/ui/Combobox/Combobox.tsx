import { FloatingNode, FloatingPortal } from "@floating-ui/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useId, useState } from "react";
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent } from "react";

import { control } from "@/components/ui/Field";
import { CheckIcon, ChevronDownIcon, Icon } from "@/components/ui/Icon";
import { Nested } from "@/components/ui/Nested";
import { optionList, optionRow } from "@/components/ui/Options";
import { useDisclosure } from "@/hooks/common/useDisclosure";

import { matchOptions } from "./matchOptions";
import type { Option } from "./matchOptions";
import type { ComboboxProps } from "./type.ts";
import { useOptionPanel } from "./useOptionPanel";

/** How many matches the list draws at once; typing more narrows the rest. */
const MAX_ROWS = 100;

/**
 * One choice out of `options`, found by typing part of its name. The list
 * under the control narrows as the text changes; the arrow keys move through
 * it, Enter chooses, and Escape closes it. Only an option can be the value:
 * text typed but not chosen is dropped, and the list closes, when the control is left, and
 * clearing the text clears the choice.
 */
function ComboboxBody({
  label,
  options,
  value,
  onChange,
  placeholder = "入力して探す",
  empty = "見つかりません",
  disabled,
  focusOnMount = false,
}: ComboboxProps) {
  const id = useId();
  const chosen = options.find((option) => option.value === value);

  // What is being typed, or null while the control shows the choice.
  const [typed, setTyped] = useState<string | null>(null);
  const panel = useDisclosure(focusOnMount);
  const [active, setActive] = useState<number | null>(null);
  const matches = matchOptions(options, typed ?? "");
  const shown = matches.slice(0, MAX_ROWS);

  const close = () => {
    panel.close();
    setTyped(null);
    setActive(null);
  };
  const {
    nodeId,
    setRow,
    setControl,
    setPanel,
    panelStyles,
    getControlProps,
    getPanelProps,
    getRowProps,
  } = useOptionPanel({
    open: panel.isOpen,
    onOpenChange: (next) => (next ? panel.open() : close()),
    active,
    onNavigate: setActive,
  });
  const pick = (option: Option) => {
    onChange(option.value);
    close();
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="group/combobox relative" data-open={panel.isOpen ? "" : undefined}>
        <input
          ref={setControl}
          id={id}
          value={typed ?? chosen?.label ?? ""}
          placeholder={placeholder}
          disabled={disabled}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- only where the caller has just opened it
          autoFocus={focusOnMount}
          autoComplete="off"
          aria-autocomplete="list"
          className={control({ className: "pr-10" })}
          {...getControlProps({
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              setTyped(event.target.value);
              setActive(0);
              panel.open();
              if (event.target.value === "") onChange(null);
            },
            onClick: () => panel.open(),
            // Typing then replaces the choice instead of adding to its name.
            onFocus: (event: FocusEvent<HTMLInputElement>) => {
              if (focusOnMount) event.currentTarget.select();
            },
            onKeyDown: (event: KeyboardEvent) => {
              const option = active === null ? undefined : shown[active];
              if (event.key === "Enter" && panel.isOpen && option !== undefined) {
                event.preventDefault();
                pick(option);
              }
            },
            // Leaving the control, by Tab or otherwise, drops the typed text and closes the list.
            onBlur: () => {
              setTyped(null);
              panel.close();
            },
          })}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center transition duration-160 ease-out group-data-open/combobox:rotate-180">
          <Icon icon={ChevronDownIcon} />
        </span>
      </div>
      <FloatingNode id={nodeId}>
        <FloatingPortal>
          <MotionConfig reducedMotion="user">
            <AnimatePresence>
              {panel.isOpen ? (
                <div
                  ref={setPanel}
                  style={panelStyles}
                  className="z-30"
                  {...getPanelProps({
                    // Keeps the focus in the control while a row is pressed.
                    onMouseDown: (event: MouseEvent) => event.preventDefault(),
                  })}
                >
                  <motion.div
                    className={optionList({ className: "max-h-72 overflow-y-auto" })}
                    style={{ transformOrigin: "top left" }}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
                  >
                    {shown.length === 0 ? (
                      <p className="px-3 control-py-2 opacity-70">{empty}</p>
                    ) : (
                      shown.map((option, index) => (
                        <div
                          key={option.value}
                          ref={setRow(index)}
                          // An <option> element works only inside a <select>.
                          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                          role="option"
                          id={`${id}-option-${index}`}
                          aria-selected={index === active}
                          className={optionRow({ active: index === active ? "yes" : "no" })}
                          {...getRowProps({ onClick: () => pick(option) })}
                        >
                          {option.label}
                          {option.value === value ? <Icon icon={CheckIcon} /> : null}
                        </div>
                      ))
                    )}
                    {matches.length > shown.length ? (
                      <p className="px-3 control-py-2 text-sm opacity-70">
                        ほか {matches.length - shown.length} 件。入力して絞り込めます。
                      </p>
                    ) : null}
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>
          </MotionConfig>
        </FloatingPortal>
      </FloatingNode>
    </div>
  );
}

export function Combobox(props: ComboboxProps) {
  return (
    <Nested>
      <ComboboxBody {...props} />
    </Nested>
  );
}
