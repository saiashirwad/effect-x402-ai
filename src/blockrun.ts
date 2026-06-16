import { LanguageModel } from "@effect/ai";
import { Effect, Layer } from "effect";

import { OpenAiChatAdapter } from "./x402/adapters/openai-chat.js";
import { X402LanguageModel } from "./x402/language-model.js";
import * as Payments from "./x402/payments.js";
import { Wallet } from "./x402/wallet.js";

const BLOCKRUN_API_URL = "https://blockrun.ai/api/v1";
const MODEL = "openai/gpt-5-nano";
const MAX_TOKENS = 512;

const BlockRunModel = X402LanguageModel.make({
  model: MODEL,
  adapter: OpenAiChatAdapter.layer({
    id: "BlockRunClient",
    apiUrl: BLOCKRUN_API_URL,
    model: MODEL,
    maxTokens: MAX_TOKENS,
  }),
  payment: Payments.layer("eip155:*"),
});

const BlockRunRuntime = Layer.provideMerge(BlockRunModel, Wallet.Default);

const program = Effect.gen(function*() {
  const response = yield* LanguageModel.generateText({
    prompt: "Tell me a knock knock joke",
  });
  const { account } = yield* Wallet;

  yield* Effect.log("Wallet: ", account.address);
  yield* Effect.log("model: ", MODEL);
  yield* Effect.log("response: ", response.text);
}).pipe(Effect.provide(BlockRunRuntime));

Effect.runPromise(program);
