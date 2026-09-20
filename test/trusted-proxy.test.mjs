import test from "node:test";
import assert from "node:assert/strict";
import { trustedProxyNetworks } from "../server/trusted-proxy.mjs";

test("未配置可信代理时不信任转发头", () => {
  assert.equal(trustedProxyNetworks(""), false);
});

test("只接受明确的代理 IP 或有限 CIDR", () => {
  assert.deepEqual(trustedProxyNetworks("127.0.0.1, 10.20.0.0/16"), ["127.0.0.1", "10.20.0.0/16"]);
  assert.throws(() => trustedProxyNetworks("0.0.0.0/0"));
  assert.throws(() => trustedProxyNetworks("::/0"));
  assert.throws(() => trustedProxyNetworks("true"));
});
