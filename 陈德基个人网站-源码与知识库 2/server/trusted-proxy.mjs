import net from "node:net";

function validNetwork(value) {
  const slash = value.lastIndexOf("/");
  const address = slash === -1 ? value : value.slice(0, slash);
  const family = net.isIP(address);
  if (!family) return false;
  if (slash === -1) return true;
  const prefix = Number(value.slice(slash + 1));
  return Number.isInteger(prefix) && prefix > 0 && prefix <= (family === 4 ? 32 : 128);
}

export function trustedProxyNetworks(value) {
  const entries = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!entries.length) return false;
  if (entries.length > 16 || entries.some((entry) => !validNetwork(entry))) {
    throw new Error("TRUSTED_PROXY_NETWORKS 只能包含明确的代理 IP 或非全网 CIDR。");
  }
  return entries;
}
