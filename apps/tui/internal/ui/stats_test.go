package ui

import (
	"strings"
	"testing"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

// goldSGR is the ANSI foreground sequence lipgloss emits for theme.Gold in the
// test environment — used to assert the peak marker actually gilds the chart.
func goldSGR(t *testing.T) string {
	t.Helper()
	probe := lipgloss.NewStyle().Foreground(theme.Gold).Render("x")
	i := strings.IndexByte(probe, 'm')
	if strings.IndexByte(probe, '\x1b') != 0 || i < 0 {
		t.Skip("lipgloss emits no color in this environment")
	}
	return probe[:i+1]
}

func TestStatsRenders(t *testing.T) {
	out := ansi.Strip(sampleStats().Body(52, 16))
	for _, want := range []string{"SQUAT", "best 142", "3m"} {
		if !strings.Contains(out, want) {
			t.Errorf("stats body missing %q:\n%s", want, out)
		}
	}
}

func TestStatsCurrentLift(t *testing.T) {
	if got := sampleStats().currentLift(); got != "Squat" {
		t.Errorf("currentLift = %q, want Squat", got)
	}
}

func TestStatsLoadingMode(t *testing.T) {
	if NewStats(nil).Mode().Label != "LOADING" {
		t.Error("expected LOADING before data")
	}
}

func TestBlockChart(t *testing.T) {
	out := ansi.Strip(blockChart([]float64{1, 3, 2, 5, 4, 6}, 12, 4, -1))
	if !strings.Contains(out, "█") {
		t.Errorf("block chart should contain full blocks:\n%s", out)
	}
}

// TestBlockChartPeakGold: the peak marker adds color but never shifts layout.
func TestBlockChartPeakGold(t *testing.T) {
	vals := []float64{1, 3, 2, 5, 4, 6} // peak = index 5
	plain := blockChart(vals, 12, 4, -1)
	marked := blockChart(vals, 12, 4, 5)
	if marked == plain {
		t.Error("peak marker should change styling")
	}
	if ansi.Strip(marked) != ansi.Strip(plain) {
		t.Errorf("peak marker must not change layout:\n%q\n%q", ansi.Strip(marked), ansi.Strip(plain))
	}
}

// TestBrailleChartPeakGold: the default (braille) renderer gilds the peak too.
func TestBrailleChartPeakGold(t *testing.T) {
	gold := goldSGR(t)
	vals := []float64{100, 110, 105, 120, 118, 130} // peak = index 5
	if raw := brailleChart(vals, 24, 6, 5); !strings.Contains(raw, gold) {
		t.Errorf("braille peak should be gold %q:\n%q", gold, raw)
	}
	if raw := brailleChart(vals, 24, 6, -1); strings.Contains(raw, gold) {
		t.Error("unmarked braille chart should not contain gold")
	}
}

func TestPeakColumn(t *testing.T) {
	cases := []struct{ peak, n, cols, want int }{
		{-1, 6, 6, -1}, // unmarked
		{0, 1, 1, -1},  // single point
		{5, 6, 12, 5},  // not downsampled → identity
		{0, 6, 6, 0},
		{9, 10, 5, 4}, // downsampled: round(9·4/9)=4
		{0, 10, 5, 0},
	}
	for _, c := range cases {
		if got := peakColumn(c.peak, c.n, c.cols); got != c.want {
			t.Errorf("peakColumn(%d,%d,%d)=%d want %d", c.peak, c.n, c.cols, got, c.want)
		}
	}
}
