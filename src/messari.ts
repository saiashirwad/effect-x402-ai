import { LanguageModel } from "@effect/ai";
import { Effect, Layer, Schema } from "effect";

import { CustomJsonAdapter } from "./x402/adapters/custom-json.js";
import { X402LanguageModel } from "./x402/language-model.js";
import * as Payments from "./x402/payments.js";
import { Wallet } from "./x402/wallet.js";

const MESSARI_API_URL = "https://api.messari.io/ai/v2";
const MODEL = "messari";

const MessariChatResponse = Schema.transform(
  Schema.Struct({
    data: Schema.Struct({
      messages: Schema.Array(
        Schema.Struct({
          role: Schema.optional(Schema.String),
          content: Schema.String,
        }),
      ),
    }),
  }),
  Schema.Struct({
    message: Schema.String,
  }),
  {
    strict: true,
    decode: (input) => ({
      message:
        input.data.messages.find((message) => message.role === "assistant")
          ?.content ??
        input.data.messages.at(-1)?.content ??
        "",
    }),
    encode: (output) => ({
      data: { messages: [{ role: "assistant", content: output.message }] },
    }),
  },
);

const MessariModel = X402LanguageModel.make({
  model: MODEL,
  adapter: CustomJsonAdapter.layer({
    id: "MessariClient",
    apiUrl: MESSARI_API_URL,
    endpoint: "/chat/completions",
    model: MODEL,
    buildRequest: ({ message }) =>
      Effect.succeed({
        messages: [{ role: "user", content: message }],
        response_format: "markdown",
        stream: false,
        verbosity: "succinct",
      }),
    responseSchema: MessariChatResponse,
  }),
  payment: Payments.layer("eip155:*"),
});

const MessariRuntime = Layer.provideMerge(MessariModel, Wallet.Default);

const program = Effect.gen(function* () {
  const response = yield* LanguageModel.generateText({
    prompt: "What changed in crypto markets this week?",
  });
  const { account } = yield* Wallet;

  yield* Effect.log("Wallet: ", account.address);
  yield* Effect.log("model: ", MODEL);
  yield* Effect.log("response: ", response.text);
}).pipe(Effect.provide(MessariRuntime));

Effect.runPromise(program);
