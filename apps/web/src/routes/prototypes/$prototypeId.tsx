import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { PrototypePlay } from "@/components/prototype/PrototypePlay";

/** `?version=N` picks the version to play; without it, or with something not a number, the newest. */
const PlaySearch = v.object({
  version: v.fallback(v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))), undefined),
});

export const Route = createFileRoute("/prototypes/$prototypeId")({
  validateSearch: PlaySearch,
  component: PlayRoute,
});

function PlayRoute() {
  const { prototypeId } = Route.useParams();
  const { version } = Route.useSearch();
  return <PrototypePlay prototypeId={prototypeId} version={version} />;
}
