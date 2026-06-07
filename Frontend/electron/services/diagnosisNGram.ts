class NGramPredictor {
  private bigramSorted: Map<string, string[]> = new Map();
  private trigramSorted: Map<string, string[]> = new Map();

  build(names: string[]): void {
    const bigramCounts = new Map<string, Map<string, number>>();
    const trigramCounts = new Map<string, Map<string, number>>();

    for (const name of names) {
      const tokens = name.split(/\s+/).filter(Boolean);
      for (let i = 0; i < tokens.length - 1; i++) {
        const key = tokens[i].toLowerCase();
        if (!bigramCounts.has(key)) bigramCounts.set(key, new Map());
        const inner = bigramCounts.get(key)!;
        inner.set(tokens[i + 1], (inner.get(tokens[i + 1]) || 0) + 1);
      }
      for (let i = 0; i < tokens.length - 2; i++) {
        const key = `${tokens[i].toLowerCase()} ${tokens[i + 1].toLowerCase()}`;
        if (!trigramCounts.has(key)) trigramCounts.set(key, new Map());
        const inner = trigramCounts.get(key)!;
        inner.set(tokens[i + 2], (inner.get(tokens[i + 2]) || 0) + 1);
      }
    }

    this.bigramSorted.clear();
    this.trigramSorted.clear();

    for (const [key, inner] of bigramCounts) {
      this.bigramSorted.set(key, [...inner.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word));
    }
    for (const [key, inner] of trigramCounts) {
      this.trigramSorted.set(key, [...inner.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word));
    }
  }

  predict(textBefore: string, topN: number = 10): string[] {
    const trimmed = textBefore.trimEnd();
    if (!trimmed) return [];

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    if (tokens.length >= 2) {
      const trigramKey = `${tokens[tokens.length - 2].toLowerCase()} ${tokens[tokens.length - 1].toLowerCase()}`;
      const trigramPredictions = this.trigramSorted.get(trigramKey);
      if (trigramPredictions && trigramPredictions.length > 0) {
        return trigramPredictions.slice(0, topN);
      }
    }

    const bigramKey = tokens[tokens.length - 1].toLowerCase();
    const bigramPredictions = this.bigramSorted.get(bigramKey);
    if (bigramPredictions && bigramPredictions.length > 0) {
      return bigramPredictions.slice(0, topN);
    }

    return [];
  }
}

export const predictor = new NGramPredictor();
