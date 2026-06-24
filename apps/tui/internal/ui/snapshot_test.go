package ui

import (
	"os"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"
)

// TestSnapshot writes a plain-text (ANSI-stripped) render to $IRONLOG_SNAPSHOT
// for eyeballing layout without a TTY. IRONLOG_SNAPSHOT_TARGET=log renders the
// hero logging view; anything else renders login. Skipped without the env var.
func TestSnapshot(t *testing.T) {
	out := os.Getenv("IRONLOG_SNAPSHOT")
	if out == "" {
		t.Skip("set IRONLOG_SNAPSHOT=<path> to dump a layout snapshot")
	}
	var frame string
	switch os.Getenv("IRONLOG_SNAPSHOT_TARGET") {
	case "log":
		frame = ansi.Strip(renderLogScenario(60, 18))
	default:
		frame = ansi.Strip(renderLogin(NewLogin(nil), 60, 18))
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
	l.rows = []setRow{{exercise: "Squat", weight: 100, reps: 5}, {exercise: "Squat", weight: 102.5, reps: 5}}
	l.editing = true
	l.focus = 1
	l.weight.SetValue("105")
	l.rest = restState{active: true, remaining: 72, total: 90}
	s.log = l
	ns, _ := s.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return ns.(Shell).View().Content
}
