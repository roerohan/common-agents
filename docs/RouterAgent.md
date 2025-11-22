# RouterAgent

**Type:** Permanent (Long-Lived)

## Overview

RouterAgent routes incoming requests to appropriate agent handlers based on configurable rules. It provides flexible pattern matching, priority-based routing, and load balancing capabilities for distributed agent systems.

## Responsibilities

- Classify and route incoming requests to target agents
- Maintain and dynamically update routing rules
- Support pattern matching (string and regex)
- Track routing statistics and match rates
- Provide priority-based rule evaluation
- Enable/disable routes without deletion

## Lifecycle

RouterAgent is a permanent agent that:
1. **Initializes** with routing rules configuration
2. **Evaluates requests** against rules continuously
3. **Routes traffic** to appropriate agents
4. **Maintains state** indefinitely
5. **Collects statistics** on routing patterns

## Callable Methods

### `route(request: RouteRequest): Promise<RouteResult>`

Route a request based on configured routing rules.

**Parameters:**
- `request` - RouteRequest object containing:
  - `path` - The request path to match against rules
  - `method` - Optional HTTP method
  - `headers` - Optional request headers
  - `body` - Optional request body
  - `metadata` - Optional additional metadata

**Returns:** RouteResult containing:
- `matched` - Whether a rule was matched
- `rule` - The matched routing rule (if any)
- `targetAgent` - Name of the target agent
- `targetMethod` - Method to call on target agent
- `processingTime` - Time taken to find match (ms)

**Example:**
```typescript
const request: RouteRequest = {
  path: '/api/users/123',
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
};

const result = await router.route(request);
if (result.matched) {
  console.log(`Routing to ${result.targetAgent}.${result.targetMethod}`);
}
```

### `addRule(rule: RoutingRule): Promise<void>`

Add a new routing rule.

**Parameters:**
- `rule` - RoutingRule object containing:
  - `id` - Unique rule identifier
  - `name` - Human-readable rule name
  - `pattern` - String or RegExp pattern to match
  - `targetAgent` - Target agent name
  - `targetMethod` - Optional target method name
  - `priority` - Rule priority (higher evaluated first)
  - `enabled` - Whether rule is active
  - `metadata` - Optional rule metadata

**Example:**
```typescript
await router.addRule({
  id: 'user-api-rule',
  name: 'User API Routes',
  pattern: /^\/api\/users/,
  targetAgent: 'USER_HANDLER',
  targetMethod: 'handleRequest',
  priority: 10,
  enabled: true
});
```

### `removeRule(ruleId: string): Promise<boolean>`

Remove a routing rule.

**Returns:** `true` if removed, `false` if not found

**Example:**
```typescript
const removed = await router.removeRule('user-api-rule');
if (removed) {
  console.log('Rule removed successfully');
}
```

### `updateRule(ruleId: string, updates: Partial<RoutingRule>): Promise<boolean>`

Update an existing routing rule.

**Returns:** `true` if updated, `false` if not found

**Example:**
```typescript
await router.updateRule('user-api-rule', {
  priority: 15,
  targetMethod: 'handleUserRequest'
});
```

### `setRuleEnabled(ruleId: string, enabled: boolean): Promise<boolean>`

Enable or disable a routing rule without deleting it.

**Example:**
```typescript
// Temporarily disable a rule
await router.setRuleEnabled('user-api-rule', false);

// Re-enable later
await router.setRuleEnabled('user-api-rule', true);
```

### `getRoutes(): Promise<RoutingRule[]>`

Get all routing rules.

**Example:**
```typescript
const rules = await router.getRoutes();
console.log(`Router has ${rules.length} rules configured`);
rules.forEach(rule => {
  console.log(`${rule.name} (priority: ${rule.priority}): ${rule.pattern}`);
});
```

### `getRule(ruleId: string): Promise<RoutingRule | undefined>`

Get a specific routing rule by ID.

**Example:**
```typescript
const rule = await router.getRule('user-api-rule');
if (rule) {
  console.log(`Rule pattern: ${rule.pattern}`);
}
```

### `getStats(): Promise<RouterStats>`

Get routing statistics.

**Returns:**
- `totalRequests` - Total number of routed requests
- `matchedRequests` - Number of successful matches
- `unmatchedRequests` - Number of failed matches
- `routeStats` - Per-rule match counts

**Example:**
```typescript
const stats = await router.getStats();
console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Match rate: ${(stats.matchedRequests / stats.totalRequests * 100).toFixed(2)}%`);
console.log(`Unmatched: ${stats.unmatchedRequests}`);
```

### `clearStats(): Promise<void>`

Clear all routing statistics.

**Example:**
```typescript
await router.clearStats();
console.log('Statistics cleared');
```

## Protected Methods (For Subclasses)

### `matchesRule(request: RouteRequest, rule: RoutingRule): boolean`

Override to customize rule matching logic.

**Example:**
```typescript
protected matchesRule(request: RouteRequest, rule: RoutingRule): boolean {
  // Custom matching logic
  const baseMatch = super.matchesRule(request, rule);

  // Add custom header matching
  if (rule.metadata?.requiredHeader) {
    return baseMatch && request.headers?.[rule.metadata.requiredHeader as string];
  }

  return baseMatch;
}
```

### `executeRoute(request: RouteRequest, rule: RoutingRule): Promise<unknown>`

**Must be overridden** to implement actual routing to target agents.

**Example:**
```typescript
protected async executeRoute(
  request: RouteRequest,
  rule: RoutingRule
): Promise<unknown> {
  // Get target agent instance
  const agent = await getAgentByName(
    this.env,
    rule.targetAgent,
    'default'
  );

  // Call target method
  const method = rule.targetMethod || 'handleRequest';
  return await agent[method](request);
}
```

## Complete Example

```typescript
import { RouterAgent, type RouteRequest, type RoutingRule } from 'common-agents';
import { getAgentByName } from 'agents';

class APIRouter extends RouterAgent<Env, RouterAgentState> {
  constructor() {
    super();
    this.initializeRoutes();
  }

  private async initializeRoutes() {
    // Add API routes
    await this.addRule({
      id: 'users',
      name: 'User Service',
      pattern: /^\/api\/users/,
      targetAgent: 'USER_SERVICE',
      targetMethod: 'handleRequest',
      priority: 10,
      enabled: true
    });

    await this.addRule({
      id: 'orders',
      name: 'Order Service',
      pattern: /^\/api\/orders/,
      targetAgent: 'ORDER_SERVICE',
      targetMethod: 'handleRequest',
      priority: 10,
      enabled: true
    });

    await this.addRule({
      id: 'analytics',
      name: 'Analytics Service',
      pattern: '/api/analytics*',
      targetAgent: 'ANALYTICS_SERVICE',
      targetMethod: 'processAnalytics',
      priority: 5,
      enabled: true
    });

    await this.addRule({
      id: 'default',
      name: 'Default Handler',
      pattern: '*',
      targetAgent: 'DEFAULT_SERVICE',
      priority: 1,
      enabled: true
    });
  }

  // Override to actually route to agents
  protected override async executeRoute(
    request: RouteRequest,
    rule: RoutingRule
  ): Promise<unknown> {
    this.log(`Routing ${request.path} to ${rule.targetAgent}`);

    try {
      // Get target agent
      const agent = await getAgentByName(
        this.env,
        rule.targetAgent,
        'default'
      );

      // Call target method
      const method = rule.targetMethod || 'handleRequest';
      return await agent[method](request);
    } catch (error) {
      this.log(`Routing failed: ${error}`, 'error');
      throw error;
    }
  }

  // Custom method to route and execute in one call
  @callable()
  async routeAndExecute(request: RouteRequest): Promise<unknown> {
    const result = await this.route(request);

    if (!result.matched) {
      throw new Error(`No route found for path: ${request.path}`);
    }

    return await this.executeRoute(request, result.rule!);
  }
}
```

## Common Usage Pattern

```typescript
// 1. Initialize router
const router = await getAgentByName(env, 'ROUTER', 'main');

// 2. Route incoming requests
const request: RouteRequest = {
  path: '/api/users/123',
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' },
  body: null
};

const result = await router.route(request);

if (result.matched) {
  console.log(`Matched rule: ${result.rule?.name}`);
  console.log(`Target: ${result.targetAgent}.${result.targetMethod}`);

  // Execute the route
  const response = await router.routeAndExecute(request);
}

// 3. Monitor routing performance
const stats = await router.getStats();
console.log(`
  Total Requests: ${stats.totalRequests}
  Match Rate: ${(stats.matchedRequests / stats.totalRequests * 100).toFixed(2)}%
  Unmatched: ${stats.unmatchedRequests}
`);

// 4. Dynamically update routes
await router.updateRule('users', { priority: 20 });
await router.setRuleEnabled('analytics', false); // Disable analytics temporarily
```

## Integration with API Gateway

```typescript
// API Gateway handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const router = await getAgentByName(env, 'ROUTER', 'main');

    // Convert HTTP request to RouteRequest
    const routeRequest: RouteRequest = {
      path: new URL(request.url).pathname,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body: await request.json().catch(() => null)
    };

    // Route and execute
    try {
      const result = await router.routeAndExecute(routeRequest);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

## Load Balancing Example

```typescript
class LoadBalancingRouter extends RouterAgent<Env, RouterAgentState> {
  private currentIndex = 0;

  protected override async executeRoute(
    request: RouteRequest,
    rule: RoutingRule
  ): Promise<unknown> {
    // Load balance across multiple instances
    const instances = rule.metadata?.instances as string[] || ['default'];
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;

    this.log(`Load balancing to instance: ${instance}`);

    const agent = await getAgentByName(
      this.env,
      rule.targetAgent,
      instance
    );

    const method = rule.targetMethod || 'handleRequest';
    return await agent[method](request);
  }
}

// Configure with multiple instances
await router.addRule({
  id: 'high-traffic-service',
  name: 'High Traffic Service',
  pattern: /^\/api\/popular/,
  targetAgent: 'POPULAR_SERVICE',
  priority: 10,
  enabled: true,
  metadata: {
    instances: ['instance-1', 'instance-2', 'instance-3']
  }
});
```

## Best Practices

1. **Use priority wisely** - Higher priority rules are evaluated first
2. **Order matters** - Place specific patterns before wildcards
3. **Monitor match rates** - Low match rates may indicate missing rules
4. **Use regex carefully** - Complex regex can impact performance
5. **Disable instead of delete** - Preserve rule configuration for later use
6. **Add metadata** - Store additional context for custom routing logic
7. **Implement health checks** - Verify target agents are available
8. **Cache agent instances** - Avoid repeated agent lookups

## Performance Considerations

- Rules are evaluated in priority order (higher first)
- String patterns are faster than regex patterns
- Disabled rules are filtered before evaluation
- Statistics are updated synchronously on each request
- Consider rule consolidation for large rule sets
