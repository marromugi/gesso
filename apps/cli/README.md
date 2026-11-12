# gesso CLI

エージェント（Claude Code など）が gesso に入るための CLI。今はサインインだけを持つ。リポジトリのルートで `pnpm gesso <コマンド>` として動かす（Node 24 が TypeScript をそのまま動かす。ビルドはない）。

```sh
pnpm gesso login    # ブラウザで承認してサインインする
pnpm gesso logout   # gesso のセッションを終え、サインインした情報を消す
```

## サインイン

- `login` は URL とコードを出す。gesso にサインインしたブラウザでその URL を開き、コードが同じか確かめて承認すると、CLI がサインインする。手元の開発サーバーに向けるときは `--api http://localhost:5173/api`。
- サインインした情報（API の URL とセッションのトークン）は `~/.config/gesso/credentials.json` に、持ち主だけが読める形で置く。セッションは使わないまま 7 日たつと切れる。
