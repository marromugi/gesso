# gesso CLI

プロトタイプの版を、gesso と手元の git のリポジトリの間でやりとりする。Claude Code が版を取ってきて直し、commit したものを新しい版として送るためのもの。リポジトリのルートで `pnpm gesso <コマンド>` として動かす（Node 24 が TypeScript をそのまま動かす。ビルドはない）。フォルダーの指定は、コマンドを打った場所から見たもの。

```sh
pnpm gesso login                         # ブラウザで承認してサインインする
pnpm gesso list                          # 自分のプロトタイプの ID と名前
pnpm gesso versions <ID>                 # プロトタイプの版（新しい順、元の commit つき）
pnpm gesso pull <ID> <dir>               # いちばん新しい版を <dir> に取ってきて commit する
pnpm gesso pull <ID> <dir> --version 3   # 版 3 を取ってくる
pnpm gesso push <dir>                    # <dir> の最新の commit を次の版として送る
pnpm gesso logout                        # gesso のセッションを終え、サインインした情報を消す
```

## 流れ

1. `pull` で、空のフォルダー（なければ作る）を git のリポジトリにし、版のファイルを「gesso 版 N」として commit する。
2. 直して `git commit` する。ブランチは自由に使ってよい。
3. `push` で、今のブランチの最新の commit が次の版になる。版には commit とブランチ名が残る。

- 版になるのは commit した分だけ。commit していない変更があれば、そう知らせる。
- 最新の版と同じ commit、または同じファイルなら、版は作らない。
- リポジトリが取ってきた版より新しい版があると、`push` は送らない（そのまま送ると、新しい版の変更が抜ける）。`pull` で取り込んでから送るか、`--force` で送る。
- `pull` は、commit していない変更があるリポジトリや、別のプロトタイプのリポジトリには取ってこない。前の版にあって新しい版にないファイルは消して commit する。リンクの先には書かない。
- まだ版のないプロトタイプは、`pull` で空のリポジトリを用意し、`index.html` を置いて commit してから `push` すると版 1 ができる。
- どのプロトタイプの、どの版と同期したかは `.git/gesso.json` に置く（git の差分には出ない）。

## 版に入るもの

- commit したファイルのうち、ドットで始まらないもの（`.gitignore` や `.github/` は入らない）で、`node_modules` とリンクとサブモジュールを除いたもの。入れなかったファイルは `push` が知らせる。
- ルートに `index.html` が要る。1 ファイル 10 MiB、1 版 1000 ファイルまで。パスの決まりは API が確かめる（`apps/api/src/prototypes/versionFiles.ts`）。

## サインイン

- `login` は URL とコードを出す。gesso にサインインしたブラウザでその URL を開き、コードが同じか確かめて承認すると、CLI がサインインする。手元の開発サーバーに向けるときは `--api http://localhost:5173/api`。
- サインインした情報（API の URL とセッションのトークン）は `~/.config/gesso/credentials.json` に、持ち主だけが読める形で置く。セッションは使わないまま 7 日たつと切れる。
