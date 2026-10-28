import { authed } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";

export const GET = authed(async ({ requestId }) => ok({ authenticated: true }, requestId));
