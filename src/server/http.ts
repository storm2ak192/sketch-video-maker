import { getEveryAppUser, type EveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { ensureUser } from "@/server/projects";

/** The signed-in member, recorded on first sight, or a 401 response. */
export async function memberOf(
  request: Request,
): Promise<EveryAppUser | Response> {
  const user = await getEveryAppUser(request, env);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  await ensureUser(user);
  return user;
}

export const notFound = () =>
  Response.json({ error: "Not found." }, { status: 404 });

export const badRequest = (error: string) =>
  Response.json({ error }, { status: 400 });
