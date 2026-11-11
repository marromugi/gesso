import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Radio } from "@/components/ui/Radio";
import { TextField } from "@/components/ui/TextField";
import type { PrototypeKind } from "@/lib/api";
import { prototypeKindLabels } from "@/lib/prototype";
import { useNewPrototype } from "./useNewPrototype";

const kinds: PrototypeKind[] = ["mechanic", "level"];

/** A button that opens a form for a new prototype. */
export function NewPrototype() {
  const form = useNewPrototype();

  return (
    <>
      <Button type="button" onClick={() => form.setOpen(true)}>
        新しいプロトタイプ
      </Button>
      <Modal title="新しいプロトタイプ" open={form.open} onOpenChange={form.setOpen}>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            form.submit();
          }}
        >
          <TextField
            label="タイトル"
            {...form.title}
            error={form.invalid.title ? "1〜100 文字で入力してください" : undefined}
          />
          <TextField
            label="何を確かめるか"
            {...form.question}
            error={form.invalid.question ? "1〜1000 文字で入力してください" : undefined}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">種類</legend>
            {kinds.map((kind) => (
              <Radio
                key={kind}
                name="kind"
                value={kind}
                label={prototypeKindLabels[kind]}
                checked={form.kind.value === kind}
                onChange={() => form.kind.choose(kind)}
              />
            ))}
          </fieldset>
          <Button type="submit" disabled={form.pending} className="self-end">
            作る
          </Button>
        </form>
      </Modal>
    </>
  );
}
