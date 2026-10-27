const address = process.env.SODEX_BUILDER_ADDRESS;
const base = "https://mainnet-gw.sodex.dev/api/v1";

if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("Set SODEX_BUILDER_ADDRESS to the builder master wallet address.");
  process.exit(1);
}

async function json(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || body?.code !== 0) {
    throw new Error(`${url} failed (${res.status}): ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

function balance(rows) {
  const data = rows?.data;
  const list = Array.isArray(data) ? data : Array.isArray(data?.balances) ? data.balances : Array.isArray(data?.B) ? data.B : [];
  const row = list.find((x) => String(x.coin ?? x.asset ?? x.a ?? "").toUpperCase() === "VUSDC") ??
    list.find((x) => String(x.coin ?? x.asset ?? x.a ?? "").toUpperCase() === "USDC");
  if (!row) return null;
  const n = Number(row.total ?? row.walletBalance ?? row.wb ?? row.available ?? row.balance ?? row.t);
  return Number.isFinite(n) ? n : null;
}

const subaccounts = await json(`${base}/user/${address}/subaccounts`);
const accountID = Number(subaccounts.data?.primaryAccountID);
if (!Number.isSafeInteger(accountID) || accountID <= 0) {
  throw new Error(`No activated primary SoDEX account found for ${address}`);
}

const [spot, perps, summary] = await Promise.all([
  json(`${base}/spot/accounts/${address}/balances?accountID=${accountID}`),
  json(`${base}/perps/accounts/${address}/balances?accountID=${accountID}`),
  json(`${base}/user/${address}/builder/summary?accountID=${accountID}`).catch(() => null),
]);

const spotVusdc = balance(spot);
const perpsVusdc = balance(perps);
const eligible = spotVusdc !== null && perpsVusdc !== null && spotVusdc >= 100 && perpsVusdc >= 100;

console.log(JSON.stringify({
  network: "mainnet",
  address,
  builderID: accountID,
  spotVusdc,
  perpsVusdc,
  eligible,
  builderStats: summary?.data ?? null,
}, null, 2));

if (!eligible) {
  console.error("Builder is not approval-eligible yet: SoDEX requires >=100 vUSDC in BOTH Spot and Perps.");
  process.exitCode = 2;
}
