package ui

import (
	"net/http"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

func sampleExercises() Exercises {
	scr, _ := NewExercises(nil).Update(exercisesLoadedMsg{items: []api.Exercise{
		{ID: "1", Name: "Squat", Category: "legs"},
		{ID: "2", Name: "Bench Press", Category: "chest"},
		{ID: "3", Name: "Deadlift", Category: "back"},
	}})
	return scr.(Exercises)
}

func TestExercisesFilter(t *testing.T) {
	s := sampleExercises()
	s.query = "dead"
	s.refilter()
	if len(s.view) != 1 {
		t.Fatalf("filter 'dead' → %d rows, want 1", len(s.view))
	}
	if ex, _ := s.current(); ex.Name != "Deadlift" {
		t.Errorf("current = %q, want Deadlift", ex.Name)
	}
}

func TestExercisesRenameSubmit(t *testing.T) {
	scr, _ := sampleExercises().beginInput(exRename, "Squat")
	s := scr.(Exercises)
	if s.mode != exRename || !s.Editing() {
		t.Fatal("expected rename input mode")
	}
	s.input.SetValue("Back Squat")
	scr, cmd := s.submitInput()
	if scr.(Exercises).mode != exBrowse {
		t.Error("mode should return to browse after submit")
	}
	if cmd == nil {
		t.Error("a changed name should emit a rename command")
	}
}

func TestExercisesRenameNoopSameName(t *testing.T) {
	scr, _ := sampleExercises().beginInput(exRename, "Squat")
	s := scr.(Exercises)
	s.input.SetValue("Squat") // unchanged
	if _, cmd := s.submitInput(); cmd != nil {
		t.Error("an unchanged name should not emit a command")
	}
}

func TestExercisesDeleteConfirm(t *testing.T) {
	_, cmd := sampleExercises().handleKey(tea.KeyPressMsg{Code: 'd'})
	if cmd == nil {
		t.Fatal("d should emit a command")
	}
	if _, ok := cmd().(confirmMsg); !ok {
		t.Errorf("want confirmMsg, got %T", cmd())
	}
}

func TestExercisesAliasSubmit(t *testing.T) {
	scr, _ := sampleExercises().beginInput(exAlias, "")
	s := scr.(Exercises)
	s.input.SetValue("BS")
	if _, cmd := s.submitInput(); cmd == nil {
		t.Error("alias should emit a command")
	}
}

func TestExercisesActionConflict(t *testing.T) {
	scr, _ := sampleExercises().Update(exActionMsg{err: &api.APIError{Status: http.StatusConflict}})
	s := scr.(Exercises)
	if s.flashOk || !strings.Contains(s.flash, "이미") {
		t.Errorf("conflict flash = %q ok=%v, want a non-ok 이미… message", s.flash, s.flashOk)
	}
}
