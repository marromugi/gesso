# gesso のプロトタイプ

ゲームのアイデアを確かめるための、遊べる試作。gesso（https://gesso-web.marrromugi-dev.workers.dev）で版として残し、そこで遊んでメモを書く。このフォルダーは gesso のプロトタイプと結びついた git のリポジトリ。

## 決まり

- ビルドはしない。`index.html` が入口で、ブラウザが ES モジュールをそのまま読む。
- ライブラリは `index.html` の import map で、CDN の決まった版（`three@0.186.1` のように）から読む。npm で入れない。
- パスはすべて相対にする（`src/main.js`、`./assets/hero.png`）。gesso は版をフォルダーの下に置いて配るので、`/` で始まるパスは届かない。
- ドットで始まるファイルとフォルダー、`node_modules` は版に入らない。
- 1 ファイル 10 MiB、1 版 1000 ファイルまで。

## 中身

- `index.html`: 入口。
- `controls.json`: 操作の宣言。gesso はこれを遊ぶ画面に出す。キーは `KeyboardEvent.code`（`KeyA`、`ArrowLeft`、`Space`）。

  ```json
  { "format": 1, "actions": [{ "id": "jump", "label": "ジャンプ", "keys": ["Space"] }] }
  ```

- `src/main.js`: ゲーム。`startGame({ init, update, render })` に渡す。
  - `init(random)`: 最初の状態を返す。状態は JSON にできる値だけにする（`window.gesso.getState()` で読めるように）。
  - `update(state, input, dt, random)`: 1 秒に 60 回、決まった `dt` で状態を進める。入力は `input.isDown("jump")`（押している）と `input.wasPressed("jump")`（このフレームで押した）。乱数は `Math.random()` でなく `random()` を使う（シードで同じ動きを再現できるように）。
  - `render(state)`: 状態を描く。状態を変えない。
- `src/gesso/runtime.js`: ループ・入力・デバッグの口。ふつうは変えない。

## デバッグ

手元で配って、ブラウザで開く:

```sh
pnpm --dir <gesso のリポジトリ> gesso serve .
```

`http://localhost:4173/?seed=1&paused` のように開くと、シードを決めて止まった状態から始まる。ページの `window.gesso` で、外から動かして確かめられる（Playwright や開発者ツールから）:

- `getState()`: 今の状態。
- `press("jump")` / `release("jump")`: 操作を押す・離す（`controls.json` の `id`）。
- `pause()` / `resume()`: 止める・動かす。
- `step(n)`: 止めて `n` フレーム進め、その後の状態を返す。
- `restart(seed)`: 最初からやり直す（シードを変えてもよい）。
- `frame()` / `seed()` / `isPaused()` / `controls`。

例: ジャンプの高さを確かめる。

```js
gesso.restart(1);
gesso.press("jump");
const peak = Math.min(...Array.from({ length: 60 }, () => gesso.step(1).player.y));
```

## gesso との流れ

1. `pnpm gesso notes <ID>` で、遊んだ人のメモを読む。
2. 直して確かめ、`git commit` する。
3. `pnpm gesso push .` で次の版にする。gesso で遊べるようになる。
