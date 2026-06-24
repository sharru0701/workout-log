package ui

import (
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

func TestProgramsRenders(t *testing.T) {
	pr := NewPrograms(nil)
	pr.loaded = true
	pr.plans = []api.Plan{
		{ID: "1", Name: "5/3/1", BaseProgramName: "BBB"},
		{ID: "2", Name: "PPL", Type: "COMPOSITE"},
	}
	pr.activeID = "1"
	out := ansi.Strip(pr.Body(50, 12))
	if !strings.Contains(out, "5/3/1") || !strings.Contains(out, "PPL") {
		t.Errorf("programs body missing plan names:\n%s", out)
	}
	if !strings.Contains(out, "●") {
		t.Errorf("programs body missing active bullet:\n%s", out)
	}
}

func TestProgramsLoadingMode(t *testing.T) {
	if NewPrograms(nil).Mode().Label != "LOADING" {
		t.Error("expected LOADING before data is loaded")
	}
}

func samplePrograms() Programs {
	pr := NewPrograms(nil)
	pr.loaded = true
	pr.plans = []api.Plan{{ID: "1", Name: "5/3/1"}, {ID: "2", Name: "PPL"}}
	return pr
}

func TestProgramsRenameSubmit(t *testing.T) {
	scr, _ := samplePrograms().beginRename()
	pr := scr.(Programs)
	if !pr.renaming || !pr.Editing() {
		t.Fatal("expected rename mode active")
	}
	pr.input.SetValue("Madcow")
	scr, cmd := pr.updateRename(tea.KeyPressMsg{Code: tea.KeyEnter})
	if scr.(Programs).renaming {
		t.Error("rename should close on enter")
	}
	if cmd == nil {
		t.Error("a changed name should emit a rename command")
	}
}

func TestProgramsRenameRender(t *testing.T) {
	scr, _ := samplePrograms().beginRename()
	pr := scr.(Programs)
	pr.input.SetValue("Madcow")
	out := ansi.Strip(pr.Body(50, 10))
	if !strings.Contains(out, "Madcow") {
		t.Errorf("rename input not rendered inline:\n%s", out)
	}
}
