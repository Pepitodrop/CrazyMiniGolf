# Deterministic coarse simulator for the eight-direction Brainfuck physics model.

clamp <- function(value, minimum, maximum) max(minimum, min(maximum, value))

circle_rect_collision <- function(x, y, radius, obstacle) {
  nearest_x <- clamp(x, obstacle$x, obstacle$x + obstacle$width)
  nearest_y <- clamp(y, obstacle$y, obstacle$y + obstacle$height)
  dx <- x - nearest_x
  dy <- y - nearest_y
  dx * dx + dy * dy <= radius * radius
}

circle_circle_collision <- function(x, y, radius, obstacle) {
  dx <- x - obstacle$x
  dy <- y - obstacle$y
  combined <- radius + obstacle$radius
  dx * dx + dy * dy <= combined * combined
}

obstacle_collision <- function(level, x, y) {
  for (obstacle in level$obstacles) {
    hit <- if (obstacle$type == "rect") {
      circle_rect_collision(x, y, level$ballRadius, obstacle)
    } else {
      circle_circle_collision(x, y, level$ballRadius, obstacle)
    }
    if (hit) return(TRUE)
  }
  FALSE
}

hole_capture <- function(level, x, y, speed) {
  radius <- level$holeRadius - max(1, level$ballRadius / 2)
  dx <- x - level$hole$x
  dy <- y - level$hole$y
  speed <= 2 && dx * dx + dy * dy <= radius * radius
}

simulate_single_shot <- function(level, state, direction, strength, max_ticks = 240) {
  vx <- abs(direction[1]) * strength
  vy <- abs(direction[2]) * strength
  sx <- ifelse(direction[1] < 0, -1, 1)
  sy <- ifelse(direction[2] < 0, -1, 1)
  x <- state$x
  y <- state$y

  for (tick in seq_len(max_ticks)) {
    next_x <- x + sx * vx
    next_y <- y + sy * vy

    block_x <- vx > 0 && (
      next_x - level$ballRadius < 0 ||
      next_x + level$ballRadius > level$width ||
      obstacle_collision(level, next_x, y)
    )
    block_y <- vy > 0 && (
      next_y - level$ballRadius < 0 ||
      next_y + level$ballRadius > level$height ||
      obstacle_collision(level, x, next_y)
    )

    if (block_x) sx <- -sx else x <- next_x
    if (block_y) sy <- -sy else y <- next_y

    if (tick %% 3 == 0) {
      if (vx > 0) vx <- vx - 1
      if (vy > 0) vy <- vy - 1
    }

    speed <- vx + vy
    if (hole_capture(level, x, y, speed)) {
      return(list(x = x, y = y, holed = TRUE, ticks = tick))
    }
    if (speed == 0) break
  }

  list(x = x, y = y, holed = FALSE, ticks = max_ticks)
}

candidate_directions <- list(
  c(1, 0), c(1, 1), c(0, 1), c(-1, 1),
  c(-1, 0), c(-1, -1), c(0, -1), c(1, -1)
)

rank_candidates <- function(level, state) {
  candidates <- list()
  index <- 1
  for (direction in candidate_directions) {
    for (strength in 2:14) {
      result <- simulate_single_shot(level, state, direction, strength)
      distance <- sqrt((result$x - level$hole$x)^2 + (result$y - level$hole$y)^2)
      candidates[[index]] <- list(
        direction = direction,
        strength = strength,
        result = result,
        score = ifelse(result$holed, -10000, distance)
      )
      index <- index + 1
    }
  }
  candidates[order(vapply(candidates, function(item) item$score, numeric(1)))]
}

simulate_round <- function(level, max_strokes = 12, exploration = 0.18) {
  state <- list(x = level$start$x, y = level$start$y)
  for (stroke in seq_len(max_strokes)) {
    ranked <- rank_candidates(level, state)
    choice_index <- if (runif(1) < exploration) sample(seq_len(min(12, length(ranked))), 1) else 1
    selected <- ranked[[choice_index]]
    if (selected$result$holed) return(stroke)
    state$x <- selected$result$x
    state$y <- selected$result$y
  }
  NA_integer_
}

analyze_level <- function(level, trials = 120) {
  samples <- replicate(trials, simulate_round(level))
  solved <- samples[!is.na(samples)]
  success_rate <- length(solved) / trials
  expected <- if (length(solved) == 0) NA_real_ else mean(solved)
  suggested <- if (length(solved) == 0) level$par else max(2, min(9, round(expected + 0.6)))
  data.frame(
    id = level$id,
    name = level$name,
    configured_par = level$par,
    suggested_par = suggested,
    success_rate = round(success_rate, 3),
    expected_strokes = ifelse(is.na(expected), NA, round(expected, 2)),
    obstacle_count = length(level$obstacles),
    principally_solvable = success_rate > 0,
    stringsAsFactors = FALSE
  )
}
