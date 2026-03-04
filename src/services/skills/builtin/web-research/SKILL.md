---
name: web-research
description: Search the web, extract information from multiple sources, and generate comprehensive research reports. Use when the user needs to gather information from the internet, compare multiple sources, or create summaries of online content.
license: MIT
metadata:
  author: CyberBunny
  version: "1.0"
  category: research
allowed-tools: WebSearch WebFetch Write
---

# Web Research Skill

## When to use this skill

Use this skill when the user needs to:
- Search for information on the internet
- Compare information from multiple sources
- Create research reports or summaries
- Verify facts across different websites
- Gather current information on a topic

## How it works

This skill orchestrates web search and content extraction to create comprehensive research reports.

### Step 1: Search for information

Use the WebSearch tool to find relevant sources:

```
Query: "artificial intelligence trends 2024"
Results:
- Source 1: AI Trends Report 2024
- Source 2: Machine Learning Advances
- Source 3: Industry Analysis
```

### Step 2: Extract content from sources

For each relevant source, use WebFetch to extract detailed information:

```
URL: https://example.com/ai-trends-2024
Extract: Key trends, statistics, expert opinions
```

### Step 3: Synthesize information

Combine information from multiple sources:

1. Identify common themes across sources
2. Note conflicting information
3. Highlight key statistics and facts
4. Organize by topic or importance

### Step 4: Generate report

Create a structured research report:

```markdown
# Research Report: [Topic]

## Executive Summary
Brief overview of key findings (2-3 sentences)

## Key Findings

### Finding 1: [Title]
- Detail from Source A
- Supporting data from Source B
- Expert opinion from Source C

### Finding 2: [Title]
- ...

## Sources
1. [Source Title](URL) - Brief description
2. [Source Title](URL) - Brief description

## Conclusion
Summary of main insights and implications
```

## Research strategies

### Broad topic research

For general topics, start with broad searches and narrow down:

1. Initial search: "topic overview"
2. Identify subtopics from results
3. Deep dive into specific subtopics
4. Cross-reference information

### Comparative research

When comparing options or viewpoints:

1. Search for each option separately
2. Look for comparison articles
3. Identify pros/cons from multiple sources
4. Create comparison table

### Fact verification

To verify specific claims:

1. Search for the claim directly
2. Check multiple reputable sources
3. Look for primary sources (studies, official data)
4. Note any contradictions

## Best practices

### Source quality

Prioritize reliable sources:
- Official websites and documentation
- Academic papers and research
- Reputable news organizations
- Industry reports from known organizations

Avoid:
- Unverified blogs or forums
- Outdated information (check dates)
- Sources with obvious bias
- Content farms or low-quality sites

### Information extraction

When extracting information:
- Focus on facts and data, not opinions (unless specifically researching opinions)
- Note the publication date
- Capture key statistics with context
- Quote important statements accurately

### Report structure

Good research reports should:
- Start with a clear summary
- Organize information logically
- Cite sources for all claims
- Highlight conflicting information
- End with actionable insights

## Common patterns

### Pattern 1: Quick fact check

```
1. Search for the specific fact
2. Check 2-3 reputable sources
3. Report: "Verified: [fact] according to [sources]"
   or "Conflicting: Source A says X, Source B says Y"
```

### Pattern 2: Topic overview

```
1. Search: "[topic] overview" or "[topic] introduction"
2. Extract key concepts from top 3-5 results
3. Search for specific subtopics that need more detail
4. Generate structured report with sections
```

### Pattern 3: Comparison research

```
1. Search for each item: "Option A features", "Option B features"
2. Search for direct comparisons: "A vs B comparison"
3. Create comparison table
4. Summarize recommendations based on use cases
```

## Examples

### Example 1: Technology research

**User request**: "Research the latest developments in quantum computing"

**Process**:
1. Search: "quantum computing developments 2024"
2. Extract from top 5 sources
3. Identify key themes: hardware advances, algorithms, applications
4. Generate report with sections for each theme

**Output**:
```markdown
# Quantum Computing Developments 2024

## Executive Summary
Quantum computing has seen significant advances in error correction
and practical applications, with major breakthroughs from IBM, Google,
and academic institutions.

## Key Developments

### Hardware Advances
- IBM's 1000+ qubit processor (Source: IBM Research)
- Improved coherence times by 50% (Source: Nature)
...
```

### Example 2: Product comparison

**User request**: "Compare React vs Vue.js for a new project"

**Process**:
1. Search: "React features 2024", "Vue.js features 2024"
2. Search: "React vs Vue comparison"
3. Extract: performance, ecosystem, learning curve, use cases
4. Create comparison table and recommendations

**Output**:
```markdown
# React vs Vue.js Comparison

| Feature | React | Vue.js |
|---------|-------|--------|
| Learning Curve | Moderate | Easy |
| Performance | Excellent | Excellent |
| Ecosystem | Very Large | Large |
...

## Recommendation
Choose React if: large team, complex app, need extensive libraries
Choose Vue if: smaller team, faster development, simpler learning
```

### Example 3: Fact verification

**User request**: "Is it true that Python is the most popular programming language?"

**Process**:
1. Search: "most popular programming language 2024"
2. Check multiple ranking sources (TIOBE, Stack Overflow, GitHub)
3. Compare results and note methodology differences

**Output**:
```markdown
# Fact Check: Python Popularity

## Claim
"Python is the most popular programming language"

## Verification
- TIOBE Index (Jan 2024): Python #1 (Source: tiobe.com)
- Stack Overflow Survey (2024): JavaScript #1, Python #2 (Source: stackoverflow.com)
- GitHub (2024): JavaScript #1, Python #2 (Source: octoverse.github.com)

## Conclusion
PARTIALLY TRUE: Python ranks #1 in some indices but #2 in others.
Popularity depends on the metric used (search interest vs actual usage).
```

## Error handling

Handle common issues gracefully:

```
- No search results: Try alternative search terms
- Blocked websites: Note in report, try alternative sources
- Outdated information: Prioritize recent sources, note dates
- Conflicting information: Present both sides, note discrepancies
```

## Tips for effective research

1. **Start broad, then narrow**: Begin with overview searches, then dive into specifics
2. **Use multiple sources**: Don't rely on a single source for important information
3. **Check dates**: Ensure information is current and relevant
4. **Note uncertainty**: If sources conflict or information is unclear, say so
5. **Cite everything**: Always include source URLs in the report
6. **Be concise**: Focus on key information, avoid unnecessary details

## See also

- [Search Query Optimization](references/SEARCH_TIPS.md) for better search results
- [Source Evaluation Guide](references/SOURCE_QUALITY.md) for assessing reliability
