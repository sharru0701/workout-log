package ui

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

func TestHomeRenders(t *testing.T) {
	var d api.HomeData
	if err := json.Unmarshal([]byte(sampleHomeJSON), &d); err != nil {
		t.Fatal(err)
	}
	hm := NewHome(nil)
	hm.data = &d

	out := ansi.Strip(hm.Body(50, 14))
	for _, want := range []string{"TODAY", "STREAK", "VOLUME", "STRENGTH", "SQ142", "DL180", "12400"} {
		if !strings.Contains(out, want) {
			t.Errorf("home body missing %q:\n%s", want, out)
		}
	}
}

func TestHomeLoadingThenError(t *testing.T) {
	hm := NewHome(nil)
	if hm.Mode().Label != "LOADING" {
		t.Errorf("want LOADING before data, got %q", hm.Mode().Label)
	}
	if !strings.Contains(ansi.Strip(hm.Body(40, 10)), "불러오는") {
		t.Error("expected loading text before data")
	}

	next, _ := hm.Update(homeLoadedMsg{err: errors.New("boom")})
	if next.(Home).err == "" {
		t.Error("expected error to be recorded on load failure")
	}
}
