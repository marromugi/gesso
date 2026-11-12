# gesso のプロトタイプ

ゲームのアイデアを確かめるための、遊べる試作。gesso で版として残し、そこで遊んでメモを書く。このフォルダーは gesso のプロトタイプと結びついた git のリポジトリ。

## gesso の CLI

gesso の CLI は、gesso のリポジトリで `pnpm gesso` として動く。このフォルダーからは `pnpm --dir <gesso のリポジトリ> gesso …` と打つ（`gesso new` が、パスを埋めたコマンドを出している）。

- `… gesso notes`: 遊んだ人のメモを読む（このリポジトリのプロトタイプの、メモのある版すべて）。
- `… gesso serve .`: 手元で配る（下の「デバッグ」）。
- `… gesso push .`: commit したものを次の版にする。gesso で遊べるようになる。
- `… gesso pull <プロトタイプの ID> .`: ほかで作られた新しい版を取り込む（git pull のように merge する）。

## 決まり

- ビルドはしない。`index.html` が入口で、ブラウザが ES モジュールをそのまま読む。
- ライブラリは `index.html` の import map で、CDN の決まった版（`three@0.186.1` のように）から読む。npm で入れない。
- パスはすべて相対にする（`src/main.js`、`./assets/hero.png`）。gesso は版をフォルダーの下（`/<トークン>/`）に置いて配るので、`/` で始まるパスは届かない。
- ドットで始まるファイルとフォルダー、`node_modules`、リンクは版に入らない（配られない）。
- 1 ファイル 10 MiB、1 版 1000 ファイルまで。

## 中身

- `index.html`: 入口。
- `controls.json`: 操作の宣言。キー（`KeyboardEvent.code`: `KeyA`、`ArrowLeft`、`Space`）と、人に見せる名前（gesso の遊ぶ画面で操作の説明に使う）。1 つのキーは 1 つの操作にだけ使う。

  ```json
  { "format": 1, "actions": [{ "id": "jump", "label": "ジャンプ", "keys": ["Space"] }] }
  ```

- `src/game.js`: ゲームの決まり。ブラウザも描画も使わないので、そのまま動かして確かめられる。
  - `init(random)`: 最初の状態を返す。状態は JSON にできる値だけにする（`gesso.getState()` で読めるように）。
  - `update(state, input, dt, random)`: 1 秒に 60 回、決まった `dt` で状態を進める。入力は `input.isDown("jump")`（押している。そのステップの間に押して離した短い押し方も含む）と `input.wasPressed("jump")`（このステップで押し始めた）。`controls.json` にない操作を読むとエラーになる。乱数は `Math.random()` でなく `random()` を使う（シードで同じ動きを再現できるように）。
- `src/main.js`: 描く（`render(state)`、状態は変えない）と、`startGame({ init, update, render })` で動かす。
- `src/gesso/runtime.js`: ループ・入力・デバッグの口。ふつうは変えない。ゲームの中でエラーが起きると、止めてページに出す。

## デバッグ

`… gesso serve .` で手元で配り、`http://127.0.0.1:4173/play/?seed=1&paused` のように開く（gesso と同じく、版に入るファイルだけを、そのパスの下で配る）。`?seed=` でシードを決め、`?paused` で止まった状態から始まる。

ページの `window.gesso`（`controls.json` を読み終えてからできる。Playwright なら `await page.waitForFunction(() => window.gesso)`）で、外から動かして確かめる:

- `getState()`: 今の状態。
- `press("jump")` / `release("jump")`: 操作を押す・離す（`controls.json` の `id`）。
- `pause()` / `resume()`: 止める・動かす。
- `step(n)`: 止めて `n` ステップ進め、その後の状態を返す。
- `restart(seed)`: 押している操作を離して、最初からやり直す（シードを変えてもよい）。
- `frame()` / `seed()` / `isPaused()` / `lastError()` / `controls`。

止まっていないと、呼ぶ間にもゲームが進む。決まった結果を見たいときは、`?paused` で開き、一続きの操作を 1 回の呼び出しの中で行う（Playwright なら 1 つの `page.evaluate` の中）。例: 右へ 30 ステップ動いた後の状態。

```js
gesso.restart(1);
gesso.press("right");
const after = gesso.step(30);
gesso.release("right");
after.player; // 2D でも 3D でも x が増えている
```

## gesso との流れ

1. `… gesso notes` で、遊んだ人のメモを読む。
2. 直して確かめ、`git commit` する。
3. `… gesso push .` で次の版にする。
