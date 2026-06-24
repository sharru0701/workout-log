package ui

import (
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"
)

func TestLogCommitAndRender(t *testing.T) {
	l := NewLog(nil)
	l.editing = true
	l.exercise.SetValue("Squat")
	l.weight.SetValue("100")
	l.reps.SetValue("5")

	l, _ = l.commitSet()
	if len(l.rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(l.rows))
	}
	if r := l.rows[0]; r.exercise != "Squat" || r.weight != 100 || r.reps != 5 {
		t.Fatalf("unexpected row: %+v", r)
	}
	if !l.rest.active || l.rest.remaining != defaultRestSeconds {
		t.Errorf("expected rest timer armed, got %+v", l.rest)
	}

	body := ansi.Strip(l.Body(60, 14))
	if !strings.Contains(body, "Squat") || !strings.Contains(body, "100kg") {
		t.Errorf("body missing the logged set:\n%s", body)
	}

	if l.tickRest().rest.remaining != defaultRestSeconds-1 {
		t.Error("rest countdown did not advance on tick")
	}
}

func TestLogValidatesBadInput(t *testing.T) {
	l := NewLog(nil)
	l.editing = true
	l.exercise.SetValue("")
	l.weight.SetValue("x")
	l.reps.SetValue("0")

	l2, cmd := l.commitSet()
	if len(l2.rows) != 0 || cmd != nil || l2.status == "" || !l2.statusErr {
		t.Errorf("expected rejection of bad input, got rows=%d status=%q", len(l2.rows), l2.status)
	}
}

func TestLogModeTransitions(t *testing.T) {
	l := NewLog(nil)
	if l.Editing() {
		t.Error("should start in NORMAL")
	}
	if l.Mode().Label != "NORMAL" {
		t.Errorf("expected NORMAL, got %q", l.Mode().Label)
	}
	l.editing = true
	if l.Mode().Label != "LOGGING" {
		t.Errorf("expected LOGGING while editing, got %q", l.Mode().Label)
	}
	l.editing = false
	l.rest = restState{active: true, remaining: 42, total: 90}
	if !strings.Contains(l.Mode().Label, "REST") {
		t.Errorf("expected REST while resting, got %q", l.Mode().Label)
	}
}
