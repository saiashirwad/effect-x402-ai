import { LanguageModel } from "@effect/ai";
import { Config, Effect, Layer, Schema } from "effect";

import { CustomJsonAdapter } from "./x402/adapters/custom-json.js";
import { X402LanguageModel } from "./x402/language-model.js";
import * as Payments from "./x402/payments.js";
import { Wallet } from "./x402/wallet.js";

const ELFA_API_URL = "https://api.elfa.ai/x402/v2";
const MODEL = "elfa-chat";

const ElfaChatResponse = Schema.transform(
  Schema.Struct({
    data: Schema.Struct({
      message: Schema.String,
    }),
  }),
  Schema.Struct({
    message: Schema.String,
  }),
  {
    strict: true,
    decode: (input) => ({ message: input.data.message }),
    encode: (output) => ({ data: { message: output.message } }),
  },
);

const getSpeed = Config.string("ELFA_SPEED").pipe(
  Effect.orElseSucceed(() => "expert"),
);

const ElfaModel = X402LanguageModel.make({
  model: MODEL,
  adapter: CustomJsonAdapter.layer({
    id: "ElfaClient",
    apiUrl: ELFA_API_URL,
    endpoint: "/chat",
    model: MODEL,
    buildRequest: ({ message }) =>
      Effect.map(getSpeed, (speed) => ({
        message,
        analysisType: "chat",
        speed,
      })),
    responseSchema: ElfaChatResponse,
  }),
  payment: Payments.layer("eip155:*"),
});

const program = Effect.gen(function* () {
  const response = yield* LanguageModel.generateText({
    prompt: "What is the current sentiment on BTC?",
  });
  const { account } = yield* Wallet;
  const speed = yield* getSpeed;

  yield* Effect.log("Wallet: ", account.address);
  yield* Effect.log("model: ", MODEL);
  yield* Effect.log("speed: ", speed);
  yield* Effect.log("response: ", response.text);
}).pipe(
  Effect.provide(Layer.provideMerge(ElfaModel, Wallet.Default)),
);

Effect.runPromise(program);
