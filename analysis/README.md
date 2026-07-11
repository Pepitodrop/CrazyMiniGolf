# R level analysis

The scripts model the same intentionally discrete physics used by the browser game: eight directions, integer speed, a friction pulse every third tick, axis-separated collision sensors, and bounce response.

## Requirements

- R 4.2 or newer
- `jsonlite`

```r
install.packages("jsonlite")
```

## Run

```bash
npm run analyze:levels
# or
Rscript analysis/analyze-levels.R src/levels/levels.json analysis/results
```

The deterministic seed is `20260711`. Outputs:

- `level-analysis.csv`
- `level-analysis.json`
- `level-difficulty.png`

The solver ranks all 104 direction/power combinations from each resting position, adds controlled exploration, and estimates solvability, expected strokes, and a suggested par over repeated rounds. This is a coarse balancing tool, not a mathematical proof of reachability.
