import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, delay, http } from "msw";
import { getGetHealthUrl } from "@/lib/api";
import { getGetHealthMockHandler } from "@/lib/apiMocks";
import { ApiStatus } from "./ApiStatus.tsx";

const healthPath = `*${getGetHealthUrl()}`;

const meta = {
  component: ApiStatus,
} satisfies Meta<typeof ApiStatus>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Checking: Story = {
  beforeEach({ msw }) {
    msw.use(http.get(healthPath, () => delay("infinite")));
  },
};

export const Ok: Story = {
  beforeEach({ msw }) {
    msw.use(getGetHealthMockHandler());
  },
};

export const Unreachable: Story = {
  beforeEach({ msw }) {
    msw.use(http.get(healthPath, () => HttpResponse.error()));
  },
};

export const Rejected: Story = {
  beforeEach({ msw }) {
    msw.use(http.get(healthPath, () => new HttpResponse(null, { status: 500 })));
  },
};

export const Unreadable: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get(healthPath, () => HttpResponse.html("<!doctype html><title>not the API</title>")),
    );
  },
};
