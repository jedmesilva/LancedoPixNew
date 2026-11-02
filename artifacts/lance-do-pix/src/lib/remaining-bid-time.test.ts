import assert from "node:assert/strict";
import test from "node:test";
import {
  describeRemainingBidTime,
  formatRemainingBidTime,
} from "./remaining-bid-time";

test("formats seconds and minute countdowns at the 59-second boundary", () => {
  assert.equal(formatRemainingBidTime(0), "0s");
  assert.equal(formatRemainingBidTime(59), "59s");
  assert.equal(formatRemainingBidTime(60), "01:00");
  assert.equal(formatRemainingBidTime(3_599), "59:59");
});

test("formats hour countdowns with hours, minutes, and seconds", () => {
  assert.equal(formatRemainingBidTime(3_600), "01:00:00");
  assert.equal(formatRemainingBidTime(86_400), "24:00:00");
});

test("provides an accessible countdown description", () => {
  assert.equal(describeRemainingBidTime(59), "59 segundos");
  assert.equal(describeRemainingBidTime(60), "1 minuto");
  assert.equal(describeRemainingBidTime(3_661), "1 hora, 1 minuto, 1 segundo");
});
