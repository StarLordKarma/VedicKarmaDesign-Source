import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

type PackageRow = { id: number; code: "basic" | "basic_plus"; version: number; packageType: "basic" | "basic_plus"; nameEn: string; nameRu: string; nameDe: string; nameEs: string; active: boolean; createdBy: string };
const rows: PackageRow[] = [
  { id: 1, code: "basic", version: 1, packageType: "basic", nameEn: "Basic reading", nameRu: "Базовое чтение", nameDe: "Basisdeutung", nameEs: "Lectura básica", active: true, createdBy: "system" },
  { id: 2, code: "basic_plus", version: 1, packageType: "basic_plus", nameEn: "Basic + numerology", nameRu: "Базовое + нумерология", nameDe: "Basisdeutung + Numerologie", nameEs: "Básica + numerología", active: true, createdBy: "system" },
];
const mocks = vi.hoisted(() => ({ listServicePackages: vi.fn(), listActiveServicePackages: vi.fn(), setServicePackageActive: vi.fn() }));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, listServicePackages: mocks.listServicePackages, listActiveServicePackages: mocks.listActiveServicePackages, setServicePackageActive: mocks.setServicePackageActive };
});

import { appRouter } from "./routers";

function context(openId: string): TrpcContext {
  return { user: { id: 1, openId, email: "owner@example.com", name: "Owner", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", get: () => "example.test" } as never, res: {} as never };
}

describe("owner-managed service package catalog", () => {
  beforeEach(() => {
    rows.forEach((row) => { row.active = true; });
    mocks.listServicePackages.mockImplementation(async () => rows);
    mocks.listActiveServicePackages.mockImplementation(async () => rows.filter((row) => row.active));
    mocks.setServicePackageActive.mockImplementation(async (input: { code: "basic" | "basic_plus"; version: number; active: boolean }) => { const row = rows.find((item) => item.code === input.code && item.version === input.version); if (!row) throw new Error("Service package version not found."); if (!input.active && rows.filter((item) => item.active).length <= 1) throw new Error("At least one service package must remain active."); row.active = input.active; return row; });
  });

  it("allows only the configured owner to view and change package activity", async () => {
    const owner = appRouter.createCaller(context(ENV.ownerOpenId));
    const nonOwner = appRouter.createCaller(context("another-admin"));
    await expect(nonOwner.admin.servicePackages()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(nonOwner.admin.updateServicePackageActive({ code: "basic", version: 1, active: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await owner.admin.servicePackages()).toHaveLength(2);
    await expect(owner.admin.updateServicePackageActive({ code: "basic", version: 1, active: false })).resolves.toMatchObject({ code: "basic", active: false });
    await expect(owner.pricing.packages()).resolves.toEqual([expect.objectContaining({ code: "basic_plus", active: true })]);
  });
});
