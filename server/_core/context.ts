import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  requestId: string;
  clientIp: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const requestMeta = opts.req as typeof opts.req & { requestId?: string; clientIp?: string };
  return {
    req: opts.req,
    res: opts.res,
    user,
    requestId: requestMeta.requestId ?? "unknown",
    clientIp: requestMeta.clientIp ?? "unknown",
  };
}
