package ui

import (
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"
)

func renderFrame(f Frame, w, h int) string {
	nf, _ := f.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return ansi.Strip(nf.(Frame).View().Content)
}

func TestFrameBootsToday(t *testing.T) {
	out := renderFrame(NewFrame(nil), 60, 20)
	// boots into an empty today buffer + statusline (mode/buffer) + hint globals
	for _, want := range []string{"운동", "NORMAL", "today", "space", "이동"} {
		if !strings.Contains(out, want) {
			t.Errorf("frame missing %q:\n%s", want, out)
		}
	}
}

func TestFrameGotoMenu(t *testing.T) {
	f := NewFrame(nil)
	f.overlay = overlayGoto
	out := renderFrame(f, 60, 20)
	for _, want := range []string{"이동", "stats", "history", "programs", "settings"} {
		if !strings.Contains(out, want) {
			t.Errorf("goto menu missing %q", want)
		}
	}
}

func TestFrameRunCommand(t *testing.T) {
	m, _ := NewFrame(nil).runCommand("stats")
	if m.(Frame).active != vStats {
		t.Errorf("expected switch to stats, got active=%d", m.(Frame).active)
	}
	m2, _ := NewFrame(nil).runCommand("zzz")
	if m2.(Frame).flash == "" {
		t.Error("expected a flash message on an unknown command")
	}
}

func TestFrameQuitCommand(t *testing.T) {
	if _, cmd := NewFrame(nil).runCommand("q"); cmd == nil {
		t.Error("expected :q to return a quit command")
	}
}
