package ui

import (
	"os"
	"strconv"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"
)

func atoiOr(s string, d int) int {
	if n, err := strconv.Atoi(s); err == nil && n > 0 {
		return n
	}
	return d
}

// TestSnapshot writes a plain-text (ANSI-stripped) render to $IRONLOG_SNAPSHOT
// for eyeballing layout without a TTY. IRONLOG_SNAPSHOT_TARGET=log renders the
// hero logging view; anything else renders login. Skipped without the env var.
func TestSnapshot(t *testing.T) {
	out := os.Getenv("IRONLOG_SNAPSHOT")
	if out == "" {
		t.Skip("set IRONLOG_SNAPSHOT=<path> to dump a layout snapshot")
	}
	w := atoiOr(os.Getenv("IRONLOG_SNAPSHOT_W"), 60)
	h := atoiOr(os.Getenv("IRONLOG_SNAPSHOT_H"), 18)
	var frame string
	switch os.Getenv("IRONLOG_SNAPSHOT_TARGET") {
	case "log":
		frame = ansi.Strip(renderLogScenario(w, h))
	default:
		frame = ansi.Strip(renderLogin(NewLogin(nil), w, h))
	}
	if err := os.WriteFile(out, []byte(frame), 0o644); err != nil {
		t.Fatal(err)
	}
}

// renderLogScenario builds a representative hero state: a couple of logged sets,
// an active rest, and the entry bar mid-edit.
func renderLogScenario(w, h int) string {
	s := NewShell(nil)
	l := s.log
	l.rows = []logRow{
		{exercise: "Squat", weight: "100", reps: "5", done: true},
		{exercise: "Squat", weight: "102.5", reps: "5", done: true},
		{exercise: "Squat", weight: "105", reps: ""},
	}
	l.row, l.col = 2, colReps
	l.rest = restState{active: true, remaining: 48, total: 90}
	s.log = l
	ns, _ := s.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return ns.(Shell).View().Content
}
