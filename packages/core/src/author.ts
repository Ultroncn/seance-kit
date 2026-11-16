import type { ToolContext } from "./types";

/** "demo" for the scripted Mock, the provider id for a real model, "user" when a person acted. */
export function authorOf(ctx: Pick<ToolContext, "actor">): string {
  if (!ctx.actor) return "user";
  return ctx.actor.isMock ? "demo" : ctx.actor.providerId;
}
