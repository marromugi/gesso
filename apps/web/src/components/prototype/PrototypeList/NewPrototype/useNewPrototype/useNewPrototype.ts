import { valibotResolver } from "@hookform/resolvers/valibot";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type UseFormRegisterReturn, useForm } from "react-hook-form";
import * as v from "valibot";
import {
  type ApiFailure,
  apiSchemas,
  getListPrototypesQueryKey,
  useCreatePrototype,
} from "@/lib/api";
import { toastError } from "@/lib/ui/toast";

/** The API's rules for a new prototype, checked after the text is trimmed as the API does. */
const formSchema = v.object({
  name: v.pipe(v.string(), v.trim(), apiSchemas.CreatePrototypeBody.entries.name),
});

type FormInput = v.InferInput<typeof formSchema>;
type FormOutput = v.InferOutput<typeof formSchema>;

const emptyForm: FormInput = { name: "" };

export type NewPrototype = {
  open: boolean;
  setOpen: (open: boolean) => void;
  name: UseFormRegisterReturn<"name">;
  /** Whether the name breaks the API's rules, after a submit was tried. */
  invalidName: boolean;
  submit: () => void;
  pending: boolean;
};

/**
 * A form in a modal that creates a prototype. On success the modal closes, the form empties,
 * and the list is fetched again; on failure a toast says why and the form keeps its text.
 */
export function useNewPrototype(): NewPrototype {
  const [open, setOpenState] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: valibotResolver(formSchema),
    defaultValues: emptyForm,
  });
  // Closing, by success or by the person, empties the form, so it opens again with no errors.
  const setOpen = (next: boolean) => {
    if (!next) form.reset(emptyForm);
    setOpenState(next);
  };
  const create = useCreatePrototype({
    mutation: {
      onSuccess: async () => {
        setOpen(false);
        await queryClient.invalidateQueries({ queryKey: getListPrototypesQueryKey() });
      },
      onError: async (error) => {
        toastError(failureText(error.failure));
        if (isSignedOut(error.failure)) {
          // The session ended, so what was fetched with it is dropped and fetched again. The
          // list then asks to sign in, and this form goes with it.
          await queryClient.resetQueries();
        }
      },
    },
  });

  return {
    open,
    setOpen,
    name: form.register("name"),
    invalidName: form.formState.errors.name !== undefined,
    submit: () => void form.handleSubmit((data) => create.mutate({ data }))(),
    pending: create.isPending,
  };
}

/** HTTP status the API answers with when the request carries no valid session. */
const unauthorizedStatus = 401;

function isSignedOut(failure: ApiFailure): boolean {
  return failure.kind === "rejected" && failure.status === unauthorizedStatus;
}

function failureText(failure: ApiFailure): string {
  if (failure.kind === "unreachable") return "API に接続できず、プロトタイプを作れませんでした";
  if (isSignedOut(failure)) return "サインインが切れています。サインインし直してください";
  return "プロトタイプを作れませんでした";
}
