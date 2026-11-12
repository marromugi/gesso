import { CliError } from "./cliError.ts";

/** Where the CLI talks to gesso: the API's base URL (the web app's origin plus `/api`). */
export const defaultApiUrl = "https://gesso-web.marrromugi-dev.workers.dev/api";

/** The client ID the API's device sign-in accepts (`cliClientId` in apps/api). */
export const cliClientId = "gesso-cli";

export type Fetch = typeof fetch;

export type Prototype = { id: string; name: string };
export type PrototypeVersion = { number: number; createdAt: string };
export type VersionFile = { path: string; hash: string };

export type CreateVersionResult =
  | { kind: "created"; number: number }
  | { kind: "missingContent"; hashes: string[] };

/** The API's routes the CLI uses, as the person signed in with `token`. */
export type ApiClient = {
  me(): Promise<{ name: string } | null>;
  listPrototypes(): Promise<Prototype[]>;
  listVersions(prototypeId: string): Promise<PrototypeVersion[]>;
  versionFiles(prototypeId: string, number: number): Promise<VersionFile[]>;
  readContent(prototypeId: string, hash: string): Promise<Uint8Array>;
  saveContent(prototypeId: string, hash: string, content: Uint8Array): Promise<void>;
  createVersion(prototypeId: string, files: VersionFile[]): Promise<CreateVersionResult>;
};

const signInAgain = "サインインしていないか、期限が切れました。`pnpm gesso login` してください。";

/**
 * Calls the API at `apiUrl` with `fetch`, sending `token` as `Authorization: Bearer`. Every
 * method throws `CliError` when the API can't be reached, the session isn't valid, or the
 * prototype or version isn't the person's.
 */
export function createApiClient(apiUrl: string, token: string, fetchFn: Fetch): ApiClient {
  async function send(method: string, path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    let response: Response;
    try {
      response = await fetchFn(`${apiUrl}${path}`, { ...init, method, headers });
    } catch (cause) {
      throw new CliError(`API（${apiUrl}）に接続できません。`, { cause });
    }
    if (response.status === 401) throw new CliError(signInAgain);
    return response;
  }

  async function json<T>(method: string, path: string, init?: RequestInit): Promise<T> {
    const response = await send(method, path, init);
    if (response.status === 404) throw notFound(path);
    if (!response.ok) throw await rejected(method, path, response);
    return bodyOf<T>(response);
  }

  return {
    async me() {
      const body = await json<{ user: { name: string } | null }>("GET", "/me");
      return body.user;
    },
    async listPrototypes() {
      const body = await json<{ prototypes: Prototype[] }>("GET", "/prototypes");
      return body.prototypes;
    },
    async listVersions(prototypeId) {
      const path = `/prototypes/${encodeURIComponent(prototypeId)}/versions`;
      const body = await json<{ versions: PrototypeVersion[] }>("GET", path);
      return body.versions;
    },
    async versionFiles(prototypeId, number) {
      const path = `/prototypes/${encodeURIComponent(prototypeId)}/versions/${number}`;
      const body = await json<{ files: VersionFile[] }>("GET", path);
      return body.files.map(({ path: filePath, hash }) => ({ path: filePath, hash }));
    },
    async readContent(prototypeId, hash) {
      const path = `/prototypes/${encodeURIComponent(prototypeId)}/files/${hash}`;
      const response = await send("GET", path);
      if (response.status === 404) throw notFound(path);
      if (!response.ok) throw await rejected("GET", path, response);
      return new Uint8Array(await response.arrayBuffer());
    },
    async saveContent(prototypeId, hash, content) {
      const path = `/prototypes/${encodeURIComponent(prototypeId)}/files/${hash}`;
      const response = await send("PUT", path, {
        headers: { "content-type": "application/octet-stream" },
        body: content,
      });
      if (response.status === 404) throw notFound(path);
      if (!response.ok) throw await rejected("PUT", path, response);
    },
    async createVersion(prototypeId, files) {
      const path = `/prototypes/${encodeURIComponent(prototypeId)}/versions`;
      const response = await send("POST", path, {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (response.status === 404) throw notFound(path);
      if (response.status === 409) {
        const body = await bodyOf<{ hashes: string[] }>(response);
        return { kind: "missingContent", hashes: body.hashes };
      }
      if (!response.ok) throw await rejected("POST", path, response);
      const body = await bodyOf<{ number: number }>(response);
      return { kind: "created", number: body.number };
    },
  };
}

/** The JSON body of a response, as the API's OpenAPI document (apps/api/openapi.json) gives it. */
async function bodyOf<T>(response: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await response.json()) as T;
}

function notFound(path: string): CliError {
  return new CliError(
    `${path} が見つかりません。プロトタイプの ID と版の番号を確かめてください（自分のプロトタイプだけが使えます）。`,
  );
}

async function rejected(method: string, path: string, response: Response): Promise<CliError> {
  const body = await response.text();
  return new CliError(`${method} ${path} が ${response.status} を返しました: ${body}`);
}
