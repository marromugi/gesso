# gesso CLI

プロトタイプの版を、gesso と手元の git のリポジトリの間でやりとりする。Claude Code が版を取ってきて直し、commit したものを新しい版として送るためのもの。リポジトリのルートで `pnpm gesso <コマンド>` として動かす（Node 24 が TypeScript をそのまま動かす。ビルドはない）。フォルダーの指定は、コマンドを打った場所から見たもの。

```sh
pnpm gesso login                         # ブラウザで承認してサインインする
pnpm gesso list                          # 自分のプロトタイプの ID と名前
pnpm gesso versions <ID>                 # プロトタイプの版（新しい順、元の commit つき）
pnpm gesso notes [<ID>]                  # メモのある版のメモ（新しい順。ID を省くと、今いるリポジトリのプロトタイプ）
pnpm gesso notes <ID> --version 3        # 版 3 のメモ
pnpm gesso new <ID> <dir> --template 2d  # 版のないプロトタイプを 2D（Canvas）か 3D（three.js）のテンプレートから始める
pnpm gesso pull <ID> <dir>               # いちばん新しい版を <dir> の git に取り込む
pnpm gesso serve <dir>                   # <dir> を http://127.0.0.1:4173/play/ で、gesso と同じ配り方で配る（手元で遊んで確かめる）
pnpm gesso pull <ID> <dir> --version 3   # 版 3 を取ってくる
pnpm gesso push <dir>                    # <dir> の最新の commit を次の版として送る
pnpm gesso logout                        # gesso のセッションを終え、サインインした情報を消す
```

## 流れ

1. `pull` で、空のフォルダー（なければ作る）を git のリポジトリにし、版を取り込む。取り込んだ版のメモ（取り込み済みでも）が出る。
2. `notes` でメモを読み、それに沿って直して `git commit` する。ブランチは自由に使ってよい。
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

## テンプレート

`new` は、版のないプロトタイプのフォルダーを `pull` と同じく用意し、テンプレートを置いて「gesso テンプレート 2d」として commit する。そのまま `push` すると版 1 になる。テンプレートは `templates/`（2D は Canvas だけ。3D は three.js と Rapier を import map で読み、Blender で作った地形 `assets/level.glb` を当たり判定つきで歩ける）で、どちらにも同じ土台（`src/gesso/runtime.js`）がある。

- `controls.json` に操作（キーとその名前）を宣言する。
- 1 秒に 60 回の決まった間隔で進むループと、シードを決められる乱数。
- ページの `window.gesso` から、状態を読む・操作を押す・止める・コマ送りする・シードを変えてやり直す。

決まりとデバッグのしかたは、テンプレートの `CLAUDE.md` にあり、Claude Code はそのフォルダーで読む。`new` は空のフォルダー（かまだないフォルダー）にだけ置き、続けて打つコマンドを gesso のリポジトリのパスを埋めて出す。

## メモ

版ごとに 1 つのメモがある。人が gesso のプロトタイプの画面で遊びながら、気づいたこと（「ジャンプが重い」など）を書く。次の版を作るときは、`notes` でメモを読んでから直す。`pull` も、取り込んだ版のメモを出す。

## 版に入るもの

- commit したファイルのうち、ドットで始まらないもの（`.gitignore` や `.github/` は入らない）で、`node_modules` とリンクとサブモジュールを除いたもの。入れなかったファイルは `push` が理由と一緒に知らせる。
- ルートに `index.html` が要る。1 ファイル 10 MiB、1 版 1000 ファイルまで。パスの決まりは API が確かめる（`apps/api/src/prototypes/versionFiles.ts`）。

## サインイン

- `login` は URL とコードを出す。gesso にサインインしたブラウザでその URL を開き、コードが同じか確かめて承認すると、CLI がサインインする。手元の開発サーバーに向けるときは `--api http://localhost:5173/api`。
- サインインした情報（API の URL とセッションのトークン）は `~/.config/gesso/credentials.json` に、持ち主だけが読める形で置く。セッションは使わないまま 7 日たつと切れる。
