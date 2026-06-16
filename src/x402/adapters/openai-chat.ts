import * as AiError from "@effect/ai/AiError";
import { OpenAiClient } from "@effect/ai-openai";
import { FetchHttpClient } from "@effect/platform";
import { Effect, Layer } from "effect";

import {
  fromChatCompletion,
  patchChatCompletionResponse,
  toChatMessages,
  type ResponsesInput,
} from "../../openai-chat-completions.js";
import { TypeId, X402LanguageModelAdapter } from "../adapter.js";

export const layer = (config: {
  readonly id: string;
  readonly apiUrl: string;
  readonly model: string;
  readonly maxTokens: number;
}) =>
  Layer.scoped(
    X402LanguageModelAdapter,
    Effect.gen(function* () {
      const providerClient = yield* OpenAiClient.make({
        apiUrl: config.apiUrl,
        transformClient: (client) => client.pipe(patchChatCompletionResponse),
      });

      const createResponse: OpenAiClient.Service["createResponse"] = (options) =>
        providerClient.client
          .createChatCompletion({
            model: options.model ?? config.model,
            max_tokens: config.maxTokens,
            messages: toChatMessages(
              options.input as unknown as ResponsesInput,
            ) as never,
          })
          .pipe(
            Effect.map(fromChatCompletion),
            Effect.catchTags({
              RequestError: (error) =>
                AiError.HttpRequestError.fromRequestError({
                  module: config.id,
                  method: "createResponse",
                  error,
                }),
              ResponseError: (error) =>
                AiError.HttpResponseError.fromResponseError({
                  module: config.id,
                  method: "createResponse",
                  error,
                }),
              ParseError: (error) =>
                AiError.MalformedOutput.fromParseError({
                  module: config.id,
                  method: "createResponse",
                  error,
                }),
            }),
          );

      return {
        [TypeId]: TypeId,
        createResponse,
      };
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer));

export const OpenAiChatAdapter = { layer };
