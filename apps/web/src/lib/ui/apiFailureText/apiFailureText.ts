import type { ApiFailure } from "@/lib/api";

/** Why a call to the API failed, in words for the screen. */
export function apiFailureText(failure: ApiFailure): string {
  if (failure.kind === "unreachable") return "API に接続できません";
  if (failure.kind === "unreadable") return "API の応答を読み取れません";
  return `API がエラーを返しました: ${failure.status}`;
}
