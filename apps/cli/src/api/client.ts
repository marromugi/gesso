import { CliError } from "../cliError.ts";
import {
  type PrototypeVersion,
  type VersionSource,
  createPrototypeVersion,
  deleteBearerSession,
  getMe,
  getPrototypeFileContent,
  getPrototypeVersion,
  listPrototypeVersions,
  listPrototypes,
  putPrototypeFileContent,
} from "../generated/api.ts";
import type { Session } from "./request.ts";

export type { PrototypeVersion, VersionSource };

export type Prototype = { id: string; name: string };

/** A file of a version: where it sits and the SHA-256 of its content. */
export type VersionFile = { path: string; hash: string };

export type CreateVersionResult =
  | { kind: "created"; number: number }
  | { kind: "missingContent"; hashes: string[] };

/** The API's routes the CLI uses, as the signed-in person. */
export type ApiClient = {
  /** The signed-in person, or `null` when the API doesn't take the session. */
  me(): Promise<{ name: string } | null>;
  /** Ends the session, so its token stops working. */
  endSession(): Promise<void>;
  listPrototypes(): Promise<Prototype[]>;
  /** Newest first. */
  listVersions(prototypeId: string): Promise<PrototypeVersion[]>;
  versionFiles(prototypeId: string, number: number): Promise<VersionFile[]>;
  readContent(prototypeId: string, hash: string): Promise<Uint8Array>;
  saveContent(prototypeId: string, hash: string, content: Uint8Array): Promise<void>;
  createVersion(
    prototypeId: string,
    files: VersionFile[],
    source: VersionSource,
  ): Promise<CreateVersionResult>;
};

const signInAgain = "サインインしていないか、期限が切れました。`pnpm gesso login` してください。";

/** The largest file the API takes, as its 413 says (`maxFileSize` in apps/api). */
const maxFileSizeText = "10 MiB";

/**
 * Calls the API as `session`. Every method throws `CliError` when the session isn't taken, the
 * prototype or version isn't the person's, or the API refuses the request; the message says
 * what to do.
 */
export function createApiClient(session: Session): ApiClient {
  const options = { session };
  return {
    async me() {
      const response = await getMe(options);
      return response.data.user;
    },
    async endSession() {
      const response = await deleteBearerSession(options);
      if (response.status !== 204) throw refused("DELETE /session", response);
    },
    async listPrototypes() {
      const response = await listPrototypes(options);
      if (response.status === 401) throw new CliError(signInAgain);
      return response.data.prototypes.map(({ id, name }) => ({ id, name }));
    },
    async listVersions(prototypeId) {
      const response = await listPrototypeVersions(prototypeId, options);
      if (response.status === 200) return response.data.versions;
      throw failure(response, prototypeId);
    },
    async versionFiles(prototypeId, number) {
      const response = await getPrototypeVersion(prototypeId, number, options);
      if (response.status === 200) {
        return response.data.files.map(({ path, hash }) => ({ path, hash }));
      }
      throw failure(response, `${prototypeId} の版 ${number}`);
    },
    async readContent(prototypeId, hash) {
      const response = await getPrototypeFileContent(prototypeId, hash, options);
      if (response.status === 200) return new Uint8Array(await response.data.arrayBuffer());
      throw failure(response, `${prototypeId} の中身 ${hash}`);
    },
    async saveContent(prototypeId, hash, content) {
      const response = await putPrototypeFileContent(prototypeId, hash, new Blob([content]), {
        ...options,
        headers: { "content-type": "application/octet-stream" },
      });
      if (response.status === 204) return;
      if (response.status === 413) {
        throw new CliError(
          `${content.byteLength} バイトのファイルは大きすぎて上げられません（1 ファイル ${maxFileSizeText} まで）。`,
        );
      }
      throw failure(response, prototypeId);
    },
    async createVersion(prototypeId, files, source) {
      const response = await createPrototypeVersion(prototypeId, { files, source }, options);
      if (response.status === 201) return { kind: "created", number: response.data.number };
      if (response.status === 409) {
        return { kind: "missingContent", hashes: response.data.hashes };
      }
      throw failure(response, prototypeId);
    },
  };
}

/** What a status other than the one a call was after means to the person. */
function failure(response: { status: number; data: unknown }, what: string): CliError {
  if (response.status === 401) return new CliError(signInAgain);
  if (response.status === 404) {
    return new CliError(`${what} が見つかりません（自分のプロトタイプだけが使えます）。`);
  }
  return refused(what, response);
}

function refused(what: string, response: { status: number; data: unknown }): CliError {
  return new CliError(
    `${what}: API が ${response.status} を返しました。${JSON.stringify(response.data) ?? ""}`,
  );
}
