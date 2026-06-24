package ui

import (
	"os"
	"strings"
	"testing"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

func TestSummarizeImport(t *testing.T) {
	got := summarizeImport([]api.ImportSummaryRow{
		{Table: "workoutLog", WillDelete: 1, WillInsert: 3},
		{Table: "workoutSet", WillDelete: 0, WillInsert: 10},
		{Table: "plan", WillDelete: 0, WillInsert: 0},
	})
	if !strings.Contains(got, "workoutLog 3") || !strings.Contains(got, "workoutSet 10") {
		t.Errorf("summarizeImport = %q", got)
	}
	if strings.Contains(got, "plan ") {
		t.Error("tables with zero inserts should be omitted")
	}
	if summarizeImport(nil) != "0건" {
		t.Errorf("empty summary should be 0건, got %q", summarizeImport(nil))
	}
}

func TestExpandPath(t *testing.T) {
	if got := expandPath("/abs/x.json"); got != "/abs/x.json" {
		t.Errorf("absolute path should be unchanged, got %q", got)
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		if got := expandPath("~/x.json"); !strings.HasPrefix(got, home) {
			t.Errorf("~ should expand to home, got %q", got)
		}
	}
}
