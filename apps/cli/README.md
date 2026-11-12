# gesso CLI

プロトタイプの版を、gesso と手元のフォルダーの間でやりとりする。Claude Code が版を取ってきて直し、新しい版として送るためのもの。リポジトリのルートで `pnpm gesso <コマンド>` として動かす（Node 24 が TypeScript をそのまま動かす。ビルドはない）。フォルダーの指定は、コマンドを打った場所から見たもの。

```sh
pnpm gesso login                       # ブラウザで承認してサインインする
pnpm gesso list                        # 自分のプロトタイプの ID と名前
pnpm gesso versions <ID>               # プロトタイプの版（新しい順）
pnpm gesso pull <ID> <dir>             # いちばん新しい版を <dir> に取ってくる
pnpm gesso pull <ID> <dir> --version 3 # 版 3 を取ってくる
pnpm gesso push <dir>                  # <dir> のファイルを次の版として送る
pnpm gesso logout                      # gesso のセッションを終え、サインインした情報を消す
```

- `login` は URL とコードを出す。gesso にサインインしたブラウザでその URL を開き、コードが同じか確かめて承認すると、CLI がサインインする。手元の開発サーバーに向けるときは `--api http://localhost:5173/api`。
- サインインした情報（API の URL とセッションのトークン）は `~/.config/gesso/credentials.json` に、持ち主だけが読める形で置く。セッションは使わないまま 7 日たつと切れる。
- `pull` したフォルダーには `.gesso.json` ができる（どのプロトタイプの、どの版か、各ファイルのハッシュ）。`push` はそれを見て送り先を決め、変わったファイルがなければ版を作らない。
- まだ版のないプロトタイプは、空のフォルダーに `pull` してからファイルを置き、`push` すると版 1 ができる。
- `pull` は、前に取ってきてから変えたり消したりしたファイルや、gesso にないのに版と同じパスにあるファイルを上書きしない（`--force` で上書きする）。リンクの先には書かない。
- `push` は、フォルダーが取ってきた版より新しい版があると送らない（そのまま送ると、新しい版の変更が抜ける）。`--force` で送る。
- 版に入るのは、ドットで始まらないファイルとフォルダーで、`node_modules` とリンクを除いたもの。ルートに `index.html` が要り、1 ファイル 10 MiB、1 版 1000 ファイルまで。パスの決まりは API が確かめる（`apps/api/src/prototypes/versionFiles.ts`）。
