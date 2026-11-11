import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["msw-storybook-addon", "@storybook/addon-vitest"],
  staticDirs: ["./public"],
  env: (env) => ({ ...env, VITE_API_BASE_URL: "/api" }),
  core: { disableTelemetry: true },
};

export default config;
