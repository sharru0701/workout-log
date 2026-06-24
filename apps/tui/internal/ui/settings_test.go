package ui

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

func TestSettingsRenders(t *testing.T) {
	st := NewSettings(nil)
	st.loaded = true
	st.values = map[string]json.RawMessage{
		"prefs.locale":        json.RawMessage(`"en"`),
		"prefs.bodyweight.kg": json.RawMessage(`82.5`),
	}
	out := ansi.Strip(st.Body(50, 12))
	for _, want := range []string{"언어", "English", "체중", "82.5kg"} {
		if !strings.Contains(out, want) {
			t.Errorf("settings body missing %q:\n%s", want, out)
		}
	}
}

func TestSettingsCycle(t *testing.T) {
	st := NewSettings(nil)
	st.values = map[string]json.RawMessage{"prefs.locale": json.RawMessage(`"ko"`)}
	next, cmd := st.cycle(settingDefs[0]) // locale ko → en
	if s2 := next.(Settings); s2.rawString("prefs.locale") != "en" {
		t.Errorf("expected en after cycle, got %q", s2.rawString("prefs.locale"))
	}
	if cmd == nil {
		t.Error("expected a PATCH command after cycle")
	}
}

func TestSettingsLoadingMode(t *testing.T) {
	if NewSettings(nil).Mode().Label != "LOADING" {
		t.Error("expected LOADING before data is loaded")
	}
}

func TestSettingsAccountSection(t *testing.T) {
	st := NewSettings(nil)
	st.loaded = true
	st.values = map[string]json.RawMessage{}
	out := ansi.Strip(st.Body(60, 20))
	for _, want := range []string{"PREFERENCES", "ACCOUNT", "비밀번호", "계정 삭제"} {
		if !strings.Contains(out, want) {
			t.Errorf("settings body missing %q:\n%s", want, out)
		}
	}
}

func TestSettingsPasswordValidation(t *testing.T) {
	st := NewSettings(nil)
	scr, _ := st.beginPasswordForm()
	st = scr.(Settings)
	if st.form != formPassword {
		t.Fatalf("expected formPassword, got %v", st.form)
	}
	st.pw[0].SetValue("oldpass1")
	st.pw[1].SetValue("short") // <8 chars
	st.pw[2].SetValue("short")
	scr, cmd := st.submitPassword()
	st = scr.(Settings)
	if cmd != nil {
		t.Error("expected no command for an invalid password")
	}
	if !strings.Contains(st.flash, "8자") {
		t.Errorf("expected length error, got %q", st.flash)
	}
}

func TestSettingsPasswordMismatch(t *testing.T) {
	st := NewSettings(nil)
	scr, _ := st.beginPasswordForm()
	st = scr.(Settings)
	st.pw[0].SetValue("oldpass1")
	st.pw[1].SetValue("newpass12")
	st.pw[2].SetValue("different12")
	scr, cmd := st.submitPassword()
	st = scr.(Settings)
	if cmd != nil {
		t.Error("expected no command on confirmation mismatch")
	}
	if !strings.Contains(st.flash, "일치") {
		t.Errorf("expected mismatch error, got %q", st.flash)
	}
}

func TestSettingsDeleteFormEmitsConfirm(t *testing.T) {
	st := NewSettings(nil)
	scr, _ := st.beginDeleteForm()
	st = scr.(Settings)
	if st.form != formDelete {
		t.Fatalf("expected formDelete, got %v", st.form)
	}
	st.pw[0].SetValue("mypassword")
	scr, cmd := st.submitDelete()
	st = scr.(Settings)
	if st.form != formNone {
		t.Error("delete form should close once the confirm is handed off")
	}
	if cmd == nil {
		t.Fatal("expected a confirm command")
	}
	if _, ok := cmd().(confirmMsg); !ok {
		t.Error("expected submitDelete to emit a confirmMsg")
	}
}

func TestSettingsAccountErrorFlash(t *testing.T) {
	st := NewSettings(nil)
	st.loaded, st.pending = true, true
	scr, _ := st.Update(accountActionMsg{err: &api.APIError{Status: http.StatusUnauthorized}})
	st = scr.(Settings)
	if st.pending {
		t.Error("pending should clear after the action resolves")
	}
	if !strings.Contains(st.flash, "현재 비밀번호") {
		t.Errorf("expected wrong-password flash, got %q", st.flash)
	}
}

func TestSettingsPasswordSuccessFlash(t *testing.T) {
	st := NewSettings(nil)
	st.loaded, st.form, st.pending = true, formPassword, true
	scr, _ := st.Update(accountActionMsg{ok: "비밀번호를 변경했습니다"})
	st = scr.(Settings)
	if st.form != formNone {
		t.Error("password form should close on success")
	}
	if !st.flashOk || !strings.Contains(st.flash, "변경") {
		t.Errorf("expected success flash, got ok=%v %q", st.flashOk, st.flash)
	}
}
