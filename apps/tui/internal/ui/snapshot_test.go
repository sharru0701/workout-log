package ui

import (
	"encoding/json"
	"os"
	"strconv"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

func atoiOr(s string, d int) int {
	if n, err := strconv.Atoi(s); err == nil && n > 0 {
		return n
	}
	return d
}

// TestSnapshot writes a plain-text (ANSI-stripped) render to $IRONLOG_SNAPSHOT
// for eyeballing layout without a TTY. IRONLOG_SNAPSHOT_TARGET selects the
// view: log | home | (default) login. Skipped without the env var.
func TestSnapshot(t *testing.T) {
	out := os.Getenv("IRONLOG_SNAPSHOT")
	if out == "" {
		t.Skip("set IRONLOG_SNAPSHOT=<path> to dump a layout snapshot")
	}
	w := atoiOr(os.Getenv("IRONLOG_SNAPSHOT_W"), 60)
	h := atoiOr(os.Getenv("IRONLOG_SNAPSHOT_H"), 18)
	var frame string
	switch os.Getenv("IRONLOG_SNAPSHOT_TARGET") {
	case "log":
		frame = ansi.Strip(renderLogScenario(w, h))
	case "home":
		frame = ansi.Strip(renderHomeScenario(w, h))
	default:
		frame = ansi.Strip(renderLogin(NewLogin(nil), w, h))
	}
	if err := os.WriteFile(out, []byte(frame), 0o644); err != nil {
		t.Fatal(err)
	}
}

func renderLogScenario(w, h int) string {
	s := NewShell(nil)
	l := s.screens[TabLog].(Log)
	l.rows = []logRow{
		{exercise: "Squat", weight: "100", reps: "5", done: true},
		{exercise: "Squat", weight: "102.5", reps: "5", done: true},
		{exercise: "Squat", weight: "105", reps: ""},
	}
	l.row, l.col = 2, colReps
	l.rest = restState{active: true, remaining: 48, total: 90}
	s.screens[TabLog] = l
	ns, _ := s.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return ns.(Shell).View().Content
}

func renderHomeScenario(w, h int) string {
	s := NewShell(nil)
	s.active = TabHome
	hm := s.screens[TabHome].(Home)
	var d api.HomeData
	if err := json.Unmarshal([]byte(sampleHomeJSON), &d); err != nil {
		panic(err)
	}
	hm.data = &d
	s.screens[TabHome] = hm
	ns, _ := s.Update(tea.WindowSizeMsg{Width: w, Height: h})
	return ns.(Shell).View().Content
}

const sampleHomeJSON = `{
 "today":{"programName":"5/3/1 · Squat day","meta":"Squat 5×5 · Bench 5×5 · Row 5×8","hasPlan":true},
 "weeklySummary":{"activeDays":4,"days":[
   {"shortLabel":"월","hasWorkout":true},{"shortLabel":"화","hasWorkout":false},
   {"shortLabel":"수","hasWorkout":true},{"shortLabel":"목","hasWorkout":false},
   {"shortLabel":"금","hasWorkout":true},{"shortLabel":"토","hasWorkout":false},
   {"shortLabel":"일","hasWorkout":false,"isToday":true}]},
 "strengthProgress":[
   {"exerciseName":"Squat","bestE1rm":142,"trend":"up"},
   {"exerciseName":"Bench Press","bestE1rm":98,"trend":"flat"},
   {"exerciseName":"Deadlift","bestE1rm":180,"trend":"up"}],
 "volumeTrend":[
   {"label":"6/1","tonnage":8200},{"label":"6/3","tonnage":9100},
   {"label":"6/5","tonnage":7600},{"label":"6/8","tonnage":11200},
   {"label":"6/10","tonnage":10400},{"label":"6/12","tonnage":12400}],
 "quickStats":{"totalSessions":48,"currentStreak":12,"thisMonthSessions":9},
 "recentSessions":[{"title":"5/3/1","subtitle":"6월 21일 (토)","description":"12세트"}]
}`
