import { OpenAiClient } from "@effect/ai-openai";
import { Context } from "effect";

export const TypeId = "~venice/X402LanguageModelAdapter" as const;

export interface X402LanguageModelAdapter {
  readonly [TypeId]: typeof TypeId;
  readonly createResponse: OpenAiClient.Service["createResponse"];
}

export const X402LanguageModelAdapter = Context.GenericTag<X402LanguageModelAdapter>(
  "X402/LanguageModelAdapter",
);
