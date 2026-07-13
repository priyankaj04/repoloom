# MCP Server Skill

This skill activates when `@modelcontextprotocol/sdk` is in the project's dependencies.
Apply these rules whenever building or modifying an MCP server.

## Server Setup

Always instantiate `McpServer` with a name and version — Claude and other clients display
this in their UI. Export the server instance so it can be tested in isolation.

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
const server = new McpServer({ name: "my-server", version: "1.0.0" });
```

## Tool Registration

Every tool needs three things: a name, a description Claude will read to decide when to
call it, and an `inputSchema` defined with Zod.

- Tool descriptions are user-facing prompts. Write them as instructions: "Returns the
  current weather for a city. Input: city name and optional unit (celsius/fahrenheit)."
- Use `z.object({})` for all inputs. Never accept raw `any`.
- Validate and transform inputs before doing any I/O.
- Return `{ content: [{ type: "text", text: "..." }] }` for text, or `type: "image"` for
  image data with a `mimeType`.

```ts
import { z } from "zod";
server.tool("get-weather", "Returns current weather for a city.", {
  city: z.string().describe("City name"),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
}, async ({ city, unit }) => {
  const data = await fetchWeather(city, unit);
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
```

## Resource Registration

Resources expose data Claude can read on demand. Use URI templates (`{param}`) for
dynamic resources.

```ts
server.resource("user-profile", "users://{userId}/profile",
  async (uri, { userId }) => ({
    contents: [{ uri: uri.href, mimeType: "application/json",
      text: JSON.stringify(await getUser(userId)) }],
  })
);
```

## Prompt Registration

Register prompt templates for reusable multi-turn conversation starters.
Arguments are declared with `required: true/false`.

```ts
server.prompt("code-review", "Review code for bugs and style issues", [
  { name: "language", description: "Programming language", required: true },
  { name: "code", description: "Code to review", required: true },
], ({ language, code }) => ({
  messages: [{ role: "user", content: {
    type: "text",
    text: `Review this ${language} code:\n\n${code}`,
  }}],
}));
```

## Error Handling

Use `McpError` with `ErrorCode` constants — never throw raw `Error` objects from tools.
The SDK maps these to the correct JSON-RPC error codes in the protocol.

```ts
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
throw new McpError(ErrorCode.InvalidParams, `City "${city}" not found`);
```

Common codes: `InvalidParams`, `MethodNotFound`, `InternalError`.

## Transport: stdio vs HTTP/SSE

- **stdio**: Use for CLI tools and local integrations. One process per client session.
  `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.
- **HTTP/SSE**: Use for multi-client web deployments or remote servers.
  `SSEServerTransport` from `@modelcontextprotocol/sdk/server/sse.js`.

```ts
// stdio (CLI)
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
await server.connect(new StdioServerTransport());

// HTTP/SSE (web)
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
app.get("/sse", (req, res) => server.connect(new SSEServerTransport("/messages", res)));
```

## Input Validation Policy

Validate all inputs with Zod before any downstream call. Reject early with `McpError`
rather than letting invalid data propagate into business logic or external APIs.

## Testing

Use `@modelcontextprotocol/inspector` to interactively test tools and resources during
development: `npx @modelcontextprotocol/inspector node dist/index.js`.
For automated tests, call `server.tool()` handlers directly by importing them, or use
the SDK's in-process transport.
