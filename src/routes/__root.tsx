import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import Footer from "../components/Footer";
import Header from "../components/Header";
import ToastViewport from "../components/ToastViewport";
import { useHydrated } from "../hooks/useHydrated";
import { ConvexAppProvider } from "../lib/convex";
import { useSessionStore } from "../stores/sessionStore";

import appCss from "../styles.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Poster Lim",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: RootNotFoundComponent,
  errorComponent: RootErrorComponent,
  shellComponent: RootDocument,
});

function RootNotFoundComponent() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6">
        <p className="island-kicker mb-2">404</p>
        <h1 className="m-0 text-3xl font-bold">Page not found</h1>
        <p className="mt-3 text-sm text-[var(--sea-ink-soft)]">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="mt-5 inline-block text-sm font-semibold">
          ← Back to marketplace
        </Link>
      </section>
    </main>
  );
}

function RootErrorComponent({ error }: { error: Error }) {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6">
        <p className="island-kicker mb-2">Error</p>
        <h1 className="m-0 text-3xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-sm text-[var(--sea-ink-soft)]">
          {error.message}
        </p>
      </section>
    </main>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body
        suppressHydrationWarning
        className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]"
      >
        <ConvexAppProvider>
          <Header />
          <AdminRouteGuard />
          {children}
          <Footer />
          <ToastViewport />
        </ConvexAppProvider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

function AdminRouteGuard() {
  const hydrated = useHydrated();
  const session = useSessionStore((state) => state.session);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const navigate = useNavigate();

  const shouldRedirect =
    hydrated &&
    session?.role === "admin" &&
    !pathname.startsWith("/admin") &&
    pathname !== "/login" &&
    pathname !== "/signup";

  useEffect(() => {
    if (!shouldRedirect) {
      return;
    }

    void navigate({ to: "/admin/orders", replace: true });
  }, [navigate, shouldRedirect]);

  if (!shouldRedirect) {
    return null;
  }

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell rounded-2xl p-6">
        <p className="island-kicker mb-2">Admin</p>
        <h1 className="m-0 text-2xl font-bold">Redirecting to dashboard...</h1>
      </section>
    </main>
  );
}
