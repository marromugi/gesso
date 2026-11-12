import { CliError } from "../cliError.ts";
import { deleteBearerSession, getMe } from "../generated/api.ts";
import type { Session } from "./request.ts";

/** The API's routes the CLI uses, as the signed-in person. */
export type ApiClient = {
  /** The signed-in person, or `null` when the API doesn't take the session. */
  me(): Promise<{ name: string } | null>;
  /** Ends the session, so its token stops working. */
  endSession(): Promise<void>;
};

/** Calls the API as `session`. Every method throws `CliError` when the API refuses the request. */
export function createApiClient(session: Session): ApiClient {
  const options = { session };
  return {
    async me() {
      const response = await getMe(options);
      if (response.status !== 200) throw refused("GET /me", response);
      return response.data.user;
    },
    async endSession() {
      const response = await deleteBearerSession(options);
      if (response.status !== 204) throw refused("DELETE /session", response);
    },
  };
}

function refused(what: string, response: { status: number; data: unknown }): CliError {
  return new CliError(
    `${what}: API が ${response.status} を返しました。${JSON.stringify(response.data) ?? ""}`,
  );
}
