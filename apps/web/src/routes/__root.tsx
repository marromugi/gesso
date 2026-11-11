import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account/AccountMenu";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  return (
    <>
      <header className="flex items-center justify-between gap-4 p-4">
        <h1 className="text-xl font-bold">gesso</h1>
        <AccountMenu />
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </>
  );
}
