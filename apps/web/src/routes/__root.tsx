import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  return (
    <main>
      <h1>gesso</h1>
      <Outlet />
    </main>
  );
}
