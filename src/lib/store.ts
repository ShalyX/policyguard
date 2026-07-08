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

export function makePortableReceiptId(receipt: PolicyReceipt): string {
  const packet = { ...receipt, id: "__PORTABLE_RECEIPT__" };
  return `${crypto.randomUUID()}.${toBase64Url(JSON.stringify(packet))}`;
}

function decodePortableReceipt(id: string): PolicyReceipt | null {
  const [, encoded] = id.split(".", 2);
  if (!encoded) return null;
  try {
    const decoded = JSON.parse(fromBase64Url(encoded)) as PolicyReceipt;
    return { ...decoded, id };
  } catch {
    return null;
  }
}

export async function saveReceipt(receipt: PolicyReceipt): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, `${encodeURIComponent(receipt.id)}.json`), JSON.stringify(receipt, null, 2));
}

export async function getReceipt(id: string): Promise<PolicyReceipt | null> {
  if (!/^[A-Za-z0-9._-]{20,12000}$/.test(id)) return null;
  try {
    const body = await readFile(path.join(dataDir, `${encodeURIComponent(id)}.json`), "utf8");
    return JSON.parse(body) as PolicyReceipt;
  } catch {
    return decodePortableReceipt(id);
  }
}
