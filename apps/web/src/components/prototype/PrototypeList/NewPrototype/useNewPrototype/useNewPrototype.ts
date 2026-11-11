import { valibotResolver } from "@hookform/resolvers/valibot";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type UseFormRegisterReturn, useController, useForm } from "react-hook-form";
import * as v from "valibot";
import {
  type ApiFailure,
  type PrototypeKind,
  apiSchemas,
  getListPrototypesQueryKey,
  useCreatePrototype,
} from "@/lib/api";
import { toastError } from "@/lib/ui/toast";

const { entries } = apiSchemas.CreatePrototypeBody;

/** The API's rules for a new prototype, checked after the text is trimmed as the API does. */
const formSchema = v.object({
  title: v.pipe(v.string(), v.trim(), entries.title),
  question: v.pipe(v.string(), v.trim(), entries.question),
  kind: entries.kind,
});

type FormInput = v.InferInput<typeof formSchema>;
type FormOutput = v.InferOutput<typeof formSchema>;

const emptyForm: FormInput = { title: "", question: "", kind: "mechanic" };

export type NewPrototype = {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: UseFormRegisterReturn<"title">;
  question: UseFormRegisterReturn<"question">;
  kind: { value: PrototypeKind; choose: (kind: PrototypeKind) => void };
  /** Which fields break the API's rules, after a submit was tried. */
  invalid: { title: boolean; question: boolean };
  submit: () => void;
  pending: boolean;
};

/**
 * A form in a modal that creates a prototype. On success the modal closes, the form empties,
 * and the list is fetched again; on failure a toast says why and the form keeps its text.
 */
export function useNewPrototype(): NewPrototype {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: valibotResolver(formSchema),
    defaultValues: emptyForm,
  });
  const kind = useController({ control: form.control, name: "kind" });
  const create = useCreatePrototype({
    mutation: {
      onSuccess: async () => {
        setOpen(false);
        form.reset(emptyForm);
        await queryClient.invalidateQueries({ queryKey: getListPrototypesQueryKey() });
      },
      onError: (error) => toastError(failureText(error.failure)),
    },
  });
  const { errors } = form.formState;

  return {
    open,
    setOpen,
    title: form.register("title"),
    question: form.register("question"),
    kind: { value: kind.field.value, choose: kind.field.onChange },
    invalid: { title: errors.title !== undefined, question: errors.question !== undefined },
    submit: () => void form.handleSubmit((data) => create.mutate({ data }))(),
    pending: create.isPending,
  };
}

function failureText(failure: ApiFailure): string {
  if (failure.kind === "unreachable") return "API に接続できず、プロトタイプを作れませんでした";
  if (failure.kind === "rejected" && failure.status === 401) {
    return "サインインが切れています。サインインし直してください";
  }
  return "プロトタイプを作れませんでした";
}
