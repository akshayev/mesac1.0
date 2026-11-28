import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Page data (team, settings, ...) is reused for 60 s while navigating, like the server's cache.
    defaultStaleTime: 60_000,
    defaultPreloadStaleTime: 60_000,
  });

  return router;
};
