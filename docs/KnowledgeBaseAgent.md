# KnowledgeBaseAgent

**Type:** Permanent (Long-Lived)

## Overview

KnowledgeBaseAgent stores and retrieves domain knowledge with search capabilities. It provides a flexible key-value store with tagging, metadata, and basic search functionality that can be extended for vector search or other advanced retrieval methods.

## Responsibilities

- Store and retrieve structured/unstructured data
- Provide search functionality with scoring
- Support tagging for categorization
- Track metadata for each entry
- Maintain statistics on usage (hits/misses)
- Support filtering by tags and metadata

## Lifecycle

KnowledgeBaseAgent is a permanent agent that:
1. **Initializes** with existing knowledge entries
2. **Stores data** continuously
3. **Provides search** across all entries
4. **Maintains state** indefinitely
5. **Tracks statistics** on retrieval patterns

## Callable Methods

### `store(key: string, data: TData, metadata?: Record<string, unknown>, tags?: string[]): Promise<void>`

Store data in the knowledge base.

**Parameters:**
- `key` - Unique identifier for the data
- `data` - The data to store
- `metadata` - Optional metadata for filtering
- `tags` - Optional tags for categorization

**Example:**
```typescript
// Store a document
await kb.store(
  'user-guide-v1',
  {
    title: 'User Guide',
    content: 'How to use the platform...',
    version: '1.0'
  },
  { author: 'John Doe', lastModified: Date.now() },
  ['documentation', 'user-guide', 'v1']
);

// Store a configuration
await kb.store(
  'api-config',
  { endpoint: 'https://api.example.com', timeout: 5000 },
  { environment: 'production' },
  ['config', 'api']
);
```

### `retrieve(key: string): Promise<KnowledgeEntry<TData> | null>`

Retrieve a knowledge entry by key (with metadata).

**Returns:** Full KnowledgeEntry or null if not found

**Example:**
```typescript
const entry = await kb.retrieve('user-guide-v1');
if (entry) {
  console.log(`Title: ${entry.data.title}`);
  console.log(`Created: ${new Date(entry.createdAt)}`);
  console.log(`Updated: ${new Date(entry.updatedAt)}`);
  console.log(`Tags: ${entry.tags?.join(', ')}`);
}
```

### `get(key: string): Promise<TData | null>`

Get data by key (without metadata wrapper).

**Returns:** Just the data or null if not found

**Example:**
```typescript
const config = await kb.get('api-config');
if (config) {
  console.log(`API endpoint: ${config.endpoint}`);
  console.log(`Timeout: ${config.timeout}ms`);
}
```

### `search(query: string, options?: SearchOptions): Promise<SearchResult<TData>[]>`

Search the knowledge base with optional filtering.

**Parameters:**
- `query` - Search query string
- `options` - Optional search options:
  - `limit` - Maximum number of results
  - `tags` - Filter by tags
  - `metadata` - Filter by metadata
  - `scoreThreshold` - Minimum score threshold

**Returns:** Array of SearchResult objects with:
- `key` - The entry key
- `data` - The entry data
- `score` - Relevance score (0-1)
- `metadata` - Entry metadata

**Example:**
```typescript
// Basic search
const results = await kb.search('user guide');
console.log(`Found ${results.length} results`);

// Search with filters
const docResults = await kb.search('authentication', {
  tags: ['documentation'],
  limit: 5,
  scoreThreshold: 0.5
});

// Search by metadata
const prodDocs = await kb.search('api', {
  metadata: { environment: 'production' }
});

results.forEach(result => {
  console.log(`${result.key} (score: ${result.score.toFixed(2)})`);
});
```

### `delete(key: string): Promise<boolean>`

Delete an entry from the knowledge base.

**Returns:** `true` if deleted, `false` if not found

**Example:**
```typescript
const deleted = await kb.delete('old-document');
if (deleted) {
  console.log('Document deleted');
}
```

### `getByTag(tag: string): Promise<KnowledgeEntry<TData>[]>`

Get all entries with a specific tag.

**Example:**
```typescript
const docs = await kb.getByTag('documentation');
console.log(`Found ${docs.length} documentation entries`);

docs.forEach(doc => {
  console.log(`- ${doc.key}`);
});
```

### `getTags(): Promise<string[]>`

Get all unique tags in the knowledge base.

**Example:**
```typescript
const tags = await kb.getTags();
console.log('Available tags:', tags.join(', '));
```

### `getAll(limit?: number): Promise<KnowledgeEntry<TData>[]>`

Get all entries (optionally limited).

**Example:**
```typescript
// Get all entries
const allEntries = await kb.getAll();

// Get first 10 entries
const recentEntries = await kb.getAll(10);
```

### `count(): Promise<number>`

Get total number of entries.

**Example:**
```typescript
const totalEntries = await kb.count();
console.log(`Knowledge base contains ${totalEntries} entries`);
```

### `getStats(): Promise<KBStats>`

Get knowledge base statistics.

**Returns:**
- `totalEntries` - Total number of entries
- `totalSearches` - Number of searches performed
- `totalHits` - Number of successful retrievals
- `totalMisses` - Number of failed retrievals
- `hitRate` - Cache hit rate (0-1)

**Example:**
```typescript
const stats = await kb.getStats();
console.log(`
  Total Entries: ${stats.totalEntries}
  Searches: ${stats.totalSearches}
  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%
  Hits: ${stats.totalHits}
  Misses: ${stats.totalMisses}
`);
```

### `clear(): Promise<void>`

Clear all entries from the knowledge base.

**Example:**
```typescript
await kb.clear();
console.log('Knowledge base cleared');
```

## Protected Methods (For Subclasses)

### `performSearch(query: string, options?: SearchOptions): Promise<SearchResult<TData>[]>`

Override to implement custom search logic (e.g., vector search, fuzzy matching).

**Example:**
```typescript
protected override async performSearch(
  query: string,
  options?: SearchOptions
): Promise<SearchResult<TData>[]> {
  // Custom vector search implementation
  const queryEmbedding = await this.generateEmbedding(query);

  const results: SearchResult<TData>[] = [];
  for (const [key, entry] of Object.entries(this.state.entries)) {
    const entryEmbedding = entry.metadata?.embedding as number[];
    if (entryEmbedding) {
      const similarity = this.cosineSimilarity(queryEmbedding, entryEmbedding);

      if (similarity >= (options?.scoreThreshold || 0)) {
        results.push({
          key,
          data: entry.data,
          score: similarity,
          metadata: entry.metadata
        });
      }
    }
  }

  // Sort by score and apply limit
  results.sort((a, b) => b.score - a.score);
  return options?.limit ? results.slice(0, options.limit) : results;
}

private async generateEmbedding(text: string): Promise<number[]> {
  // Call embedding API
  return [];
}

private cosineSimilarity(a: number[], b: number[]): number {
  // Calculate cosine similarity
  return 0;
}
```

### `calculateScore(entry: KnowledgeEntry<TData>, query: string): number`

Override to customize scoring logic.

**Example:**
```typescript
protected override calculateScore(
  entry: KnowledgeEntry<TData>,
  query: string
): number {
  let score = super.calculateScore(entry, query);

  // Boost recent entries
  const age = Date.now() - entry.updatedAt;
  const ageBoost = Math.max(0, 1 - (age / (30 * 24 * 60 * 60 * 1000))); // 30 days
  score += ageBoost * 0.2;

  // Boost entries with certain tags
  if (entry.tags?.includes('important')) {
    score += 0.3;
  }

  return Math.min(score, 1.0);
}
```

## Complete Example

```typescript
import { KnowledgeBaseAgent, type SearchOptions } from 'common-agents';
import { callable } from 'agents';

interface Document {
  title: string;
  content: string;
  type: 'guide' | 'api' | 'tutorial';
  version: string;
}

class DocumentKB extends KnowledgeBaseAgent<
  Env,
  KnowledgeBaseAgentState,
  Document
> {
  // Custom method to add a document
  @callable()
  async addDocument(
    id: string,
    title: string,
    content: string,
    type: Document['type'],
    version: string
  ): Promise<void> {
    await this.store(
      id,
      { title, content, type, version },
      {
        wordCount: content.split(/\s+/).length,
        addedBy: 'system',
        lastModified: Date.now()
      },
      [type, version, 'documentation']
    );

    this.log(`Added document: ${title} (${id})`);
  }

  // Custom method to search by document type
  @callable()
  async searchByType(
    type: Document['type'],
    query: string
  ): Promise<Document[]> {
    const results = await this.search(query, {
      tags: [type],
      limit: 10
    });

    return results.map(r => r.data);
  }

  // Custom method to get documents by version
  @callable()
  async getDocumentsByVersion(version: string): Promise<Document[]> {
    const entries = await this.getByTag(version);
    return entries.map(e => e.data);
  }

  // Override search for custom relevance
  protected override async performSearch(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult<Document>[]> {
    const results = await super.performSearch(query, options);

    // Custom ranking: prioritize guides over API docs
    return results.map(result => {
      let score = result.score;
      if (result.data.type === 'guide') {
        score *= 1.2; // 20% boost for guides
      }
      return { ...result, score: Math.min(score, 1.0) };
    }).sort((a, b) => b.score - a.score);
  }
}

// Usage
const kb = await getAgentByName(env, 'DOCUMENT_KB', 'main');

// Add documents
await kb.addDocument(
  'intro-guide',
  'Introduction to Platform',
  'Welcome to our platform...',
  'guide',
  'v1.0'
);

await kb.addDocument(
  'api-reference',
  'API Reference',
  'REST API endpoints...',
  'api',
  'v2.0'
);

// Search
const results = await kb.search('platform api');
console.log(`Found ${results.length} relevant documents`);

// Search by type
const guides = await kb.searchByType('guide', 'authentication');
```

## Common Usage Pattern

```typescript
// 1. Initialize knowledge base
const kb = await getAgentByName(env, 'KNOWLEDGE_BASE', 'main');

// 2. Store various types of data
// Store configuration
await kb.store('db-config', {
  host: 'db.example.com',
  port: 5432,
  database: 'production'
}, { environment: 'prod' }, ['config', 'database']);

// Store documentation
await kb.store('auth-docs', {
  title: 'Authentication Guide',
  content: 'OAuth2 flow documentation...'
}, { category: 'security' }, ['docs', 'auth']);

// 3. Retrieve data
const config = await kb.get('db-config');
console.log(`Database: ${config.host}:${config.port}`);

// 4. Search
const searchResults = await kb.search('authentication', {
  tags: ['docs'],
  limit: 5
});

console.log('Search results:');
searchResults.forEach(result => {
  console.log(`- ${result.key} (score: ${result.score.toFixed(2)})`);
});

// 5. Browse by tag
const configEntries = await kb.getByTag('config');
console.log(`${configEntries.length} configuration entries`);

// 6. Monitor usage
const stats = await kb.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

## Integration with Vector Search

```typescript
import { AI } from '@cloudflare/ai';

class VectorKB extends KnowledgeBaseAgent<Env, KnowledgeBaseAgentState, any> {
  private ai: AI;

  override async initialize(): Promise<void> {
    await super.initialize();
    this.ai = new AI((this.env as any).AI);
  }

  // Override store to generate embeddings
  override async store(
    key: string,
    data: any,
    metadata?: Record<string, unknown>,
    tags?: string[]
  ): Promise<void> {
    // Generate embedding for searchable content
    const searchableText = this.extractSearchableText(data);
    const embedding = await this.generateEmbedding(searchableText);

    // Store with embedding in metadata
    await super.store(key, data, {
      ...metadata,
      embedding,
      searchableText
    }, tags);
  }

  // Override search to use vector similarity
  protected override async performSearch(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult<any>[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const entries = Object.values(this.state.entries);

    const results = entries
      .map(entry => {
        const entryEmbedding = entry.metadata?.embedding as number[];
        const similarity = entryEmbedding
          ? this.cosineSimilarity(queryEmbedding, entryEmbedding)
          : 0;

        return {
          key: entry.key,
          data: entry.data,
          score: similarity,
          metadata: entry.metadata
        };
      })
      .filter(r => r.score >= (options?.scoreThreshold || 0))
      .sort((a, b) => b.score - a.score);

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });
    return response.data[0];
  }

  private extractSearchableText(data: any): string {
    if (typeof data === 'string') return data;
    if (data.content) return data.content;
    return JSON.stringify(data);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

## Caching Layer Example

```typescript
class CachedKB extends KnowledgeBaseAgent<Env, KnowledgeBaseAgentState, any> {
  // Use as a caching layer with TTL
  @callable()
  async cacheData(
    key: string,
    data: any,
    ttlSeconds: number
  ): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);

    await this.store(key, data, {
      expiresAt,
      cached: true
    }, ['cache']);
  }

  override async retrieve(key: string): Promise<KnowledgeEntry<any> | null> {
    const entry = await super.retrieve(key);

    if (!entry) return null;

    // Check if expired
    const expiresAt = entry.metadata?.expiresAt as number;
    if (expiresAt && Date.now() > expiresAt) {
      await this.delete(key);
      return null;
    }

    return entry;
  }

  // Periodic cleanup of expired entries
  @callable()
  async cleanupExpired(): Promise<number> {
    const entries = await this.getAll();
    const now = Date.now();
    let cleaned = 0;

    for (const entry of entries) {
      const expiresAt = entry.metadata?.expiresAt as number;
      if (expiresAt && now > expiresAt) {
        await this.delete(entry.key);
        cleaned++;
      }
    }

    this.log(`Cleaned up ${cleaned} expired entries`);
    return cleaned;
  }
}
```

## Best Practices

1. **Use meaningful keys** - Make keys descriptive and unique
2. **Tag consistently** - Use standardized tag names
3. **Add metadata** - Store additional context for filtering
4. **Monitor hit rates** - Low hit rates may indicate wrong keys
5. **Implement search carefully** - Override for domain-specific relevance
6. **Consider storage limits** - Clear old entries periodically
7. **Use vector search** - For semantic search on large text datasets
8. **Index frequently** - Update embeddings when data changes

## Performance Considerations

- All entries stored in durable state (persistent)
- Search iterates through all entries (O(n) complexity)
- Consider implementing pagination for large datasets
- Vector search requires additional compute for embeddings
- Tag index maintained separately for faster tag-based queries
- Statistics tracked on every retrieval operation
