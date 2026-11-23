import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "./about";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/about-mesac")({
  head: () =>
    pageHead({
      title: "About MESAC — CUSAT Mechanical Association",
      description:
        "The Mechanical Engineering Students Association of CUSAT (MESAC) is a registered association established in July 2005.",
      path: "/about-mesac",
    }),
  component: AboutPage,
});
