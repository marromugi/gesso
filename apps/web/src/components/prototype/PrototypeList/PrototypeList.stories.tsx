import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, delay, http } from "msw";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { getListPrototypesUrl } from "@/lib/api";
import { getCreatePrototypeMockHandler, getListPrototypesMockHandler } from "@/lib/apiMocks";
import { PrototypeList } from "./PrototypeList.tsx";

const listPath = `*${getListPrototypesUrl()}`;

const prototypes = [
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
    updatedAt: "2026-11-11T09:00:00.000Z",
  },
] as const;

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
};

export const SignedOut: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get(listPath, () => HttpResponse.json({ error: "unauthorized" }, { status: 401 })),
    );
  },
};

export const Empty: Story = {
  beforeEach({ msw }) {
    msw.use(getListPrototypesMockHandler({ prototypes: [] }), getCreatePrototypeMockHandler());
  },
};

export const WithPrototypes: Story = {
  beforeEach({ msw }) {
    msw.use(
      getListPrototypesMockHandler({ prototypes: [...prototypes] }),
      getCreatePrototypeMockHandler(),
    );
  },
};

/** Creating fails, so a toast says why and the form keeps its text. */
export const CreateFails: Story = {
  beforeEach({ msw }) {
    msw.use(
      getListPrototypesMockHandler({ prototypes: [...prototypes] }),
      http.post(listPath, () => new HttpResponse(null, { status: 500 })),
    );
  },
};

export const Unreachable: Story = {
  beforeEach({ msw }) {
    msw.use(http.get(listPath, () => HttpResponse.error()));
  },
};
