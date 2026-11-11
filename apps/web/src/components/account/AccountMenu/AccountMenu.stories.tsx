import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, delay, http } from "msw";
import { getGetMeUrl } from "@/lib/api";
import { getGetMeMockHandler } from "@/lib/apiMocks";
import { AccountMenu } from "./AccountMenu.tsx";

const mePath = `*${getGetMeUrl()}`;
const signInPath = "*/auth/sign-in/social";
const signOutPath = "*/auth/sign-out";

const user = { id: "u1", name: "Ada Lovelace", email: "ada@example.com", image: null };

const meta = {
  component: AccountMenu,
} satisfies Meta<typeof AccountMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Checking: Story = {
  beforeEach({ msw }) {
    msw.use(http.get(mePath, () => delay("infinite")));
  },
};

export const SignedOut: Story = {
  beforeEach({ msw }) {
    msw.use(getGetMeMockHandler({ user: null }));
  },
};

export const SignInFails: Story = {
  beforeEach({ msw }) {
    msw.use(
      getGetMeMockHandler({ user: null }),
      http.post(signInPath, () => new HttpResponse(null, { status: 500 })),
    );
  },
};

export const SignedIn: Story = {
  beforeEach({ msw }) {
    msw.use(getGetMeMockHandler({ user }));
  },
};

export const SignOutFails: Story = {
  beforeEach({ msw }) {
    msw.use(
      getGetMeMockHandler({ user }),
      http.post(signOutPath, () => HttpResponse.error()),
    );
  },
};

export const Unreachable: Story = {
  beforeEach({ msw }) {
    msw.use(http.get(mePath, () => HttpResponse.error()));
  },
};
