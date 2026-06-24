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
// for eyeballing layout without a TTY. IRONLOG_SNAPSHOT_TARGET selects the view:
// today | goto | (default) login. Skipped without the env var.
func TestSnapshot(t *testing.T) {
	out := os.Getenv("IRONLOG_SNAPSHOT")
	if out == "" {
		t.Skip("set IRONLOG_SNAPSHOT=<path> to dump a layout snapshot")
	}
	w := atoiOr(os.Getenv("IRONLOG_SNAPSHOT_W"), 60)
	h := atoiOr(os.Getenv("IRONLOG_SNAPSHOT_H"), 18)
	var frame string
	switch os.Getenv("IRONLOG_SNAPSHOT_TARGET") {
	case "today", "log":
		frame = ansi.Strip(renderTodayScenario(w, h))
	case "goto":
		frame = ansi.Strip(renderGotoScenario(w, h))
	case "palette":
		frame = ansi.Strip(renderPaletteScenario(w, h))
	case "help":
		frame = ansi.Strip(renderHelpScenario(w, h))
	default:
		frame = ansi.Strip(renderLogin(NewLogin(nil), w, h))
	}
	if err := os.WriteFile(out, []byte(frame), 0o644); err != nil {
		t.Fatal(err)
	}
}

func sampleTodayFrame() Frame {
	f := NewFrame(nil)
	l := f.views[vToday].(Log)
	l.groups = []exGroup{
		{name: "Squat", prev: "100×5", tgt: "102.5", sets: []setEntry{
			{weight: "100", reps: "5", done: true},
			{weight: "102.5", reps: "5", done: true},
			{weight: "105", reps: ""},
		}},
		{name: "Bench Press", prev: "70×5", sets: []setEntry{{}}},
	}
	l.gi, l.si, l.col = 0, 2, colReps
	l.rest = restState{active: true, remaining: 48, total: 90}
	f.views[vToday] = l
	return f
}

func renderTodayScenario(w, h int) string {
	nf, _ := sampleTodayFrame().Update(tea.WindowSizeMsg{Width: w, Height: h})
	return nf.(Frame).View().Content
}

func renderGotoScenario(w, h int) string {
	f := sampleTodayFrame()
	f.overlay = overlayGoto
	f.gotoSel = int(vStats)
	nf, _ := f.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return nf.(Frame).View().Content
}

func renderPaletteScenario(w, h int) string {
	f := sampleTodayFrame()
	f.picker = newPicker(":", commandItems())
	f.picker.input.SetValue("s")
	f.overlay = overlayPicker
	nf, _ := f.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return nf.(Frame).View().Content
}

func renderHelpScenario(w, h int) string {
	f := sampleTodayFrame()
	f.overlay = overlayHelp
	nf, _ := f.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return nf.(Frame).View().Content
}
