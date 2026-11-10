/**
 * The path the web app calls the API under (`VITE_API_BASE_URL` in `.env.production`). It is
 * removed before the request goes to the API Worker, as the dev server's proxy does.
 */
const apiPathPrefix = "/api";

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${apiPathPrefix}/`)) {
      throw new Error(
        `${url.pathname} reached the Worker, but assets.run_worker_first in wrangler.jsonc only sends ${apiPathPrefix}/* here`,
      );
    }
    url.pathname = url.pathname.slice(apiPathPrefix.length);
    return env.API.fetch(new Request(url, request));
  },
} satisfies ExportedHandler<Env>;
