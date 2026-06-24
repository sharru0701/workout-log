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

func TestLoginToggleSignup(t *testing.T) {
	nl, _ := NewLogin(nil).Update(tea.KeyPressMsg{Code: 't', Mod: tea.ModCtrl})
	if !nl.signup {
		t.Fatal("ctrl+t should toggle to signup mode")
	}
	out := ansi.Strip(renderLogin(nl, 60, 18))
	for _, want := range []string{"signup", "가입"} {
		if !strings.Contains(out, want) {
			t.Errorf("signup view missing %q:\n%s", want, out)
		}
	}
}

func TestLoginSignupShortPassword(t *testing.T) {
	l := NewLogin(nil)
	l.signup = true
	l.email.SetValue("new@example.com")
	l.password.SetValue("short") // <8
	l2, cmd := l.submit()
	if cmd != nil {
		t.Error("a <8 char signup password should be rejected")
	}
	if !strings.Contains(l2.err, "8자") {
		t.Errorf("err = %q, want a length error", l2.err)
	}
}

func TestLoginSignupValidSubmits(t *testing.T) {
	l := NewLogin(nil)
	l.signup = true
	l.email.SetValue("new@example.com")
	l.password.SetValue("password123")
	l2, cmd := l.submit()
	if cmd == nil || !l2.submitting {
		t.Error("a valid signup should produce a submit command")
	}
}
