import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PolicyReceipt } from "./types";

const dataDir = process.env["VERCEL"]
  ? path.join("/tmp", "policyguard", "receipts")
  : path.join(process.cwd(), "data", "receipts");

export async function saveReceipt(receipt: PolicyReceipt): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, `${receipt.id}.json`), JSON.stringify(receipt, null, 2));
}

export async function getReceipt(id: string): Promise<PolicyReceipt | null> {
  if (!/^[a-f0-9-]{20,}$/i.test(id)) return null;
  try {
    const body = await readFile(path.join(dataDir, `${id}.json`), "utf8");
    return JSON.parse(body) as PolicyReceipt;
  } catch {
    return null;
  }
}
