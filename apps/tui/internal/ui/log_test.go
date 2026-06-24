package ui

import (
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"
)

func TestLogCompleteRow(t *testing.T) {
	l := NewLog(nil)
	l.rows = []logRow{{exercise: "Squat", weight: "100", reps: "5"}}
	l.row, l.col = 0, colReps

	l, _ = l.completeRow()
	if !l.rows[0].done {
		t.Fatal("expected the row to be marked done")
	}
	if !l.rest.active || l.rest.remaining != defaultRestSeconds {
		t.Errorf("expected rest armed, got %+v", l.rest)
	}
	// a fresh row inheriting the exercise should be appended and focused
	if len(l.rows) != 2 || l.rows[1].exercise != "Squat" {
		t.Fatalf("expected appended row inheriting exercise, got %+v", l.rows)
	}
	if !l.editing || l.row != 1 || l.col != colWeight {
		t.Errorf("expected to be editing weight of the new row, editing=%v row=%d col=%d", l.editing, l.row, l.col)
	}

	body := ansi.Strip(l.Body(60, 16))
	if !strings.Contains(body, "Squat") || !strings.Contains(body, "100") {
		t.Errorf("body missing the logged set:\n%s", body)
	}
}

func TestLogCompleteRejectsBadInput(t *testing.T) {
	l := NewLog(nil)
	l.rows = []logRow{{exercise: "", weight: "x", reps: "0"}}
	l2, cmd := l.completeRow()
	if l2.rows[0].done || cmd != nil || l2.status == "" || !l2.statusErr {
		t.Errorf("expected rejection of bad input, done=%v status=%q", l2.rows[0].done, l2.status)
	}
}

func TestLogSaveNeedsDoneSets(t *testing.T) {
	l2, cmd := NewLog(nil).save()
	if cmd != nil || l2.status == "" || !l2.statusErr {
		t.Errorf("expected save rejection with no completed sets, status=%q", l2.status)
	}
}

func TestLogSaveCollectsDoneRows(t *testing.T) {
	l := NewLog(nil)
	l.rows = []logRow{
		{exercise: "Squat", weight: "100", reps: "5", done: true},
		{exercise: "Squat", weight: "102.5", reps: "5", done: true},
		{exercise: "Bench", weight: "70", reps: "5"}, // not done → excluded
	}
	l2, cmd := l.save()
	if cmd == nil || !l2.saving {
		t.Fatal("expected a save command for completed sets")
	}
	if got := l2.StatusRight(); got != "2 sets" {
		t.Errorf("StatusRight = %q, want 2 sets", got)
	}
}

func TestLogModeTransitions(t *testing.T) {
	l := NewLog(nil)
	if l.Mode().Label != "NORMAL" {
		t.Errorf("want NORMAL, got %q", l.Mode().Label)
	}
	l.editing = true
	if l.Mode().Label != "INSERT" {
		t.Errorf("want INSERT, got %q", l.Mode().Label)
	}
	l.editing = false
	l.rest = restState{active: true, remaining: 42, total: 90}
	if !strings.Contains(l.Mode().Label, "REST") {
		t.Errorf("want REST, got %q", l.Mode().Label)
	}
}
