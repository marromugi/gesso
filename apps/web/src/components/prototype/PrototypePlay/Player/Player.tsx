import { apiFailureText } from "@/lib/ui/apiFailureText";
import type { PlayerState } from "../usePrototypePlay";

const frameClass =
  "aspect-video w-full rounded-container border border-edge bg-surface-raised flex items-center justify-center p-4 text-center";

/** The version being played, or why nothing is. */
export function Player({ player, name }: { player: PlayerState; name: string }) {
  if (player.state === "playing") {
    return (
      <iframe
        // A new URL is a new game: start it from a fresh frame.
        key={player.url}
        src={player.url}
        title={`${name} 版 ${player.number}`}
        className="aspect-video w-full rounded-container border border-edge bg-black"
        // The play origin is not gesso's, so keeping its own origin gives the prototype nothing
        // of ours, and it needs one for localStorage and module scripts. The sandbox still keeps
        // it from navigating this page.
        // oxlint-disable-next-line react/iframe-missing-sandbox
        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        allow="fullscreen; gamepad; autoplay"
      />
    );
  }
  if (player.state === "noVersions") {
    return (
      <p className={frameClass}>まだ版がありません。Claude Code から版を送ると、ここで遊べます。</p>
    );
  }
  if (player.state === "missing") {
    return <p className={frameClass}>版 {player.number} はありません。</p>;
  }
  if (player.state === "failed") {
    return (
      <output className={frameClass}>
        版 {player.number} を開けません（{apiFailureText(player.failure)}）
      </output>
    );
  }
  return <output className={frameClass}>版 {player.number} を開いています…</output>;
}
