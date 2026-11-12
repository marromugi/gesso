# gesso CLI

プロトタイプの版を、gesso と手元の git のリポジトリの間でやりとりする。Claude Code が版を取ってきて直し、commit したものを新しい版として送るためのもの。リポジトリのルートで `pnpm gesso <コマンド>` として動かす（Node 24 が TypeScript をそのまま動かす。ビルドはない）。フォルダーの指定は、コマンドを打った場所から見たもの。

```sh
pnpm gesso login                         # ブラウザで承認してサインインする
pnpm gesso list                          # 自分のプロトタイプの ID と名前
pnpm gesso versions <ID>                 # プロトタイプの版（新しい順、元の commit つき）
pnpm gesso pull <ID> <dir>               # いちばん新しい版を <dir> の git に取り込む
pnpm gesso pull <ID> <dir> --version 3   # 版 3 を取ってくる
pnpm gesso push <dir>                    # <dir> の最新の commit を次の版として送る
pnpm gesso logout                        # gesso のセッションを終え、サインインした情報を消す
```

## 流れ

1. `pull` で、空のフォルダー（なければ作る）を git のリポジトリにし、版を取り込む。
2. 直して `git commit` する。ブランチは自由に使ってよい。
3. `push` で、今のブランチの最新の commit が次の版になる。版には commit とブランチ名が残る。

`pull` は `git pull` と同じ考え方で動く:

- 版は「gesso 版 N」という commit（作者は gesso）になり、前に同期した commit の上に積まれる。git の作業ツリーには触らずに作り、版の中身はそのままのバイトで入る（改行の変換を受けない）。
- それを今のブランチに取り込む。手元に新しい commit がなければ fast-forward、あれば merge する。手元の commit はそのまま残る。ぶつかったときは git の普通の merge と同じく印が入るので、直して commit してから `push` する。
- 版にないドットのファイル（`.gitignore` など）や `node_modules` は、前に同期した commit から引き継ぐ。
- commit していない変更があるリポジトリ、別のプロトタイプのリポジトリ、ほかのリポジトリの中のフォルダーには取り込まない。git が追っていない（無視している）ファイルが版のファイルと同じ場所にあるときも取り込まない。
- まだどのプロトタイプとも結びついていない、commit のあるリポジトリには、版を取り込まない（今のファイルとぶつかるため）。ただし版のないプロトタイプなら結びつけられる（ファイルには触らない）。

ほかに:

- 版になるのは commit した分だけ。commit していない変更や、まだ追っていないファイルがあれば、そう知らせる。
- 最新の版と同じファイルなら（同じ commit や、`pull` が作った commit のまま）、版は作らない。
- リポジトリが取り込んだ版より新しい版があると、`push` は送らない（そのまま送ると、新しい版の変更が抜ける）。`pull` で取り込んでから送るか、`--force` で送る。
- まだ版のないプロトタイプは、`pull` で空のリポジトリを用意し、`index.html` を置いて commit してから `push` すると版 1 ができる。
- どのプロトタイプの、どの版と同期したかは `.git/gesso.json` に置く（git の差分には出ない。worktree もこれを共有する）。

## 版に入るもの

- commit したファイルのうち、ドットで始まらないもの（`.gitignore` や `.github/` は入らない）で、`node_modules` とリンクとサブモジュールを除いたもの。入れなかったファイルは `push` が理由と一緒に知らせる。
- ルートに `index.html` が要る。1 ファイル 10 MiB、1 版 1000 ファイルまで。パスの決まりは API が確かめる（`apps/api/src/prototypes/versionFiles.ts`）。

## サインイン

- `login` は URL とコードを出す。gesso にサインインしたブラウザでその URL を開き、コードが同じか確かめて承認すると、CLI がサインインする。手元の開発サーバーに向けるときは `--api http://localhost:5173/api`。
- サインインした情報（API の URL とセッションのトークン）は `~/.config/gesso/credentials.json` に、持ち主だけが読める形で置く。セッションは使わないまま 7 日たつと切れる。
