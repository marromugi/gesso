import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { DeviceApproval } from "@/components/account/DeviceApproval";

/**
 * `?user_code=` is the code the CLI shows; the API's device sign-in links here with it. The
 * router reads a code of only digits as a number, so it is turned back into text.
 */
const DeviceSearch = v.object({
  user_code: v.fallback(
    v.optional(
      v.pipe(v.union([v.string(), v.number()]), v.transform(String), v.trim(), v.minLength(1)),
    ),
    undefined,
  ),
});

export const Route = createFileRoute("/device")({
  validateSearch: DeviceSearch,
  component: DeviceRoute,
});

function DeviceRoute() {
  const { user_code: userCode } = Route.useSearch();
  return <DeviceApproval userCode={userCode} />;
}
