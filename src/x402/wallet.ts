import { Config, Data, Effect, Redacted } from "effect";
import { mnemonicToAccount } from "viem/accounts";
import type { HDAccount } from "viem/accounts";

export class WalletError extends Data.TaggedError("X402/WalletError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class Wallet extends Effect.Service<Wallet>()("X402/Wallet", {
  effect: Effect.gen(function* () {
    const seedPhrase = yield* Config.redacted("SEED_PHRASE");
    const account = yield* Effect.try({
      try: () => mnemonicToAccount(Redacted.value(seedPhrase)),
      catch: (cause) =>
        new WalletError({
          message: "Unable to derive wallet from SEED_PHRASE",
          cause,
        }),
    });
    return { account } as const;
  }),
}) {}

export type WalletAccount = HDAccount;
