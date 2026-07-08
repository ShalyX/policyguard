import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PolicyReceipt } from "./types";

const dataDir = process.env["VERCEL"]
  ? path.join("/tmp", "policyguard", "receipts")
  : path.join(process.cwd(), "data", "receipts");

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function makeSharePacket(receipt: PolicyReceipt): string {
  return toBase64Url(JSON.stringify(receipt));
}

export function decodeSharePacket(packet?: string | null): PolicyReceipt | null {
  if (!packet || !/^[A-Za-z0-9_-]{40,12000}$/.test(packet)) return null;
  try {
    return JSON.parse(fromBase64Url(packet)) as PolicyReceipt;
  } catch {
    return null;
  }
}

export async function saveReceipt(receipt: PolicyReceipt): Promise<void> {
  if (process.env["VERCEL"]) return;
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, `${receipt.id}.json`), JSON.stringify(receipt, null, 2));
}

export async function getReceipt(id: string, packet?: string | null): Promise<PolicyReceipt | null> {
  if (!/^[a-f0-9-]{20,80}$/i.test(id)) return null;
  try {
    const body = await readFile(path.join(dataDir, `${id}.json`), "utf8");
    return JSON.parse(body) as PolicyReceipt;
  } catch {
    const decoded = decodeSharePacket(packet);
    if (!decoded || decoded.id !== id) return null;
    return decoded;
  }
}
