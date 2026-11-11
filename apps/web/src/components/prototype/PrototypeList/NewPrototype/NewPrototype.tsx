import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { useNewPrototype } from "./useNewPrototype";

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
            label="名前"
            {...form.name}
            error={form.invalidName ? "1〜100 文字で入力してください" : undefined}
          />
          <Button type="submit" disabled={form.pending} className="self-end">
            作る
          </Button>
        </form>
      </Modal>
    </>
  );
}
