import { Generated } from "@effect/ai-openai";
import { HttpClient, HttpClientResponse } from "@effect/platform";
import { randomUUID } from "node:crypto";
import { Effect, Schema } from "effect";

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

export type ResponsesInput = ReadonlyArray<{
  readonly role: string;
  readonly content: string | ReadonlyArray<{ readonly text?: string }>;
}>;

const ChatCompletionJson = Schema.Struct({
  choices: Schema.optional(
    Schema.Array(
      Schema.Struct({
        message: Schema.optional(
          Schema.Record({ key: Schema.String, value: Schema.Unknown }),
        ),
        logprobs: Schema.optional(Schema.Unknown),
      }).pipe(
        Schema.extend(
          Schema.Record({ key: Schema.String, value: Schema.Unknown }),
        ),
      ),
    ),
  ),
}).pipe(
  Schema.extend(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
);

const readChatCompletionJson = Schema.decodeUnknown(ChatCompletionJson);

export const toChatMessages = (input: ResponsesInput) =>
  input.map((message) => ({
    role: message.role === "developer" ? "system" : message.role,
    content:
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) => part.text ?? "").join(""),
  }));

export const fromChatCompletion = (
  chat: typeof Generated.CreateChatCompletionResponse.Type,
): Generated.Response =>
  ({
    ...RESPONSE_DEFAULTS,
    id: chat.id,
    created_at: chat.created,
    model: chat.model,
    status: "completed",
    output: [
      {
        type: "message",
        id: randomUUID(),
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: chat.choices[0]?.message.content ?? "",
            annotations: [],
          },
        ],
      },
    ],
    usage: chat.usage && {
      input_tokens: chat.usage.prompt_tokens,
      output_tokens: chat.usage.completion_tokens,
    },
  }) as unknown as Generated.Response;

export const patchChatCompletionResponse = HttpClient.transformResponse(
  Effect.flatMap((response) => {
    if (!response.request.url.endsWith("/chat/completions")) {
      return Effect.succeed(response);
    }

    return response.json.pipe(
      Effect.flatMap(readChatCompletionJson),
      Effect.orDie,
      Effect.map((body) => ({
        ...body,
        choices: body.choices?.map((choice) => ({
          logprobs: null,
          ...choice,
          message: choice.message && {
            refusal: null,
            annotations: null,
            audio: null,
            function_call: null,
            tool_calls: [],
            ...choice.message,
          },
        })),
      })),
      Effect.map((body) =>
        HttpClientResponse.fromWeb(
          response.request,
          new Response(JSON.stringify(body), {
            status: response.status,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );
  }),
);

