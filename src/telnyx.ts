import { LanguageModel } from "@effect/ai";
import { Effect, Layer } from "effect";

import { OpenAiChatAdapter } from "./x402/adapters/openai-chat.js";
import { X402LanguageModel } from "./x402/language-model.js";
import * as Payments from "./x402/payments.js";
import { Wallet } from "./x402/wallet.js";

const TELNYX_API_URL = "https://x402.telnyx.com/v1";
const MODEL = "MiniMaxAI/MiniMax-M2.7";
const MAX_TOKENS = 512;

const TelnyxModel = X402LanguageModel.make({
  model: MODEL,
  adapter: OpenAiChatAdapter.layer({
    id: "TelnyxClient",
    apiUrl: TELNYX_API_URL,
    model: MODEL,
    maxTokens: MAX_TOKENS,
  }),
  payment: Payments.layer("eip155:*"),
});

const TelnyxRuntime = Layer.provideMerge(TelnyxModel, Wallet.Default);

const program = Effect.gen(function*() {
  const response = yield* LanguageModel.generateText({
    prompt: "Tell me a knock knock joke",
  });
  const { account } = yield* Wallet;

  yield* Effect.log("Wallet: ", account.address);
  yield* Effect.log("model: ", MODEL);
  yield* Effect.log("response: ", response.text);
}).pipe(Effect.provide(TelnyxRuntime));

Effect.runPromise(program);
