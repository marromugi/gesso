import { Link } from "@tanstack/react-router";
import { apiFailureText } from "@/lib/ui/apiFailureText";
import { NewPrototype } from "./NewPrototype";
import { usePrototypeList } from "./usePrototypeList";

/** The signed-in person's prototypes, with a way to make a new one. */
export function PrototypeList() {
  const list = usePrototypeList();

  if (list.state === "loading") return <output>プロトタイプを読み込んでいます…</output>;
  if (list.state === "signedOut") {
    return <p>サインインすると、プロトタイプを作って一覧で見られます。</p>;
  }
  if (list.state === "failed") {
    return <output>プロトタイプを読み込めません（{apiFailureText(list.failure)}）</output>;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">プロトタイプ</h2>
        <NewPrototype />
      </div>
      {list.prototypes.length === 0 ? (
        <p className="opacity-70">まだプロトタイプがありません。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.prototypes.map((prototype) => (
            <li key={prototype.id}>
              <Link
                to="/prototypes/$prototypeId"
                params={{ prototypeId: prototype.id }}
                className="block rounded-container border border-edge bg-surface-raised font-semibold container-p-4 hover:border-accent"
              >
                {prototype.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
