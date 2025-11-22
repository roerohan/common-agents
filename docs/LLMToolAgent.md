# LLMToolAgent

**Type:** Permanent (Long-Lived)

## Overview

LLMToolAgent provides an interface for interacting with Large Language Models (LLMs) with conversation history management and tool calling capabilities. It serves as a foundation for building AI-powered agents that can maintain context and use tools.

## Responsibilities

- Execute LLM prompts with context
- Maintain conversation history
- Register and manage tool definitions
- Handle multi-turn conversations
- Track token usage
- Support system prompts and parameters

## Lifecycle

LLMToolAgent is a permanent agent that:
1. **Initializes** with empty conversation history
2. **Executes prompts** continuously
3. **Maintains conversation state** across invocations
4. **Manages tools** for LLM function calling
5. **Persists indefinitely** with conversation context

## Callable Methods

### `executePrompt(prompt: string, context?: unknown): Promise<LLMResponse>`

Execute an LLM prompt and get a response.

**Parameters:**
- `prompt` - The user prompt/message
- `context` - Optional additional context data

**Returns:** LLMResponse containing:
- `content` - The LLM's text response
- `toolCalls` - Array of tool calls (if any)
- `usage` - Token usage information

**Example:**
```typescript
const response = await llmAgent.executePrompt(
  'What is the weather like in San Francisco?',
  { location: 'San Francisco', units: 'fahrenheit' }
);

console.log('Response:', response.content);

if (response.toolCalls) {
  console.log('Tool calls:', response.toolCalls);
}

if (response.usage) {
  console.log(`Tokens used: ${response.usage.totalTokens}`);
}
```

### `continueConversation(message: string): Promise<LLMResponse>`

Continue an existing conversation with context.

**Example:**
```typescript
// First message
await llmAgent.executePrompt('My name is Alice');

// Continue conversation
const response = await llmAgent.continueConversation('What is my name?');
console.log(response.content); // "Your name is Alice"
```

### `addTool(tool: LLMTool): Promise<void>`

Register a tool that the LLM can call.

**Parameters:**
- `tool` - LLMTool definition:
  - `name` - Tool name
  - `description` - What the tool does
  - `parameters` - JSON schema for parameters

**Example:**
```typescript
await llmAgent.addTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name'
      },
      units: {
        type: 'string',
        enum: ['celsius', 'fahrenheit']
      }
    },
    required: ['location']
  }
});

await llmAgent.addTool({
  name: 'search_database',
  description: 'Search the product database',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  }
});
```

### `clearHistory(): Promise<void>`

Clear conversation history and start fresh.

**Example:**
```typescript
await llmAgent.clearHistory();
console.log('Conversation history cleared');
```

## Protected Methods (For Subclasses)

### `executePrompt(prompt: string, context?: unknown): Promise<LLMResponse>`

**Must be overridden** to call actual LLM API.

**Example Implementation:**
```typescript
class OpenAIAgent extends LLMToolAgent<Env, LLMToolAgentState> {
  override async executePrompt(
    prompt: string,
    context?: unknown
  ): Promise<LLMResponse> {
    // Build messages array
    const messages = [
      ...this.state.conversationHistory,
      { role: 'user', content: prompt }
    ];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(this.env as any).OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        tools: this.state.tools.length > 0 ? this.formatTools() : undefined,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();
    const choice = data.choices[0];

    // Update conversation history
    this.setState({
      ...this.state,
      conversationHistory: [
        ...this.state.conversationHistory,
        { role: 'user', content: prompt },
        { role: 'assistant', content: choice.message.content }
      ]
    });

    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls?.map((tc: any) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      })),
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      }
    };
  }

  private formatTools() {
    return this.state.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }
}
```

## Complete Example

```typescript
import { LLMToolAgent, type LLMResponse, type LLMTool } from 'common-agents';
import { callable } from 'agents';

class CustomerServiceAgent extends LLMToolAgent<Env, LLMToolAgentState> {
  override async initialize(): Promise<void> {
    await super.initialize();
    await this.registerTools();
  }

  private async registerTools() {
    // Register customer lookup tool
    await this.addTool({
      name: 'lookup_customer',
      description: 'Look up customer information by email or ID',
      parameters: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Customer email or ID'
          }
        },
        required: ['identifier']
      }
    });

    // Register order lookup tool
    await this.addTool({
      name: 'lookup_order',
      description: 'Look up order details by order ID',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'Order ID'
          }
        },
        required: ['orderId']
      }
    });

    // Register refund tool
    await this.addTool({
      name: 'process_refund',
      description: 'Process a refund for an order',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          amount: { type: 'number' },
          reason: { type: 'string' }
        },
        required: ['orderId', 'amount']
      }
    });
  }

  override async executePrompt(
    prompt: string,
    context?: unknown
  ): Promise<LLMResponse> {
    // Add system prompt for customer service context
    const systemPrompt = `You are a helpful customer service agent.
Be polite, professional, and use the available tools to help customers.
Always confirm before processing refunds.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.state.conversationHistory,
      { role: 'user', content: prompt }
    ];

    // Call LLM API (e.g., Cloudflare AI, OpenAI, etc.)
    const response = await this.callLLMAPI(messages);

    // Handle tool calls if any
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall.name, toolCall.arguments);
        // In a real implementation, you'd feed the tool result back to the LLM
      }
    }

    // Update history
    this.setState({
      ...this.state,
      conversationHistory: [
        ...this.state.conversationHistory,
        { role: 'user', content: prompt },
        { role: 'assistant', content: response.content }
      ]
    });

    return response;
  }

  private async callLLMAPI(messages: any[]): Promise<LLMResponse> {
    // Implement actual LLM API call
    // This is a placeholder
    return {
      content: 'How can I help you today?'
    };
  }

  // Tool execution handlers
  @callable()
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'lookup_customer':
        return this.lookupCustomer(args.identifier as string);
      case 'lookup_order':
        return this.lookupOrder(args.orderId as string);
      case 'process_refund':
        return this.processRefund(
          args.orderId as string,
          args.amount as number,
          args.reason as string
        );
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async lookupCustomer(identifier: string) {
    // Database lookup
    return {
      id: 'cust-123',
      email: identifier,
      name: 'John Doe',
      tier: 'premium'
    };
  }

  private async lookupOrder(orderId: string) {
    // Database lookup
    return {
      id: orderId,
      status: 'shipped',
      total: 99.99,
      items: ['Product A', 'Product B']
    };
  }

  private async processRefund(orderId: string, amount: number, reason?: string) {
    this.log(`Processing refund for order ${orderId}: $${amount}`);
    // Refund processing logic
    return {
      success: true,
      refundId: 'ref-' + Date.now(),
      amount
    };
  }
}
```

## Common Usage Pattern

```typescript
// 1. Initialize agent
const agent = await getAgentByName(env, 'CUSTOMER_SERVICE_AGENT', 'main');

// 2. Handle customer query
const response = await agent.executePrompt(
  'I need help with order #12345'
);

console.log('Agent:', response.content);

// 3. Continue conversation
const response2 = await agent.continueConversation(
  'Can you issue a refund?'
);

console.log('Agent:', response2.content);

// 4. Handle tool calls
if (response2.toolCalls) {
  for (const toolCall of response2.toolCalls) {
    console.log(`Calling tool: ${toolCall.name}`);
    const result = await agent.executeTool(toolCall.name, toolCall.arguments);
    console.log('Tool result:', result);
  }
}

// 5. Clear history when conversation ends
await agent.clearHistory();
```

## Integration with Cloudflare AI

```typescript
import { Ai } from '@cloudflare/ai';

class CloudflareAIAgent extends LLMToolAgent<Env, LLMToolAgentState> {
  private ai: Ai;

  override async initialize(): Promise<void> {
    await super.initialize();
    this.ai = new Ai((this.env as any).AI);
  }

  override async executePrompt(
    prompt: string,
    context?: unknown
  ): Promise<LLMResponse> {
    const messages = [
      ...this.state.conversationHistory,
      { role: 'user', content: prompt }
    ];

    const response = await this.ai.run('@cf/meta/llama-2-7b-chat-int8', {
      messages,
      stream: false
    });

    this.setState({
      ...this.state,
      conversationHistory: [
        ...this.state.conversationHistory,
        { role: 'user', content: prompt },
        { role: 'assistant', content: response.response }
      ]
    });

    return {
      content: response.response
    };
  }
}
```

## RAG (Retrieval Augmented Generation) Example

```typescript
class RAGAgent extends LLMToolAgent<Env, LLMToolAgentState> {
  override async executePrompt(
    prompt: string,
    context?: unknown
  ): Promise<LLMResponse> {
    // 1. Retrieve relevant context from knowledge base
    const kb = await getAgentByName(this.env, 'KNOWLEDGE_BASE', 'main');
    const relevantDocs = await kb.search(prompt, { limit: 3 });

    // 2. Build context from retrieved documents
    const contextText = relevantDocs
      .map(doc => doc.data.content)
      .join('\n\n');

    // 3. Create enhanced prompt with context
    const enhancedPrompt = `Context:\n${contextText}\n\nQuestion: ${prompt}`;

    // 4. Call LLM with enhanced prompt
    const messages = [
      {
        role: 'system',
        content: 'Answer questions based on the provided context. If the context does not contain the answer, say so.'
      },
      ...this.state.conversationHistory,
      { role: 'user', content: enhancedPrompt }
    ];

    const response = await this.callLLM(messages);

    // Update history with original prompt, not enhanced
    this.setState({
      ...this.state,
      conversationHistory: [
        ...this.state.conversationHistory,
        { role: 'user', content: prompt },
        { role: 'assistant', content: response.content }
      ]
    });

    return response;
  }

  private async callLLM(messages: any[]): Promise<LLMResponse> {
    // LLM API call implementation
    return { content: 'Response based on context' };
  }
}
```

## Multi-Agent Collaboration Example

```typescript
class OrchestratorAgent extends LLMToolAgent<Env, LLMToolAgentState> {
  override async initialize(): Promise<void> {
    await super.initialize();

    // Register tools that delegate to other agents
    await this.addTool({
      name: 'analyze_data',
      description: 'Analyze data using the analytics agent',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'array' },
          analysisType: { type: 'string' }
        },
        required: ['data', 'analysisType']
      }
    });

    await this.addTool({
      name: 'generate_report',
      description: 'Generate a report using the reporting agent',
      parameters: {
        type: 'object',
        properties: {
          reportType: { type: 'string' },
          data: { type: 'object' }
        },
        required: ['reportType', 'data']
      }
    });
  }

  @callable()
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'analyze_data':
        const analyticsAgent = await getAgentByName(
          this.env,
          'ANALYTICS_AGENT',
          'main'
        );
        return analyticsAgent.analyze(args.data, args.analysisType);

      case 'generate_report':
        const reportAgent = await getAgentByName(
          this.env,
          'REPORT_AGENT',
          'main'
        );
        return reportAgent.generateReport(args.reportType, args.data);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
```

## Streaming Response Example

```typescript
class StreamingLLMAgent extends LLMToolAgent<Env, LLMToolAgentState> {
  @callable()
  async streamPrompt(prompt: string): Promise<ReadableStream> {
    const messages = [
      ...this.state.conversationHistory,
      { role: 'user', content: prompt }
    ];

    // Create a streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Call streaming LLM API
    this.streamLLM(messages, writer);

    return readable;
  }

  private async streamLLM(messages: any[], writer: WritableStreamDefaultWriter) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(this.env as any).OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages,
          stream: true
        })
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        fullContent += text;

        await writer.write(value);
      }

      // Update history with full response
      this.setState({
        ...this.state,
        conversationHistory: [
          ...this.state.conversationHistory,
          { role: 'assistant', content: fullContent }
        ]
      });

      await writer.close();
    } catch (error) {
      await writer.abort(error);
    }
  }
}
```

## Best Practices

1. **Implement actual LLM calls** - Override `executePrompt` with real API calls
2. **Set system prompts** - Guide the LLM's behavior and persona
3. **Manage token limits** - Track usage to stay within limits
4. **Handle tool calls** - Implement tool execution logic
5. **Clear history periodically** - Prevent context window overflow
6. **Add error handling** - Handle API failures gracefully
7. **Use streaming** - For better user experience with long responses
8. **Implement retries** - Handle transient API failures

## Performance Considerations

- Conversation history grows with each message
- Consider truncating old messages to manage context window
- Tool calls add additional API round trips
- Streaming reduces time-to-first-token
- Token usage directly impacts cost
- Cache common responses when possible
- Consider rate limiting for API calls
