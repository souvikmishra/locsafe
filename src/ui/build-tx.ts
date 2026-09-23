import { isAddress, type Hex } from "viem";
import { ZERO_ADDRESS, type SafeTx } from "../domain/types.ts";
import { sameAddress } from "../lib/utils.ts";
import { encodeOwnerChange, prevOwnerOf, SENTINEL_OWNERS } from "../rpc/execute.ts";
import type { SafeSnapshot } from "../rpc/safe.ts";

/**
 * Turns the New transaction form into a SafeTx. Owner changes are checked
 * against the freshly read owner set with the same rules the Safe enforces,
 * so a transaction that would always revert is never offered for signing.
 */
export function buildSafeTx(form: FormData, snapshot: SafeSnapshot): SafeTx {
  const owners = snapshot.owners;
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const address = (name: string, label: string) => {
    const value = text(name);
    if (!isAddress(value)) throw new Error(`${label} is not a valid address.`);
    return value;
  };
  const newOwner = (name: string, label: string) => {
    const value = address(name, label);
    if (owners.some((o) => sameAddress(o, value))) {
      throw new Error(`${value} is already an owner of this Safe.`);
    }
    if ([ZERO_ADDRESS, SENTINEL_OWNERS, snapshot.address].some((a) => sameAddress(a, value))) {
      throw new Error(`${label} can't be the zero address, 0x…0001 or the Safe itself.`);
    }
    return value;
  };
  const integer = (name: string, label: string) => {
    const value = text(name) || "0";
    if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole number.`);
    return BigInt(value);
  };
  const threshold = (ownersAfter: number) => {
    const value = integer("threshold", "Threshold");
    if (value < 1n || value > BigInt(ownersAfter)) {
      throw new Error(`Threshold must be between 1 and ${ownersAfter}.`);
    }
    return value;
  };

  let to = snapshot.address;
  let value = 0n;
  let data: Hex = "0x";
  let operation: 0 | 1 = 0;
  switch (text("kind")) {
    case "eth":
      to = address("to", "Recipient");
      value = integer("value", "Amount");
      break;
    case "arbitrary": {
      to = address("to", "Contract address");
      value = integer("value", "Amount");
      const raw = text("data") || "0x";
      if (!/^0x([0-9a-fA-F]{2})*$/.test(raw)) throw new Error("Data must be 0x-prefixed hex bytes.");
      data = raw as Hex;
      operation = text("operation") === "1" ? 1 : 0;
      break;
    }
    case "addOwner":
      data = encodeOwnerChange("addOwnerWithThreshold", {
        owner: newOwner("owner", "New owner"),
        threshold: threshold(owners.length + 1),
      });
      break;
    case "removeOwner": {
      if (owners.length <= 1) throw new Error("A Safe must keep at least one owner.");
      const owner = address("owner", "Owner");
      data = encodeOwnerChange("removeOwner", {
        prevOwner: prevOwnerOf(owners, owner),
        owner,
        threshold: threshold(owners.length - 1),
      });
      break;
    }
    case "swapOwner": {
      const oldOwner = address("oldOwner", "Current owner");
      data = encodeOwnerChange("swapOwner", {
        prevOwner: prevOwnerOf(owners, oldOwner),
        oldOwner,
        newOwner: newOwner("newOwner", "New owner"),
      });
      break;
    }
    case "changeThreshold":
      data = encodeOwnerChange("changeThreshold", { threshold: threshold(owners.length) });
      break;
    default:
      throw new Error("Choose a transaction type.");
  }
  return {
    to,
    value,
    data,
    operation,
    safeTxGas: 0n,
    baseGas: 0n,
    gasPrice: 0n,
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce: snapshot.nonce,
  };
}
