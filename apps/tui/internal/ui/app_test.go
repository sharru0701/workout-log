package ui

import "testing"

func TestAppLogoutReturnsToLogin(t *testing.T) {
	a := App{state: stateFrame, frame: NewFrame(nil), login: NewLogin(nil)}
	next, _ := a.Update(loggedOutMsg{})
	if next.(App).state != stateLogin {
		t.Errorf("expected stateLogin after logout, got %d", next.(App).state)
	}
}
