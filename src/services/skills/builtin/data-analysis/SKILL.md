---
name: data-analysis
description: Analyze data files (CSV, JSON, Excel) using Python. Performs statistical analysis, generates visualizations, and creates summary reports. Use when the user needs to understand data patterns, distributions, correlations, or wants charts and graphs.
license: MIT
metadata:
  author: CyberBunny
  version: "1.0"
  category: data
allowed-tools: Read Write Bash(python:*)
---

# Data Analysis Skill

## When to use this skill

Use this skill when the user needs to:
- Analyze CSV, JSON, or Excel files
- Generate statistical summaries (mean, median, std, etc.)
- Create visualizations (charts, graphs, plots)
- Find patterns or correlations in data
- Clean or transform data

## How it works

This skill uses Python with pandas, numpy, and matplotlib to analyze data files.

### Step 1: Read the data file

First, identify the file path and read the file content:

```python
import pandas as pd

# For CSV files
df = pd.read_csv('data.csv')

# For JSON files
df = pd.read_json('data.json')

# For Excel files
df = pd.read_excel('data.xlsx')
```

### Step 2: Perform analysis

Generate statistical summaries:

```python
# Basic statistics
print(df.describe())

# Data types and missing values
print(df.info())

# Correlation matrix
print(df.corr())
```

### Step 3: Create visualizations

Generate charts and save them:

```python
import matplotlib.pyplot as plt

# Distribution plot
df['column_name'].hist()
plt.savefig('distribution.png')

# Scatter plot
df.plot.scatter(x='col1', y='col2')
plt.savefig('scatter.png')

# Correlation heatmap
import seaborn as sns
sns.heatmap(df.corr(), annot=True)
plt.savefig('correlation.png')
```

### Step 4: Generate report

Summarize findings in a clear format:

```
Data Analysis Report
====================

Dataset: data.csv
Rows: 1000
Columns: 5

Summary Statistics:
- Column A: mean=45.2, std=12.3
- Column B: mean=78.9, std=8.7

Key Findings:
- Strong positive correlation (0.85) between A and B
- 15% missing values in Column C
- Outliers detected in Column D

Visualizations:
- distribution.png: Shows normal distribution
- scatter.png: Shows linear relationship
- correlation.png: Heatmap of all correlations
```

## Common patterns

### Handling missing data

```python
# Check for missing values
print(df.isnull().sum())

# Drop rows with missing values
df_clean = df.dropna()

# Fill missing values
df_filled = df.fillna(df.mean())
```

### Data filtering

```python
# Filter by condition
filtered = df[df['column'] > 50]

# Filter by multiple conditions
filtered = df[(df['col1'] > 10) & (df['col2'] < 100)]
```

### Grouping and aggregation

```python
# Group by category and calculate mean
grouped = df.groupby('category').mean()

# Multiple aggregations
agg = df.groupby('category').agg({
    'value': ['mean', 'sum', 'count']
})
```

## Error handling

Always handle common errors:

```python
try:
    df = pd.read_csv(file_path)
except FileNotFoundError:
    print(f"Error: File {file_path} not found")
except pd.errors.EmptyDataError:
    print("Error: File is empty")
except Exception as e:
    print(f"Error reading file: {e}")
```

## Best practices

1. **Check data first**: Always inspect the data structure before analysis
2. **Handle missing values**: Decide whether to drop or fill missing data
3. **Save visualizations**: Always save plots to files for the user to view
4. **Clear reporting**: Provide concise, actionable insights
5. **Error messages**: Give helpful error messages if something fails

## Examples

### Example 1: Basic CSV analysis

```python
import pandas as pd
import matplotlib.pyplot as plt

# Read data
df = pd.read_csv('/workspace/sales.csv')

# Summary statistics
print("Summary Statistics:")
print(df.describe())

# Create visualization
df['revenue'].hist(bins=20)
plt.title('Revenue Distribution')
plt.xlabel('Revenue')
plt.ylabel('Frequency')
plt.savefig('/workspace/revenue_dist.png')

print("\nVisualization saved to revenue_dist.png")
```

### Example 2: Correlation analysis

```python
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# Read data
df = pd.read_csv('/workspace/metrics.csv')

# Calculate correlations
corr = df.corr()
print("Correlation Matrix:")
print(corr)

# Create heatmap
plt.figure(figsize=(10, 8))
sns.heatmap(corr, annot=True, cmap='coolwarm', center=0)
plt.title('Feature Correlations')
plt.savefig('/workspace/correlations.png')

print("\nHeatmap saved to correlations.png")
```

## See also

- [Python Data Analysis Reference](references/REFERENCE.md) for detailed pandas documentation
- [Visualization Examples](references/VISUALIZATIONS.md) for more chart types
