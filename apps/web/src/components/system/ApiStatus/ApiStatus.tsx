import { type ApiHealth, useApiHealth } from "./useApiHealth";

export function ApiStatus() {
  const health = useApiHealth();
  return <output>{statusText(health)}</output>;
}

function statusText(health: ApiHealth): string {
  if (health.state === "checking") return "API を確認しています…";
  if (health.state === "ok") return "API に接続できました";
  return health.failure.kind === "unreachable"
    ? "API に接続できません"
    : `API がエラーを返しました（${health.failure.status}）`;
}
