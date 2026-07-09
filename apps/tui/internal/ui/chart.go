package ui

import (
	"image/color"
	"math"
	"strings"

	"charm.land/lipgloss/v2"
	"github.com/NimbleMarkets/ntcharts/v2/canvas"
	"github.com/NimbleMarkets/ntcharts/v2/linechart"

	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

// centered places styled text in the middle of a w×h block (loading/empty/error).
func centered(text string, tone color.Color, w, h int) string {
	return lipgloss.Place(w, h, lipgloss.Center, lipgloss.Center,
		lipgloss.NewStyle().Foreground(tone).Render(text))
}

func minMax(vals []float64) (float64, float64) {
	mn, mx := vals[0], vals[0]
	for _, v := range vals {
		if v < mn {
			mn = v
		}
		if v > mx {
			mx = v
		}
	}
	return mn, mx
}

// lineChart renders a trend. braille uses ntcharts (smooth, needs a Nerd Font);
// otherwise a robust block column chart.
func lineChart(vals []float64, w, h int, braille bool) string {
	return lineChartMarked(vals, w, h, braille, -1)
}

// lineChartMarked renders a trend and highlights the value at peakIdx in gold —
// the e1RM chart's best set (a PR high, §5 "gold ★ PR"). peakIdx < 0 = no marker
// (used by the volume chart, whose max isn't a record). ntcharts places the point
// itself, so no column math / axis-offset alignment is needed.
func lineChartMarked(vals []float64, w, h int, braille bool, peakIdx int) string {
	if len(vals) == 0 || w < 4 || h < 2 {
		return ""
	}
	if braille && len(vals) >= 2 {
		return brailleChart(vals, w, h, peakIdx)
	}
	return blockChart(vals, w, h, peakIdx)
}

func brailleChart(vals []float64, w, h, peakIdx int) string {
	mn, mx := minMax(vals)
	pad := (mx - mn) * 0.1
	if pad <= 0 {
		pad = mx*0.05 + 1
	}
	lc := linechart.New(w, h, 0, float64(len(vals)-1), mn-pad, mx+pad)
	lc.DrawXYAxisAndLabel()
	green := lipgloss.NewStyle().Foreground(theme.Green)
	gold := lipgloss.NewStyle().Foreground(theme.Gold)
	for i := 0; i+1 < len(vals); i++ {
		style := green
		// gild both segments meeting at the peak so it reads as the high point.
		if peakIdx >= 0 && (i == peakIdx || i+1 == peakIdx) {
			style = gold
		}
		lc.DrawBrailleLineWithStyle(
			canvas.Float64Point{X: float64(i), Y: vals[i]},
			canvas.Float64Point{X: float64(i + 1), Y: vals[i+1]},
			style,
		)
	}
	return lc.View()
}

func blockChart(vals []float64, w, h, peakIdx int) string {
	cols := sampleTo(vals, w)
	peakCol := peakColumn(peakIdx, len(vals), len(cols))
	mn, mx := minMax(cols)
	rng := mx - mn
	if rng <= 0 {
		rng = 1
	}
	green := lipgloss.NewStyle().Foreground(theme.Green)
	gold := lipgloss.NewStyle().Foreground(theme.Gold)
	rows := make([]string, h)
	for r := 0; r < h; r++ {
		rowFromBottom := h - 1 - r
		cells := make([]rune, len(cols))
		for ci, v := range cols {
			cells[ci] = blockCell((v-mn)/rng*float64(h), rowFromBottom)
		}
		// Style the peak column gold, the rest green — three spans, same visible
		// width. (Gold on an empty ' ' cell is invisible, so only the bar gilds.)
		if peakCol >= 0 && peakCol < len(cells) {
			rows[r] = green.Render(string(cells[:peakCol])) +
				gold.Render(string(cells[peakCol])) +
				green.Render(string(cells[peakCol+1:]))
		} else {
			rows[r] = green.Render(string(cells))
		}
	}
	return strings.Join(rows, "\n")
}

// peakColumn maps a peak index in the source data to its column in the block
// chart's sampled columns (nCols). -1 when unmarked. When the data isn't
// downsampled (n <= nCols) each value is its own column; otherwise the sampling
// stride maps it proportionally (matching sampleTo).
func peakColumn(peakIdx, n, nCols int) int {
	if peakIdx < 0 || n <= 1 || nCols <= 0 {
		return -1
	}
	if n <= nCols {
		return peakIdx
	}
	col := int(math.Round(float64(peakIdx) * float64(nCols-1) / float64(n-1)))
	if col < 0 {
		return 0
	}
	if col > nCols-1 {
		return nCols - 1
	}
	return col
}

var blockEighths = []rune("▁▂▃▄▅▆▇")

func blockCell(level float64, rowFromBottom int) rune {
	lo := float64(rowFromBottom)
	if level >= lo+1 {
		return '█'
	}
	if level <= lo {
		return ' '
	}
	idx := int((level - lo) * float64(len(blockEighths)))
	if idx < 0 {
		idx = 0
	}
	if idx >= len(blockEighths) {
		idx = len(blockEighths) - 1
	}
	return blockEighths[idx]
}

// sampleTo downsamples vals to at most n evenly spaced points.
func sampleTo(vals []float64, n int) []float64 {
	if n <= 0 || len(vals) <= n {
		return vals
	}
	out := make([]float64, n)
	for i := 0; i < n; i++ {
		out[i] = vals[i*(len(vals)-1)/(n-1)]
	}
	return out
}
