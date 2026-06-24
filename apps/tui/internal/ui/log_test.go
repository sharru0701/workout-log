package ui

import (
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

func sampleLog() Log {
	l := NewLog(nil)
	l.groups = []exGroup{{name: "Squat", sets: []setEntry{
		{weight: "100", reps: "5", done: true},
		{weight: "102.5", reps: "5", done: true},
		{weight: "105", reps: ""},
	}}}
	l.gi, l.si, l.col = 0, 2, colWeight
	return l
}

func TestLogCompleteSet(t *testing.T) {
	l := sampleLog()
	l.groups[0].sets[2].weight, l.groups[0].sets[2].reps = "105", "5"
	l.col = colReps
	l2, _ := l.completeSet()
	if !l2.groups[0].sets[2].done {
		t.Fatal("expected the set to be marked done")
	}
	if !l2.rest.active {
		t.Error("expected rest armed")
	}
	if len(l2.groups[0].sets) != 4 {
		t.Errorf("expected an appended empty set, got %d", len(l2.groups[0].sets))
	}
}

func TestLogCompleteRejectsBad(t *testing.T) {
	l := NewLog(nil)
	l.groups = []exGroup{{name: "Squat", sets: []setEntry{{weight: "x", reps: "0"}}}}
	l2, cmd := l.completeSet()
	if l2.groups[0].sets[0].done || cmd != nil || !l2.statusErr {
		t.Error("expected rejection of bad input")
	}
}

func TestLogSaveNeedsDone(t *testing.T) {
	l2, cmd := NewLog(nil).save()
	if cmd != nil || l2.status == "" || !l2.statusErr {
		t.Error("expected save rejection with no completed sets")
	}
}

func TestLogSaveCollects(t *testing.T) {
	l2, cmd := sampleLog().save()
	if cmd == nil || !l2.saving {
		t.Fatal("expected a save command")
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

func TestLogBodyGrouped(t *testing.T) {
	out := ansi.Strip(sampleLog().Body(50, 16))
	for _, want := range []string{"SQUAT", "100", "102.5", "×"} {
		if !strings.Contains(out, want) {
			t.Errorf("grouped body missing %q:\n%s", want, out)
		}
	}
}

func TestLogContext(t *testing.T) {
	if got := sampleLog().Context(); got != "Squat 3/3" {
		t.Errorf("Context = %q, want Squat 3/3", got)
	}
}

func TestLogLoadSnapshot(t *testing.T) {
	l := NewLog(nil)
	l.loadSnapshot(&api.SessionSnapshot{
		Exercises: []api.PlannedExercise{
			{ExerciseName: "Squat", Role: "MAIN", Sets: []api.PlannedSet{
				{Reps: 5, TargetWeightKg: 100}, {Reps: 5, TargetWeightKg: 100}, {Reps: 5, TargetWeightKg: 102.5},
			}},
			{ExerciseName: "Bench Press", Role: "MAIN", Sets: []api.PlannedSet{{Reps: 5, TargetWeightKg: 70}}},
		},
	})
	if len(l.groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(l.groups))
	}
	if l.groups[0].name != "Squat" || len(l.groups[0].sets) != 3 {
		t.Errorf("unexpected squat group: %+v", l.groups[0])
	}
	if l.groups[0].sets[0].weight != "100" {
		t.Errorf("expected pre-filled target weight 100, got %q", l.groups[0].sets[0].weight)
	}
	if l.groups[0].tgt != "102.5×5" {
		t.Errorf("tgt = %q, want 102.5×5", l.groups[0].tgt)
	}
}

func TestLogExercisePicked(t *testing.T) {
	next, cmd := NewLog(nil).Update(pickedMsg{tag: "exercise", value: "Squat"})
	l := next.(Log)
	if len(l.groups) != 1 || l.groups[0].name != "Squat" {
		t.Fatalf("expected a Squat group, got %+v", l.groups)
	}
	if !l.editing || l.col != colWeight {
		t.Error("expected to be editing the weight cell after picking")
	}
	if cmd == nil {
		t.Error("expected a focus command")
	}
}
