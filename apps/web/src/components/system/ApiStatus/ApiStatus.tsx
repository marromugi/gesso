import { type ApiHealth, useApiHealth } from "./useApiHealth";

export function ApiStatus() {
  const health = useApiHealth();
  return <output>{statusText(health)}</output>;
}

function statusText(health: ApiHealth): string {
  if (health.state === "checking") return "API を確認しています…";
  if (health.state === "ok") return "API に接続できました";
  const { failure } = health;
  if (failure.kind === "unreachable") return "API に接続できません";
  if (failure.kind === "unreadable") return "API の応答を読み取れません";
  return `API がエラーを返しました（${failure.status}）`;
}
