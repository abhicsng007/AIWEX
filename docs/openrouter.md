# OpenRouter agent provider

Set `OPENROUTER_API_KEY` in a local `.env.local` file to enable live AI teammates. The key is read only by the server-side agent provider and is never sent to the browser.

`OPENROUTER_MODELS` is a comma-separated primary model plus fallbacks. The default list is intentionally inexpensive and can be changed without code changes:

```env
OPENROUTER_MODELS=deepseek/deepseek-chat-v3-0324,meta-llama/llama-3.1-8b-instruct,mistralai/mistral-nemo
```

OpenRouter receives the first item as `model` and the remaining items as its ordered `models` fallbacks. The provider has a 12-second configurable timeout, retries transient gateway failures once, and then uses the deterministic role-aware simulator provider if no model can answer. This keeps learning flows available during rate limits or outages.

Use the OpenRouter Models API to choose currently available model IDs and supported parameters before changing the list. For stricter data handling, set `OPENROUTER_DATA_COLLECTION=deny`; this may reduce routing options.
