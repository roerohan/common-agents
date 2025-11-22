import { BaseAgent, BaseAgentState } from "./BaseAgent";
import { callable } from "agents";

/**
 * Knowledge entry
 */
export interface KnowledgeEntry<T = unknown> {
  key: string;
  data: T;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

/**
 * Search result
 */
export interface SearchResult<T = unknown> {
  key: string;
  data: T;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  scoreThreshold?: number;
}

/**
 * Knowledge base agent state
 */
export interface KnowledgeBaseAgentState extends BaseAgentState {
  entries: Record<string, KnowledgeEntry>;
  tags: Record<string, string[]>; // tag -> [key1, key2]
  stats: {
    totalEntries: number;
    totalSearches: number;
    totalHits: number;
    totalMisses: number;
  };
}

/**
 * KnowledgeBaseAgent stores and retrieves domain knowledge.
 *
 * Lifecycle: Permanent (maintains knowledge indefinitely)
 *
 * Responsibilities:
 * - Index and store structured/unstructured data
 * - Provide search and retrieval APIs
 * - Maintain embeddings or indexes for efficient lookup
 * - Support updates and deletions
 *
 * @template TEnv - Environment bindings type
 * @template TState - Agent state type (must extend KnowledgeBaseAgentState)
 * @template TData - Type of data stored
 *
 * @example
 * ```typescript
 * class DocumentKB extends KnowledgeBaseAgent<Env, KnowledgeBaseAgentState, Document> {
 *   // Optional: Override search logic
 *   protected override async performSearch(
 *     query: string,
 *     options?: SearchOptions
 *   ): Promise<SearchResult<Document>[]> {
 *     // Custom search implementation (e.g., vector search)
 *   }
 * }
 * ```
 */
export class KnowledgeBaseAgent<
  TEnv = unknown,
  TState extends KnowledgeBaseAgentState = KnowledgeBaseAgentState,
  TData = unknown
> extends BaseAgent<TEnv, TState> {
  /**
   * Initial state for knowledge base
   */
  override initialState: TState = {
    created: Date.now(),
    lastUpdated: Date.now(),
    metadata: {},
    entries: {},
    tags: {},
    stats: {
      totalEntries: 0,
      totalSearches: 0,
      totalHits: 0,
      totalMisses: 0,
    },
  } as unknown as TState;

  /**
   * Override initialize for knowledge base setup
   */
  override initialize(): void {
    super.initialize();
    this.log(`Initialized with ${Object.keys(this.state.entries).length} entries`);
  }

  /**
   * Store data in knowledge base
   *
   * @param key - Unique key for the data
   * @param data - The data to store
   * @param metadata - Optional metadata
   * @param tags - Optional tags for categorization
   */
  @callable()
  async store(
    key: string,
    data: TData,
    metadata?: Record<string, unknown>,
    tags?: string[]
  ): Promise<void> {
    const now = Date.now();
    const existingEntry = this.state.entries[key];

    const entry: KnowledgeEntry<TData> = {
      key,
      data,
      metadata,
      createdAt: existingEntry?.createdAt || now,
      updatedAt: now,
      tags,
    };

    // Update entries
    const entries = {
      ...this.state.entries,
      [key]: entry,
    };

    // Update tags index
    const updatedTags = this.updateTagsIndex(key, tags, existingEntry?.tags);

    this.setState({
      ...this.state,
      entries,
      tags: updatedTags,
      stats: {
        ...this.state.stats,
        totalEntries: existingEntry
          ? this.state.stats.totalEntries
          : this.state.stats.totalEntries + 1,
      },
    });

    this.log(`Stored entry: ${key}`);
  }

  /**
   * Retrieve data from knowledge base
   *
   * @param key - The key to retrieve
   * @returns The knowledge entry or null if not found
   */
  @callable()
  async retrieve(key: string): Promise<KnowledgeEntry<TData> | null> {
    const entry = this.state.entries[key];

    if (entry) {
      this.updateStats("totalHits", 1);
      return entry as KnowledgeEntry<TData>;
    }

    this.updateStats("totalMisses", 1);
    return null;
  }

  /**
   * Search knowledge base
   *
   * @param query - Search query string
   * @param options - Search options
   * @returns Array of search results
   */
  @callable()
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult<TData>[]> {
    this.updateStats("totalSearches", 1);

    this.log(`Searching for: "${query}"`);

    const results = await this.performSearch(query, options);

    this.log(`Found ${results.length} results`);

    return results;
  }

  /**
   * Get data by key (simple retrieval without metadata)
   *
   * @param key - The key to retrieve
   * @returns The data or null if not found
   */
  @callable()
  async get(key: string): Promise<TData | null> {
    const entry = await this.retrieve(key);
    return entry ? entry.data : null;
  }

  /**
   * Delete an entry
   *
   * @param key - The key to delete
   * @returns true if deleted, false if not found
   */
  @callable()
  async delete(key: string): Promise<boolean> {
    const entry = this.state.entries[key];
    if (!entry) {
      return false;
    }

    const { [key]: removed, ...remaining } = this.state.entries;

    // Update tags index
    const updatedTags = this.updateTagsIndex(key, undefined, entry.tags);

    this.setState({
      ...this.state,
      entries: remaining,
      tags: updatedTags,
      stats: {
        ...this.state.stats,
        totalEntries: this.state.stats.totalEntries - 1,
      },
    });

    this.log(`Deleted entry: ${key}`);
    return true;
  }

  /**
   * Get entries by tag
   *
   * @param tag - The tag to filter by
   * @returns Array of knowledge entries
   */
  @callable()
  async getByTag(tag: string): Promise<KnowledgeEntry<TData>[]> {
    const keys = this.state.tags[tag] || [];
    return keys
      .map((key) => this.state.entries[key])
      .filter((entry) => entry !== undefined) as KnowledgeEntry<TData>[];
  }

  /**
   * Get all tags
   *
   * @returns Array of all tags
   */
  @callable()
  async getTags(): Promise<string[]> {
    return Object.keys(this.state.tags);
  }

  /**
   * Get all entries
   *
   * @param limit - Optional limit on number of entries
   * @returns Array of knowledge entries
   */
  @callable()
  async getAll(limit?: number): Promise<KnowledgeEntry<TData>[]> {
    const entries = Object.values(this.state.entries) as KnowledgeEntry<TData>[];
    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * Count entries
   *
   * @returns Total number of entries
   */
  @callable()
  async count(): Promise<number> {
    return this.state.stats.totalEntries;
  }

  /**
   * Get statistics
   *
   * @returns Knowledge base statistics
   */
  @callable()
  async getStats(): Promise<KnowledgeBaseAgentState["stats"] & { hitRate: number }> {
    const totalQueries = this.state.stats.totalHits + this.state.stats.totalMisses;
    const hitRate = totalQueries > 0 ? this.state.stats.totalHits / totalQueries : 0;

    return {
      ...this.state.stats,
      hitRate,
    };
  }

  /**
   * Clear all entries
   */
  @callable()
  async clear(): Promise<void> {
    this.setState({
      ...this.state,
      entries: {},
      tags: {},
      stats: {
        ...this.state.stats,
        totalEntries: 0,
      },
    });

    this.log("Cleared all entries");
  }

  /**
   * Perform search - override in subclasses for custom search logic
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Array of search results
   */
  protected async performSearch(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult<TData>[]> {
    const entries = Object.values(this.state.entries) as KnowledgeEntry<TData>[];
    const queryLower = query.toLowerCase();
    const results: SearchResult<TData>[] = [];

    for (const entry of entries) {
      // Filter by tags if specified
      if (options?.tags && options.tags.length > 0) {
        const hasMatchingTag = options.tags.some((tag) =>
          entry.tags?.includes(tag)
        );
        if (!hasMatchingTag) continue;
      }

      // Filter by metadata if specified
      if (options?.metadata) {
        const hasMatchingMetadata = Object.entries(options.metadata).every(
          ([key, value]) => entry.metadata?.[key] === value
        );
        if (!hasMatchingMetadata) continue;
      }

      // Calculate score (simple string matching)
      const score = this.calculateScore(entry, queryLower);

      if (score > 0) {
        results.push({
          key: entry.key,
          data: entry.data,
          score,
          metadata: entry.metadata,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply score threshold if specified
    const filteredResults = options?.scoreThreshold
      ? results.filter((r) => r.score >= options.scoreThreshold!)
      : results;

    // Apply limit if specified
    return options?.limit
      ? filteredResults.slice(0, options.limit)
      : filteredResults;
  }

  /**
   * Calculate search score for an entry
   *
   * @param entry - The entry to score
   * @param query - The search query (lowercase)
   * @returns Score (0-1)
   */
  protected calculateScore(entry: KnowledgeEntry<TData>, query: string): number {
    let score = 0;

    // Check key
    if (entry.key.toLowerCase().includes(query)) {
      score += 1.0;
    }

    // Check data (if string or has searchable properties)
    const dataStr = JSON.stringify(entry.data).toLowerCase();
    if (dataStr.includes(query)) {
      score += 0.5;
    }

    // Check tags
    if (entry.tags) {
      for (const tag of entry.tags) {
        if (tag.toLowerCase().includes(query)) {
          score += 0.3;
        }
      }
    }

    // Check metadata
    if (entry.metadata) {
      const metadataStr = JSON.stringify(entry.metadata).toLowerCase();
      if (metadataStr.includes(query)) {
        score += 0.2;
      }
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Update tags index
   */
  protected updateTagsIndex(
    key: string,
    newTags?: string[],
    oldTags?: string[]
  ): Record<string, string[]> {
    const tags = { ...this.state.tags };

    // Remove from old tags
    if (oldTags) {
      for (const tag of oldTags) {
        if (tags[tag]) {
          tags[tag] = tags[tag].filter((k) => k !== key);
          if (tags[tag].length === 0) {
            delete tags[tag];
          }
        }
      }
    }

    // Add to new tags
    if (newTags) {
      for (const tag of newTags) {
        if (!tags[tag]) {
          tags[tag] = [];
        }
        if (!tags[tag].includes(key)) {
          tags[tag].push(key);
        }
      }
    }

    return tags;
  }

  /**
   * Update statistics
   */
  protected updateStats(
    key: keyof KnowledgeBaseAgentState["stats"],
    increment: number
  ): void {
    this.setState({
      ...this.state,
      stats: {
        ...this.state.stats,
        [key]: (this.state.stats[key] as number) + increment,
      },
    });
  }
}
