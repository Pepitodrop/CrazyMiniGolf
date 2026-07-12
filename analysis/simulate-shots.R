# Deterministic coarse simulator for the five-degree Brainfuck physics model.

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

normalize_angle <- function(angle_degrees) {
  normalized <- angle_degrees %% 360
  if (normalized < 0) normalized + 360 else normalized
}

resolve_components <- function(angle_degrees, strength) {
  angle <- normalize_angle(round(normalize_angle(angle_degrees) / 5) * 5)
  radians <- angle * pi / 180
  cosine <- cos(radians)
  sine <- sin(radians)
  x_negative <- cosine < -.Machine$double.eps
  y_negative <- sine < -.Machine$double.eps
  quadrant_angle <- atan2(abs(sine), abs(cosine)) * 180 / pi

  best_x <- strength
  best_y <- 0
  best_score <- Inf
  for (x in 0:strength) {
    for (y in 0:strength) {
      if (x == 0 && y == 0) next
      candidate_angle <- atan2(y, x) * 180 / pi
      angle_error <- abs(candidate_angle - quadrant_angle)
      magnitude_error <- abs(sqrt(x * x + y * y) - strength)
      score <- angle_error * 10 + magnitude_error
      if (score < best_score) {
        best_score <- score
        best_x <- x
        best_y <- y
      }
    }
  }

  list(
    angle = angle,
    vx = best_x,
    vy = best_y,
    sx = ifelse(x_negative, -1, 1),
    sy = ifelse(y_negative, -1, 1)
  )
}

distance_squared_to_segment <- function(px, py, start_x, start_y, end_x, end_y) {
  segment_x <- end_x - start_x
  segment_y <- end_y - start_y
  length_squared <- segment_x * segment_x + segment_y * segment_y
  if (length_squared == 0) {
    dx <- px - start_x
    dy <- py - start_y
    return(dx * dx + dy * dy)
  }

  projection <- clamp(
    ((px - start_x) * segment_x + (py - start_y) * segment_y) / length_squared,
    0,
    1
  )
  nearest_x <- start_x + projection * segment_x
  nearest_y <- start_y + projection * segment_y
  dx <- px - nearest_x
  dy <- py - nearest_y
  dx * dx + dy * dy
}

hole_status <- function(level, start_x, start_y, end_x, end_y, speed) {
  radius <- level$holeRadius - max(1, level$ballRadius / 2)
  distance_squared <- distance_squared_to_segment(
    level$hole$x,
    level$hole$y,
    start_x,
    start_y,
    end_x,
    end_y
  )
  if (distance_squared > radius * radius) return("outside")
  if (speed <= 2) "capturable" else "too-fast"
}

simulate_single_shot <- function(level, state, angle, strength, max_ticks = 240) {
  resolved <- resolve_components(angle, strength)
  vx <- resolved$vx
  vy <- resolved$vy
  sx <- resolved$sx
  sy <- resolved$sy
  x <- state$x
  y <- state$y

  for (tick in seq_len(max_ticks)) {
    incoming_speed <- sqrt(vx * vx + vy * vy)
    if (hole_status(level, x, y, x, y, incoming_speed) == "capturable") {
      return(list(x = x, y = y, holed = TRUE, ticks = tick - 1))
    }

    previous_x <- x
    previous_y <- y
    next_x <- x + sx * vx
    next_y <- y + sy * vy
    x_wall <- vx > 0 && (next_x - level$ballRadius < 0 || next_x + level$ballRadius > level$width)
    y_wall <- vy > 0 && (next_y - level$ballRadius < 0 || next_y + level$ballRadius > level$height)
    obstacle_hit <- (
      obstacle_collision(level, next_x, y) ||
      obstacle_collision(level, x, next_y) ||
      obstacle_collision(level, next_x, next_y)
    )
    block_x <- vx > 0 && (x_wall || obstacle_hit)
    block_y <- vy > 0 && (y_wall || obstacle_hit)

    if (block_x) sx <- -sx else x <- next_x
    if (block_y) sy <- -sy else y <- next_y

    if (tick %% 3 == 0) {
      if (vx > 0) vx <- vx - 1
      if (vy > 0) vy <- vy - 1
    }

    if (hole_status(level, previous_x, previous_y, x, y, incoming_speed) == "capturable") {
      return(list(x = x, y = y, holed = TRUE, ticks = tick))
    }
    if (vx + vy == 0) break
  }

  list(x = x, y = y, holed = FALSE, ticks = max_ticks)
}

candidate_angles <- seq(0, 355, by = 5)

rank_candidates <- function(level, state) {
  candidates <- list()
  index <- 1
  for (angle in candidate_angles) {
    for (strength in 2:14) {
      result <- simulate_single_shot(level, state, angle, strength)
      distance <- sqrt((result$x - level$hole$x)^2 + (result$y - level$hole$y)^2)
      candidates[[index]] <- list(
        angle = angle,
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

analyze_level <- function(level, trials = 20) {
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
    coarse_solver_found_path = success_rate > 0,
    stringsAsFactors = FALSE
  )
}
