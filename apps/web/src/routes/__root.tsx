import { Outlet, createRootRoute, redirect } from "@tanstack/react-router";
import { AccountMenu } from "@/components/account/AccountMenu";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { readSignInFailure } from "@/lib/auth";
import { toastError } from "@/lib/ui/toast";

export const Route = createRootRoute({
  component: RootLayout,
  // A sign-in that failed comes back with `?error=`: say why once, and drop it from the URL so a
  // reload doesn't say it again.
  beforeLoad: ({ location }) => {
    const failure = readSignInFailure(location);
    if (failure === null) return;
    toastError(failure.message);
    throw redirect({ href: failure.href, replace: true });
  },
});

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
