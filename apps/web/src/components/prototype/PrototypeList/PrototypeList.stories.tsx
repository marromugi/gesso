import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, delay, http } from "msw";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { type NewPrototype, type Prototype, getListPrototypesUrl } from "@/lib/api";
import { getCreatePrototypeMockHandler, getListPrototypesMockHandler } from "@/lib/apiMocks";
import { PrototypeList } from "./PrototypeList.tsx";

const listPath = `*${getListPrototypesUrl()}`;

const prototypes: Prototype[] = [
  {
    id: "p2",
    name: "1-1 グレーボックス",
    createdAt: "2026-11-11T10:00:00.000Z",
    updatedAt: "2026-11-11T10:00:00.000Z",
  },
  {
    id: "p1",
    name: "二段ジャンプ",
    createdAt: "2026-11-10T10:00:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z",
  },
];

const nameError = "1〜100 文字で入力してください";

/**
 * Stands in for the API's prototypes: the list the handlers return grows with each create,
 * and `sent` keeps every body that was posted.
 */
function fakePrototypes(initial: Prototype[]) {
  const items = [...initial];
  const sent: NewPrototype[] = [];
  const handlers = [
    getListPrototypesMockHandler(() => ({ prototypes: [...items] })),
    getCreatePrototypeMockHandler(async ({ request }) => {
      const body = await request.json();
      sent.push(body);
      const created: Prototype = {
        id: `p${items.length + 1}`,
        name: body.name,
        createdAt: "2026-11-12T10:00:00.000Z",
        updatedAt: "2026-11-12T10:00:00.000Z",
      };
      items.unshift(created);
      return created;
    }),
  ];
  return { handlers, sent };
}

/** The fake API of the story being run, set up again before each run. */
let api = fakePrototypes(prototypes);

/** Waits until `text` is on screen and visible (a modal or toast may still be fading in). */
async function showsText(text: string, timeout?: number) {
  await waitFor(
    async () => {
      await expect(screen.getByText(text)).toBeVisible();
    },
    { timeout },
  );
}

/** Opens the form and types `name` into its field. */
async function typeNewPrototype(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: "新しいプロトタイプ" }));
  await userEvent.type(await screen.findByLabelText("名前"), name);
}

/** Opens the form, types `name` into it, and presses 作る. */
async function submitNewPrototype(name: string) {
  await typeNewPrototype(name);
  await userEvent.click(screen.getByRole("button", { name: "作る" }));
}

const meta = {
  component: PrototypeList,
  // The app puts toasts in the root layout; a story has to place them itself.
  decorators: [
    (Story) => (
      <>
        <Story />
        <ToastRegion />
      </>
    ),
  ],
} satisfies Meta<typeof PrototypeList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  beforeEach({ msw }) {
    msw.use(http.get(listPath, () => delay("infinite")));
  },
  async play() {
    await showsText("プロトタイプを読み込んでいます…");
  },
};

export const SignedOut: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get(listPath, () => HttpResponse.json({ error: "unauthorized" }, { status: 401 })),
    );
  },
  async play() {
    await showsText("サインインすると、プロトタイプを作って一覧で見られます。");
  },
};

export const Empty: Story = {
  beforeEach({ msw }) {
    api = fakePrototypes([]);
    msw.use(...api.handlers);
  },
  async play() {
    await showsText("まだプロトタイプがありません。");
  },
};

export const WithPrototypes: Story = {
  beforeEach({ msw }) {
    api = fakePrototypes(prototypes);
    msw.use(...api.handlers);
  },
  async play() {
    await waitFor(async () => {
      await expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
        "1-1 グレーボックス",
        "二段ジャンプ",
      ]);
    });
    await expect(screen.getByRole("link", { name: "二段ジャンプ" })).toHaveAttribute(
      "href",
      "/prototypes/p1",
    );
  },
};

/**
 * Enter sends the new prototype with its name trimmed; the form closes and the prototype heads
 * the list.
 */
export const CreatesPrototype: Story = {
  beforeEach({ msw }) {
    api = fakePrototypes(prototypes);
    msw.use(...api.handlers);
  },
  async play() {
    await typeNewPrototype("  敵の索敵 {Enter}");

    await waitFor(async () => {
      await expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("敵の索敵");
    });
    await expect(api.sent).toEqual([{ name: "敵の索敵" }]);
    await waitFor(async () => {
      await expect(screen.queryByLabelText("名前")).toBeNull();
    });
  },
};

/** A name of only spaces shows an error under the field and nothing is sent. */
export const RefusesBlankName: Story = {
  beforeEach({ msw }) {
    api = fakePrototypes(prototypes);
    msw.use(...api.handlers);
  },
  async play() {
    await submitNewPrototype("   ");

    await showsText(nameError);
    await expect(api.sent).toEqual([]);
  },
};

/** Closing the form empties it, so it opens again without the error it showed. */
export const ReopensEmpty: Story = {
  beforeEach({ msw }) {
    api = fakePrototypes(prototypes);
    msw.use(...api.handlers);
  },
  async play() {
    await submitNewPrototype("   ");
    await showsText(nameError);
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await expect(screen.queryByLabelText("名前")).toBeNull();
    });

    await userEvent.click(screen.getByRole("button", { name: "新しいプロトタイプ" }));

    await expect(await screen.findByLabelText("名前")).toHaveValue("");
    await expect(screen.queryByText(nameError)).toBeNull();
  },
};

/** Creating fails, so a toast says why and the form keeps its text. */
export const CreateFails: Story = {
  beforeEach({ msw }) {
    msw.use(
      getListPrototypesMockHandler({ prototypes }),
      http.post(listPath, () => new HttpResponse(null, { status: 500 })),
    );
  },
  async play() {
    await submitNewPrototype("敵の索敵");

    await showsText("プロトタイプを作れませんでした");
    await expect(screen.getByLabelText("名前")).toHaveValue("敵の索敵");
  },
};

/** The session ended before creating: the page asks to sign in again. */
export const SessionExpired: Story = {
  beforeEach({ msw }) {
    let signedIn = true;
    msw.use(
      http.get(listPath, () =>
        signedIn
          ? HttpResponse.json({ prototypes })
          : HttpResponse.json({ error: "unauthorized" }, { status: 401 }),
      ),
      http.post(listPath, () => {
        signedIn = false;
        return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
      }),
    );
  },
  async play() {
    await submitNewPrototype("敵の索敵");

    await showsText("サインインが切れています。サインインし直してください");
    await showsText("サインインすると、プロトタイプを作って一覧で見られます。");
  },
};

/** Fetching the list again after a create fails, but the list already shown stays. */
export const KeepsListWhenRefetchFails: Story = {
  beforeEach({ msw }) {
    let listCalls = 0;
    msw.use(
      http.get(listPath, () => {
        listCalls += 1;
        return listCalls === 1
          ? HttpResponse.json({ prototypes })
          : new HttpResponse(null, { status: 500 });
      }),
      getCreatePrototypeMockHandler(),
    );
  },
  async play() {
    await submitNewPrototype("敵の索敵");
    await waitFor(async () => {
      await expect(screen.queryByLabelText("名前")).toBeNull();
    });

    // The refetch answered 500; the list is still the one shown before it.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(screen.queryByText(/プロトタイプを読み込めません/)).toBeNull();
    await expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "1-1 グレーボックス",
      "二段ジャンプ",
    ]);
  },
};

/** The API cannot be reached even after the retries. */
export const Unreachable: Story = {
  beforeEach({ msw }) {
    msw.use(http.get(listPath, () => HttpResponse.error()));
  },
  async play() {
    // Three retries back off 1 + 2 + 4 seconds before the failure shows.
    await showsText("プロトタイプを読み込めません（API に接続できません）", 15_000);
  },
};
