import * as AiError from "@effect/ai/AiError";
import { Generated, OpenAiClient } from "@effect/ai-openai";
import { FetchHttpClient, HttpBody, HttpClient } from "@effect/platform";
import { randomUUID } from "node:crypto";
import { Effect, Layer, Schema } from "effect";

import { TypeId, X402LanguageModelAdapter } from "../adapter.js";

type ResponsesInput = ReadonlyArray<{
  readonly role: string;
  readonly content: string | ReadonlyArray<{ readonly text?: string }>;
}>;

export const toMessage = (input: ResponsesInput): string =>
  input
    .map((message) => {
      const role = message.role === "developer" ? "system" : message.role;
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content.map((part) => part.text ?? "").join("");
      return `${role}: ${content}`;
    })
    .join("\n\n");

type ResponseEncoded = Schema.Schema.Encoded<typeof Generated.Response>;

const RESPONSE_DEFAULTS = {
  object: "response",
  parallel_tool_calls: false,
  tools: [],
  tool_choice: "auto",
  temperature: null,
  top_p: null,
  metadata: {},
  instructions: null,
  incomplete_details: null,
  error: null,
} satisfies Partial<ResponseEncoded>;

export const fromCustomJson = (options: {
  readonly model: string;
  readonly message: string;
}): Generated.Response =>
  ({
    ...RESPONSE_DEFAULTS,
    id: randomUUID(),
    created_at: Math.floor(Date.now() / 1000),
    model: options.model,
    status: "completed",
    output: [
      {
        type: "message",
        id: randomUUID(),
        role: "assistant",
        status: "completed",
        content: [
          { type: "output_text", text: options.message, annotations: [] },
        ],
      },
    ],
  }) as unknown as Generated.Response;

export const layer = <I>(config: {
  readonly id: string;
  readonly apiUrl: string;
  readonly endpoint: string;
  readonly model: string;
  readonly buildRequest: (input: {
    readonly message: string;
  }) => Effect.Effect<unknown, never, never>;
  readonly responseSchema: Schema.Schema<{ readonly message: string }, I>;
}) =>
  Layer.scoped(
    X402LanguageModelAdapter,
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      const decode = Schema.decodeUnknown(config.responseSchema);

      const createResponse: OpenAiClient.Service["createResponse"] = (options) =>
        Effect.gen(function* () {
          const message = toMessage(
            options.input as unknown as ResponsesInput,
          );
          const body = yield* config.buildRequest({ message });
          const response = yield* httpClient.post(`${config.apiUrl}${config.endpoint}`, {
            body: HttpBody.unsafeJson(body),
          });
          const json = yield* response.json;
          const decoded = yield* decode(json);
          return fromCustomJson({
            model: config.model,
            message: decoded.message,
          });
        }).pipe(
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

export const CustomJsonAdapter = { layer };
