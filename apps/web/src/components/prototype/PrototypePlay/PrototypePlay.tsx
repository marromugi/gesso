import { Link, Navigate } from "@tanstack/react-router";
import { apiFailureText } from "@/lib/ui/apiFailureText";
import { Player } from "./Player";
import { usePrototypePlay } from "./usePrototypePlay";

/** A prototype's versions, one of them playing; picking another plays that one. */
export function PrototypePlay({ prototypeId, version }: { prototypeId: string; version?: number }) {
  const play = usePrototypePlay(prototypeId, version);

  if (play.state === "loading") return <output>プロトタイプを読み込んでいます…</output>;
  if (play.state === "signedOut") return <p>サインインすると、プロトタイプを遊べます。</p>;
  if (play.state === "notFound") return <p>このプロトタイプは見つかりません。</p>;
  if (play.state === "failed") {
    return <output>プロトタイプを読み込めません（{apiFailureText(play.failure)}）</output>;
  }
  if (play.state === "openNewest") {
    return (
      <Navigate
        to="/prototypes/$prototypeId"
        params={{ prototypeId }}
        search={{ version: play.number }}
        replace
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Link to="/" className="opacity-70 hover:opacity-100">
          プロトタイプ
        </Link>
        <span className="opacity-40">/</span>
        <h2 className="text-lg font-semibold">{play.name}</h2>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <Player player={play.player} name={play.name} />
        </div>
        {play.versions.length > 0 ? (
          <nav aria-label="版" className="lg:w-56">
            <ul className="flex flex-col gap-1">
              {play.versions.map((item) => (
                <li key={item.number}>
                  <Link
                    to="/prototypes/$prototypeId"
                    params={{ prototypeId }}
                    search={{ version: item.number }}
                    aria-current={item.current ? "page" : undefined}
                    className="flex items-baseline justify-between gap-3 rounded-container px-3 py-2 hover:bg-surface-raised aria-[current=page]:bg-accent aria-[current=page]:text-on-accent"
                  >
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-sm opacity-70">{item.createdAt}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
