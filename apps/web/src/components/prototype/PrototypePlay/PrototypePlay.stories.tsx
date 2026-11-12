import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { expect, screen, waitFor } from "storybook/test";
import { getCreatePrototypePlayUrlUrl, getGetPrototypeUrl } from "@/lib/api";
import {
  getCreatePrototypePlayUrlMockHandler,
  getGetPrototypeMockHandler,
  getListPrototypeVersionsMockHandler,
} from "@/lib/apiMocks";
import { PrototypePlay } from "./PrototypePlay.tsx";

const prototypeId = "p1";

const versions = [
  { number: 3, createdAt: "2026-11-12T03:00:00.000Z" },
  { number: 2, createdAt: "2026-11-11T03:00:00.000Z" },
  { number: 1, createdAt: "2026-11-10T03:00:00.000Z" },
];

/** Stands in for the API: a prototype with `list` as its versions, each played at `#v<number>`. */
function fakeApi(list: typeof versions) {
  return [
    getGetPrototypeMockHandler({
      id: prototypeId,
      name: "二段ジャンプ",
      createdAt: "2026-11-10T00:00:00.000Z",
      updatedAt: "2026-11-12T03:00:00.000Z",
    }),
    getListPrototypeVersionsMockHandler({ versions: list }),
    getCreatePrototypePlayUrlMockHandler(({ params }) => ({
      url: `about:blank#v${params.number}`,
      expiresAt: "2026-11-12T15:00:00.000Z",
    })),
  ];
}

async function player(): Promise<HTMLElement> {
  return screen.findByTitle(/^二段ジャンプ 版 \d+$/);
}

const meta = {
  component: PrototypePlay,
  args: { prototypeId },
} satisfies Meta<typeof PrototypePlay>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Without a version asked for, the newest plays, and each version links to playing it. */
export const PlaysNewest: Story = {
  beforeEach({ msw }) {
    msw.use(...fakeApi(versions));
  },
  async play() {
    await expect(await player()).toHaveAttribute("src", "about:blank#v3");
    const links = screen.getAllByRole("link", { name: /^版 / });
    await expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([
      "page",
      null,
      null,
    ]);
    await expect(links[1]).toHaveAttribute("href", `/prototypes/${prototypeId}?version=2`);
  },
};

export const PlaysAskedVersion: Story = {
  args: { version: 1 },
  beforeEach({ msw }) {
    msw.use(...fakeApi(versions));
  },
  async play() {
    await expect(await player()).toHaveAttribute("src", "about:blank#v1");
    await expect(screen.getByRole("link", { name: /^版 1/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

export const AskedVersionMissing: Story = {
  args: { version: 9 },
  beforeEach({ msw }) {
    msw.use(...fakeApi(versions));
  },
  async play() {
    await expect(await screen.findByText("版 9 はありません。")).toBeVisible();
  },
};

export const NoVersions: Story = {
  beforeEach({ msw }) {
    msw.use(...fakeApi([]));
  },
  async play() {
    await expect(
      await screen.findByText("まだ版がありません。Claude Code から版を送ると、ここで遊べます。"),
    ).toBeVisible();
    await expect(screen.queryByRole("navigation", { name: "版" })).toBeNull();
  },
};

export const NotTheirs: Story = {
  beforeEach({ msw }) {
    // The first handler for a request answers it.
    msw.use(
      http.get(`*${getGetPrototypeUrl(prototypeId)}`, () =>
        HttpResponse.json({ error: "not_found" }, { status: 404 }),
      ),
      ...fakeApi(versions),
    );
  },
  async play() {
    await expect(await screen.findByText("このプロトタイプは見つかりません。")).toBeVisible();
  },
};

/** The play URL can't be had: the versions stay listed and the player says why. */
export const PlayUrlFails: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.post(`*${getCreatePrototypePlayUrlUrl(prototypeId, 3)}`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
      ...fakeApi(versions),
    );
  },
  async play() {
    await waitFor(async () => {
      await expect(
        screen.getByText("版 3 を開けません（API がエラーを返しました: 500）"),
      ).toBeVisible();
    });
    await expect(screen.getAllByRole("link", { name: /^版 / })).toHaveLength(3);
  },
};
