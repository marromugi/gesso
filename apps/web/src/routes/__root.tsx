import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account/AccountMenu";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  return (
    <>
      <header>
        <h1>gesso</h1>
        <AccountMenu />
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
