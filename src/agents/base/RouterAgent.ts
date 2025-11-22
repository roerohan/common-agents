import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";

/**
 * Routing rule
 */
export interface RoutingRule {
  id: string;
  name: string;
  pattern: string | RegExp;
  targetAgent: string;
  targetMethod?: string;
  priority: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Route result
 */
export interface RouteResult {
  matched: boolean;
  rule?: RoutingRule;
  targetAgent?: string;
  targetMethod?: string;
  processingTime: number;
}

/**
 * Request to route
 */
export interface RouteRequest {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Router agent state
 */
export interface RouterAgentState extends BaseAgentState {
  rules: Record<string, RoutingRule>;
  stats: {
    totalRequests: number;
    matchedRequests: number;
    unmatchedRequests: number;
    routeStats: Record<string, number>;
  };
}

/**
 * RouterAgent routes incoming requests to appropriate handlers based on rules.
 *
 * Lifecycle: Permanent (maintains routing rules indefinitely)
 *
 * Responsibilities:
 * - Classify incoming requests
 * - Route to appropriate agent types/instances
 * - Load balancing across worker pools
 * - Maintain routing rules and update them dynamically
 *
 * @template TEnv - Environment bindings type
 * @template TState - Agent state type (must extend RouterAgentState)
 *
 * @example
 * ```typescript
 * class MyRouter extends RouterAgent<Env, RouterAgentState> {
 *   // Optional: Override routing logic
 *   protected override async executeRoute(
 *     request: RouteRequest,
 *     rule: RoutingRule
 *   ): Promise<unknown> {
 *     // Custom routing implementation
 *   }
 * }
 * ```
 */
export class RouterAgent<
  TEnv = unknown,
  TState extends RouterAgentState = RouterAgentState
> extends BaseAgent<TEnv, TState> {
  /**
   * Initial state for router
   */
  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    rules: {},
    stats: {
      totalRequests: 0,
      matchedRequests: 0,
      unmatchedRequests: 0,
      routeStats: {},
    },
  } as unknown as TState;

  /**
   * Override initialize for router setup
   */
  override initialize(): void {
    super.initialize();
    this.log("Router initialized with " + Object.keys(this.state.rules).length + " rules");
  }

  /**
   * Route a request based on routing rules
   *
   * @param request - The request to route
   * @returns Route result with target information
   */
  @callable()
  async route(request: RouteRequest): Promise<RouteResult> {
    const startTime = Date.now();

    // Update stats
    this.updateStats("totalRequests", 1);

    // Get enabled rules sorted by priority
    const rules = Object.values(this.state.rules)
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    // Find matching rule
    for (const rule of rules) {
      if (this.matchesRule(request, rule)) {
        this.log(`Matched rule: ${rule.name} for path: ${request.path}`);

        // Update stats
        this.updateStats("matchedRequests", 1);
        this.updateRouteStats(rule.id);

        return {
          matched: true,
          rule,
          targetAgent: rule.targetAgent,
          targetMethod: rule.targetMethod,
          processingTime: Date.now() - startTime,
        };
      }
    }

    // No match found
    this.log(`No rule matched for path: ${request.path}`, "warn");
    this.updateStats("unmatchedRequests", 1);

    return {
      matched: false,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Add a routing rule
   *
   * @param rule - The routing rule to add
   */
  @callable()
  async addRule(rule: RoutingRule): Promise<void> {
    this.setState({
      ...this.state,
      rules: {
        ...this.state.rules,
        [rule.id]: rule,
      },
    });

    this.log(`Added rule: ${rule.name} (id: ${rule.id})`);
  }

  /**
   * Remove a routing rule
   *
   * @param ruleId - The rule ID to remove
   * @returns true if removed, false if not found
   */
  @callable()
  async removeRule(ruleId: string): Promise<boolean> {
    if (!this.state.rules[ruleId]) {
      return false;
    }

    const { [ruleId]: removed, ...remaining } = this.state.rules;

    this.setState({
      ...this.state,
      rules: remaining,
    });

    this.log(`Removed rule: ${ruleId}`);
    return true;
  }

  /**
   * Update a routing rule
   *
   * @param ruleId - The rule ID to update
   * @param updates - Partial rule updates
   * @returns true if updated, false if not found
   */
  @callable()
  async updateRule(
    ruleId: string,
    updates: Partial<RoutingRule>
  ): Promise<boolean> {
    const rule = this.state.rules[ruleId];
    if (!rule) {
      return false;
    }

    this.setState({
      ...this.state,
      rules: {
        ...this.state.rules,
        [ruleId]: {
          ...rule,
          ...updates,
        },
      },
    });

    this.log(`Updated rule: ${ruleId}`);
    return true;
  }

  /**
   * Enable or disable a rule
   *
   * @param ruleId - The rule ID
   * @param enabled - Whether to enable or disable
   * @returns true if updated, false if not found
   */
  @callable()
  async setRuleEnabled(ruleId: string, enabled: boolean): Promise<boolean> {
    return this.updateRule(ruleId, { enabled });
  }

  /**
   * Get all routing rules
   *
   * @returns Array of routing rules
   */
  @callable()
  async getRoutes(): Promise<RoutingRule[]> {
    return Object.values(this.state.rules);
  }

  /**
   * Get a specific routing rule
   *
   * @param ruleId - The rule ID
   * @returns The routing rule or undefined
   */
  @callable()
  async getRule(ruleId: string): Promise<RoutingRule | undefined> {
    return this.state.rules[ruleId];
  }

  /**
   * Get routing statistics
   *
   * @returns Routing statistics
   */
  @callable()
  async getStats(): Promise<RouterAgentState["stats"]> {
    return this.state.stats;
  }

  /**
   * Clear routing statistics
   */
  @callable()
  async clearStats(): Promise<void> {
    this.setState({
      ...this.state,
      stats: {
        totalRequests: 0,
        matchedRequests: 0,
        unmatchedRequests: 0,
        routeStats: {},
      },
    });

    this.log("Cleared routing statistics");
  }

  /**
   * Check if request matches a rule
   *
   * @param request - The request to check
   * @param rule - The rule to match against
   * @returns true if matches
   */
  protected matchesRule(request: RouteRequest, rule: RoutingRule): boolean {
    const pattern = rule.pattern;

    if (typeof pattern === "string") {
      // Exact match or prefix match
      return (
        request.path === pattern ||
        request.path.startsWith(pattern.endsWith("*") ? pattern.slice(0, -1) : pattern + "/")
      );
    } else if (pattern instanceof RegExp) {
      // Regex match
      return pattern.test(request.path);
    }

    return false;
  }

  /**
   * Execute routing to target agent (override in subclasses)
   *
   * @param request - The request to route
   * @param rule - The matched rule
   * @returns The response from the target agent
   */
  protected async executeRoute(
    _request: RouteRequest,
    rule: RoutingRule
  ): Promise<unknown> {
    // Default implementation - override in subclasses
    this.log(`Would route to ${rule.targetAgent}.${rule.targetMethod || "default"}`);

    // Subclasses should implement actual routing using getAgentByName:
    // const agent = await getAgentByName(this.env, rule.targetAgent, 'instance-id');
    // return await agent[rule.targetMethod](request);

    return {
      routed: true,
      targetAgent: rule.targetAgent,
      targetMethod: rule.targetMethod,
    };
  }

  /**
   * Update statistics
   */
  protected updateStats(key: keyof RouterAgentState["stats"], increment: number): void {
    if (key === "routeStats") return; // Handle separately

    this.setState({
      ...this.state,
      stats: {
        ...this.state.stats,
        [key]: (this.state.stats[key] as number) + increment,
      },
    });
  }

  /**
   * Update route-specific statistics
   */
  protected updateRouteStats(ruleId: string): void {
    const routeStats = {
      ...this.state.stats.routeStats,
      [ruleId]: (this.state.stats.routeStats[ruleId] || 0) + 1,
    };

    this.setState({
      ...this.state,
      stats: {
        ...this.state.stats,
        routeStats,
      },
    });
  }
}
