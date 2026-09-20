/**
 * Fireworks capability choices, checked against the public documentation.
 * https://docs.fireworks.ai/api-reference/post-chatcompletions#body-reasoning-effort
 * https://docs.fireworks.ai/structured-responses/structured-response-formatting
 *
 * The configured model is never changed or logged here. Custom deployments and
 * unrecognized model families keep the existing JSON-object request format,
 * without speculative reasoning parameters. Recheck this matrix before adding
 * new families: some models reject `none` rather than silently ignoring it.
 */
export type JsonSchema = Record<string, unknown>;
export type FireworksReasoningOptions = {reasoning_effort?: 'none' | 'low'};
export type FireworksJsonOptions = FireworksReasoningOptions & {
  response_format:
    | {type: 'json_object'}
    | {type: 'json_schema'; json_schema: {name: string; schema: JsonSchema}};
};

export function fireworksReasoningOptions(model?: string): FireworksReasoningOptions {
  // Match public model paths only; a similarly named private deployment does
  // not establish its conversation template or supported inference options.
  const id = /^accounts\/fireworks\/models\/([a-z0-9._-]+)$/i.exec(model || '')?.[1].toLowerCase();
  if (!id) return {};

  // These documented families support disabling reasoning. Qwen instruct/coder
  // variants can use different conversation templates, so avoid guessing their
  // settings from the Qwen brand alone.
  const hybrid = /^(?:qwen3-(?:235b-a22b|30b-a3b|32b|14b|8b|4b|1p7b|0p6b)$|qwen3p[568](?:-|$)|deepseek-v3(?:p|\.|-)[12](?:-|$)|deepseek-v4(?:p1|\.1|-1)?(?:-|$)|glm-(?:4(?:p|\.|-)[567]|5(?:p|\.|-)[12])(?:-|$)|kimi-k3(?:-|$))/.test(id);
  if (hybrid) return {reasoning_effort: 'none'};

  // Harmony and MiniMax M2 require reasoning. The documented low setting is
  // valid; `none`, boolean false and integer budgets must not be sent to them.
  if (/^(?:gpt-oss-(?:120b|20b)(?:-|$)|minimax-m2(?:p\d+|\.\d+)?(?:-|$))/.test(id)) {
    return {reasoning_effort: 'low'};
  }
  return {};
}

/**
 * Enforce the caller's schema for documented families. The prompt must still
 * describe the schema, and the caller must validate content and semantic
 * support: constrained JSON alone does not establish a trustworthy answer.
 */
export function fireworksJsonOptions(model: string | undefined, name: string, schema: JsonSchema): FireworksJsonOptions {
  const reasoning = fireworksReasoningOptions(model);
  if (!reasoning.reasoning_effort) return {response_format: {type: 'json_object'}};
  return {...reasoning, response_format: {type: 'json_schema', json_schema: {name, schema}}};
}

export const PLANNING_JSON_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['query', 'category', 'action', 'clarification'],
  properties: {
    query: {type: 'string', maxLength: 500},
    category: {type: 'string', enum: ['general', 'government', 'legal', 'health', 'finance', 'shopping', 'food', 'culture', 'technology']},
    action: {type: 'string', enum: ['search', 'clarify', 'refuse']},
    clarification: {type: 'string', maxLength: 350},
  },
};

export const REVIEW_JSON_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['missingEssentialActions', 'complete', 'feedback', 'supported', 'safe', 'languageCorrect'],
  properties: {
    missingEssentialActions: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 160}},
    complete: {type: 'boolean'},
    feedback: {type: 'string', maxLength: 700},
    supported: {type: 'boolean'},
    safe: {type: 'boolean'},
    languageCorrect: {type: 'boolean'},
  },
};

export function routerJsonSchema(guideIds: readonly string[]): JsonSchema {
  return {
    type: 'object', additionalProperties: false, required: ['guideId'],
    properties: {guideId: {type: 'string', enum: [...new Set([...guideIds, 'unknown'])]}},
  };
}
