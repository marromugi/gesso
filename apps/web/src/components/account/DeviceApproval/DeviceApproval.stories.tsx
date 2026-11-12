import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { expect, screen, userEvent } from "storybook/test";
import { getGetMeMockHandler } from "@/lib/apiMocks";
import { DeviceApproval } from "./DeviceApproval.tsx";

const userCode = "ABCD2345";

const owner = { id: "u1", name: "marromugi", email: "m@example.com", image: null };

/**
 * Stands in for the API's device sign-in: the code is pending until approved or denied, and
 * `answers` keeps what was sent.
 */
function fakeDeviceSignIn() {
  let status = "pending";
  const answers: { action: string; userCode: string }[] = [];
  const handlers = [
    getGetMeMockHandler({ user: owner }),
    http.get("*/auth/device", ({ request }) => {
      const code = new URL(request.url).searchParams.get("user_code");
      if (code !== userCode) {
        return HttpResponse.json({ error: "invalid_request" }, { status: 400 });
      }
      return HttpResponse.json({ user_code: code, status });
    }),
    http.post<{ action: string }, { userCode: string }>(
      "*/auth/device/:action",
      async ({ params, request }) => {
        const body = await request.json();
        const { action } = params;
        answers.push({ action, userCode: body.userCode });
        status = action === "approve" ? "approved" : "denied";
        return HttpResponse.json({ success: true });
      },
    ),
  ];
  return { handlers, answers };
}

let api = fakeDeviceSignIn();

const meta = {
  component: DeviceApproval,
  args: { userCode },
  beforeEach({ msw }) {
    api = fakeDeviceSignIn();
    msw.use(...api.handlers);
  },
} satisfies Meta<typeof DeviceApproval>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The code is shown to compare with the terminal; approving lets the CLI in. */
export const Approves: Story = {
  async play() {
    await expect(await screen.findByText(userCode)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "承認する" }));

    await expect(
      await screen.findByText("承認しました。ターミナルに戻ってください。"),
    ).toBeVisible();
    await expect(api.answers).toEqual([{ action: "approve", userCode }]);
  },
};

export const Denies: Story = {
  async play() {
    await userEvent.click(await screen.findByRole("button", { name: "拒否する" }));

    await expect(
      await screen.findByText("拒否しました。この CLI はサインインできません。"),
    ).toBeVisible();
    await expect(api.answers).toEqual([{ action: "deny", userCode }]);
  },
};

export const UnknownCode: Story = {
  args: { userCode: "WRONG234" },
  async play() {
    await expect(await screen.findByText(/このコードは使えません。/)).toBeVisible();
    await expect(screen.queryByRole("button", { name: "承認する" })).toBeNull();
  },
};

/** Signed out, it asks to sign in first: looking the code up ties it to whoever is signed in. */
export const SignedOut: Story = {
  beforeEach({ msw }) {
    msw.use(getGetMeMockHandler({ user: null }));
  },
  async play() {
    await expect(
      await screen.findByText("サインインすると、CLI のサインインを承認できます。"),
    ).toBeVisible();
  },
};

export const NoCode: Story = {
  args: { userCode: undefined },
  async play() {
    await expect(await screen.findByText(/コードがありません。/)).toBeVisible();
  },
};
