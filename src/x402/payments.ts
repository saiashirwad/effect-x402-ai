import { ExactEvmScheme } from "@x402/evm";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { FetchHttpClient } from "@effect/platform";
import { Data, Effect, Layer, Schema } from "effect";

import { Wallet } from "./wallet.js";
import type { WalletAccount } from "./wallet.js";

export class X402PaymentError extends Data.TaggedError("X402/PaymentError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const NetworkId = Schema.TemplateLiteral(
  Schema.String,
  Schema.Literal(":"),
  Schema.String,
);
export type NetworkId = typeof NetworkId.Type;

export const evmExact = (
  fetch: typeof globalThis.fetch,
  account: WalletAccount,
  network: string,
): Effect.Effect<typeof globalThis.fetch, X402PaymentError, never> =>
  Effect.gen(function* () {
    const id = yield* Schema.decodeUnknown(NetworkId)(network).pipe(
      Effect.mapError(
        (cause) =>
          new X402PaymentError({
            message: `Invalid x402 network identifier: ${network}`,
            cause,
          }),
      ),
    );
    // @x402/fetch's wrapped fetch signature differs from global fetch; cast to satisfy Effect's FetchHttpClient.Fetch.
    return wrapFetchWithPaymentFromConfig(fetch, {
      schemes: [{ network: id, client: new ExactEvmScheme(account) }],
    }) as typeof globalThis.fetch;
  });

export const layer = (
  network: NetworkId,
): Layer.Layer<FetchHttpClient.Fetch, X402PaymentError, Wallet> =>
  Layer.effect(
    FetchHttpClient.Fetch,
    Effect.gen(function* () {
      const { account } = yield* Wallet;
      return yield* evmExact(globalThis.fetch, account, network);
    }),
  );
