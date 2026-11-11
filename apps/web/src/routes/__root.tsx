import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account/AccountMenu";
import { ToastRegion } from "@/components/ui/ToastRegion";

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
      <ToastRegion />
    </>
  );
}
