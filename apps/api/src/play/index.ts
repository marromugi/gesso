import { type PlayEnv, servePlay } from "./servePlay.ts";

/**
 * The play Worker (`wrangler.play.jsonc`): serves a version's files as they are, on an origin of
 * its own, so prototype code never runs where gesso's session is. A play token from the API
 * (`POST /prototypes/{id}/versions/{number}/play`) is the only way in.
 */
export default {
  fetch: (request, env) => servePlay(request, env),
} satisfies ExportedHandler<PlayEnv>;
