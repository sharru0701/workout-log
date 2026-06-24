package ui

import (
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"
)

func renderLogin(l Login, w, h int) string {
	nl, _ := l.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return nl.View().Content
}

func TestLoginRenders(t *testing.T) {
	out := ansi.Strip(renderLogin(NewLogin(nil), 60, 18))
	for _, want := range []string{"ironlog", "email", "password", "로그인"} {
		if !strings.Contains(out, want) {
			t.Errorf("login view missing %q", want)
		}
	}
}

func TestLoginValidatesEmpty(t *testing.T) {
	l2, cmd := NewLogin(nil).submit()
	if cmd != nil {
		t.Error("expected no command when fields are empty")
	}
	if l2.err == "" {
		t.Error("expected a validation error when fields are empty")
	}
}
