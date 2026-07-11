args <- commandArgs(trailingOnly = TRUE)
level_path <- if (length(args) >= 1) args[[1]] else "src/levels/levels.json"
output_dir <- if (length(args) >= 2) args[[2]] else "analysis/results"

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Package 'jsonlite' is required. Install it with install.packages('jsonlite').")
}

source("analysis/simulate-shots.R")
set.seed(20260711)
levels <- jsonlite::fromJSON(level_path, simplifyVector = FALSE)
if (length(levels) != 9) stop(sprintf("Expected 9 levels, found %d.", length(levels)))

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
results <- do.call(rbind, lapply(levels, analyze_level))

csv_path <- file.path(output_dir, "level-analysis.csv")
json_path <- file.path(output_dir, "level-analysis.json")
png_path <- file.path(output_dir, "level-difficulty.png")

write.csv(results, csv_path, row.names = FALSE)
jsonlite::write_json(results, json_path, pretty = TRUE, na = "null")

png(png_path, width = 1100, height = 650)
bar_positions <- barplot(
  ifelse(is.na(results$expected_strokes), 0, results$expected_strokes),
  names.arg = results$id,
  main = "Estimated Crazy Mini Golf difficulty",
  xlab = "Level",
  ylab = "Expected strokes among solved simulations"
)
points(bar_positions, results$configured_par, pch = 19)
legend(
  "topleft",
  legend = c("Expected strokes", "Configured par"),
  pch = c(15, 19),
  bty = "n"
)
dev.off()

print(results)
cat(sprintf("\nWrote %s, %s and %s\n", csv_path, json_path, png_path))
if (any(!results$coarse_solver_found_path)) {
  warning("The coarse stochastic solver did not find a path for every level; this is not a proof of unsolvability.")
}
