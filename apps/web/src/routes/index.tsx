import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <p>ゲームを作るための計画（ストーリー、シーン、アセット）を置く場所です。準備中です。</p>;
}
