package ui

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

const defaultRestSeconds = 90

type setRow struct {
	exercise string
	weight   float64
	reps     int
}

type restState struct {
	active    bool
	remaining int
	total     int
}

type saveResultMsg struct {
	detail *api.LogDetail
	err    error
}

func saveCmd(c *api.Client, rows []setRow) tea.Cmd {
	sets := make([]api.WorkoutSet, len(rows))
	for i, r := range rows {
		sets[i] = api.WorkoutSet{ExerciseName: r.exercise, Reps: r.reps, WeightKg: r.weight}
	}
	now := time.Now()
	return func() tea.Msg {
		id, err := c.CreateLog(context.Background(), api.CreateLogRequest{Sets: sets, PerformedAt: now})
		if err != nil {
			return saveResultMsg{err: err}
		}
		detail, err := c.GetLog(context.Background(), id)
		return saveResultMsg{detail: detail, err: err}
	}
}

// Log is the hero workout-logging view (2:log). Free-form for the MVP: add sets
// (exercise · weight · reps), rest between them, then save to POST /api/logs.
type Log struct {
	client    *api.Client
	rows      []setRow
	exercise  textinput.Model
	weight    textinput.Model
	reps      textinput.Model
	focus     int // 0 exercise, 1 weight, 2 reps
	editing   bool
	rest      restState
	saving    bool
	status    string
	statusErr bool
	w, h      int
}

func NewLog(client *api.Client) Log {
	ex := textinput.New()
	ex.Placeholder = "exercise"
	ex.Prompt = ""
	ex.SetVirtualCursor(true)
	ex.SetWidth(18)

	wt := textinput.New()
	wt.Placeholder = "kg"
	wt.Prompt = ""
	wt.SetVirtualCursor(true)
	wt.SetWidth(6)

	rp := textinput.New()
	rp.Placeholder = "reps"
	rp.Prompt = ""
	rp.SetVirtualCursor(true)
	rp.SetWidth(5)

	return Log{client: client, exercise: ex, weight: wt, reps: rp}
}

// Editing reports whether the entry bar owns keyboard input (INSERT mode).
func (l Log) Editing() bool { return l.editing }

// Mode is the status-bar label/tone derived from the log state.
func (l Log) Mode() Mode {
	switch {
	case l.rest.active:
		return Mode{Label: fmt.Sprintf("REST %ds", l.rest.remaining), Tone: theme.Cyan}
	case l.saving:
		return Mode{Label: "SAVING", Tone: theme.Amber}
	case l.editing:
		return Mode{Label: "LOGGING", Tone: theme.Amber}
	default:
		return ModeNormal
	}
}

// StatusRight is the right-aligned status text (set count).
func (l Log) StatusRight() string {
	if len(l.rows) == 0 {
		return ""
	}
	return fmt.Sprintf("%d set%s", len(l.rows), plural(len(l.rows)))
}

func (l Log) Update(msg tea.Msg) (Log, tea.Cmd) {
	switch m := msg.(type) {
	case tea.WindowSizeMsg:
		l.w, l.h = m.Width, m.Height
		return l, nil
	case saveResultMsg:
		l.saving = false
		if m.err != nil {
			l.status = "저장 실패: " + humanizeAuthErr(m.err)
			l.statusErr = true
			return l, nil
		}
		l.status = summarizePRs(m.detail)
		l.statusErr = false
		l.rows = nil
		return l, nil
	case tea.KeyPressMsg:
		if l.editing {
			return l.updateEditing(m)
		}
		return l.updateNormal(m)
	}

	if l.editing {
		return l.forwardToField(msg)
	}
	return l, nil
}

func (l Log) updateNormal(m tea.KeyPressMsg) (Log, tea.Cmd) {
	switch m.String() {
	case "i", "a":
		l.editing = true
		l.focus = 0
		return l, l.refocusEntry()
	case "s":
		if len(l.rows) == 0 || l.saving {
			return l, nil
		}
		l.saving = true
		l.status = ""
		l.statusErr = false
		return l, saveCmd(l.client, l.rows)
	case "x":
		if len(l.rows) > 0 {
			l.rows = l.rows[:len(l.rows)-1]
		}
		return l, nil
	case "r":
		l.rest.active = false
		return l, nil
	}
	return l, nil
}

func (l Log) updateEditing(m tea.KeyPressMsg) (Log, tea.Cmd) {
	switch m.String() {
	case "esc":
		l.editing = false
		l.exercise.Blur()
		l.weight.Blur()
		l.reps.Blur()
		return l, nil
	case "tab", "down":
		l.focus = (l.focus + 1) % 3
		return l, l.refocusEntry()
	case "shift+tab", "up":
		l.focus = (l.focus + 2) % 3
		return l, l.refocusEntry()
	case "enter":
		return l.commitSet()
	}
	return l.forwardToField(m)
}

func (l Log) forwardToField(msg tea.Msg) (Log, tea.Cmd) {
	var cmd tea.Cmd
	switch l.focus {
	case 0:
		l.exercise, cmd = l.exercise.Update(msg)
	case 1:
		l.weight, cmd = l.weight.Update(msg)
	default:
		l.reps, cmd = l.reps.Update(msg)
	}
	return l, cmd
}

func (l Log) commitSet() (Log, tea.Cmd) {
	ex := strings.TrimSpace(l.exercise.Value())
	w, werr := strconv.ParseFloat(strings.TrimSpace(l.weight.Value()), 64)
	r, rerr := strconv.Atoi(strings.TrimSpace(l.reps.Value()))
	if ex == "" || werr != nil || rerr != nil || r <= 0 || w < 0 {
		l.status = "운동명·무게·reps(>0)를 정확히 입력하세요"
		l.statusErr = true
		return l, nil
	}
	l.rows = append(l.rows, setRow{exercise: ex, weight: w, reps: r})
	l.status = ""
	l.statusErr = false
	l.rest = restState{active: true, remaining: defaultRestSeconds, total: defaultRestSeconds}
	l.weight.SetValue("")
	l.reps.SetValue("")
	l.focus = 1 // keep exercise, jump to weight for the next set
	return l, l.refocusEntry()
}

func (l *Log) refocusEntry() tea.Cmd {
	l.exercise.Blur()
	l.weight.Blur()
	l.reps.Blur()
	switch l.focus {
	case 0:
		return l.exercise.Focus()
	case 1:
		return l.weight.Focus()
	default:
		return l.reps.Focus()
	}
}

// tickRest advances the rest countdown one second (driven by the shell clock).
func (l Log) tickRest() Log {
	if l.rest.active && l.rest.remaining > 0 {
		l.rest.remaining--
		if l.rest.remaining <= 0 {
			l.rest.active = false
		}
	}
	return l
}

// Hints returns the mode-aware key hints for the shell footer.
func (l Log) Hints() string {
	if l.editing {
		return joinHints(hint("⏎", "세트추가"), hint("tab", "이동"), hint("esc", "나가기"))
	}
	return joinHints(hint("i", "입력"), hint("s", "저장"), hint("x", "삭제"), hint("1-5", "탭"), hint("q", "종료"))
}

// Body renders the pane content sized to w×h (embedded in the shell ViewPane).
func (l Log) Body(w, h int) string {
	var b strings.Builder
	b.WriteString(l.table())
	if l.rest.active {
		b.WriteString("\n\n" + l.restBar())
	}
	if l.editing {
		b.WriteString("\n\n" + l.entryBar())
	}
	if l.status != "" {
		tone := theme.Green
		if l.statusErr {
			tone = theme.Red
		}
		b.WriteString("\n\n" + lipgloss.NewStyle().Foreground(tone).Render(l.status))
	}
	return lipgloss.NewStyle().Width(w).Height(h).Padding(1, 1).Render(b.String())
}

func (l Log) table() string {
	rows := []string{tableRow(dim("SET"), dim("EXERCISE"), dim("WEIGHT"), dim("REPS"), dim("✓"))}
	if len(l.rows) == 0 {
		rows = append(rows, lipgloss.NewStyle().Foreground(theme.Ghost).Render("(세트 없음 — [i] 입력 시작)"))
	}
	for i, r := range l.rows {
		rows = append(rows, tableRow(
			lipgloss.NewStyle().Foreground(theme.Dim).Render(fmt.Sprintf("%02d", i+1)),
			lipgloss.NewStyle().Foreground(theme.Fg).Render(truncate(r.exercise, 14)),
			lipgloss.NewStyle().Foreground(theme.Cyan).Render(fmtKg(r.weight)),
			lipgloss.NewStyle().Foreground(theme.Fg).Render(strconv.Itoa(r.reps)),
			lipgloss.NewStyle().Foreground(theme.Green).Render(theme.GlyphDone),
		))
	}
	return strings.Join(rows, "\n")
}

func (l Log) restBar() string {
	const cells = 16
	frac := 0.0
	if l.rest.total > 0 {
		frac = float64(l.rest.remaining) / float64(l.rest.total)
	}
	if frac < 0 {
		frac = 0
	}
	filled := int(frac * cells)
	tone := theme.Green
	if frac < 0.5 {
		tone = theme.Amber
	}
	if frac < 0.2 {
		tone = theme.Red
	}
	gauge := lipgloss.NewStyle().Foreground(tone).Render(strings.Repeat("█", filled) + strings.Repeat("░", cells-filled))
	label := lipgloss.NewStyle().Foreground(theme.Dim).Render(fmt.Sprintf(" REST %ds  [r] skip", l.rest.remaining))
	return "▕" + gauge + "▏" + label
}

func (l Log) entryBar() string {
	field := func(label string, ti textinput.Model, focused bool) string {
		labelTone := theme.Dim
		if focused {
			labelTone = theme.Amber
		}
		return lipgloss.NewStyle().Foreground(labelTone).Render(label+" ") +
			lipgloss.NewStyle().Foreground(theme.Cyan).Render("["+ti.View()+"]")
	}
	return field("ex", l.exercise, l.focus == 0) + "  " +
		field("wt", l.weight, l.focus == 1) + "  " +
		field("reps", l.reps, l.focus == 2)
}

func summarizePRs(log *api.LogDetail) string {
	if log == nil {
		return theme.GlyphDone + " 저장됨"
	}
	if len(log.PersonalRecords) == 0 {
		return theme.GlyphDone + " 저장됨"
	}
	parts := make([]string, 0, len(log.PersonalRecords))
	for _, pr := range log.PersonalRecords {
		parts = append(parts, fmt.Sprintf("%s %s e1RM %.1f (+%.1f)",
			theme.GlyphPeak, pr.ExerciseName, float64(pr.EstOneRm), float64(pr.DeltaE1rm)))
	}
	return "[PR] " + strings.Join(parts, "   ")
}

// --- small render helpers ---

func tableRow(set, ex, wt, reps, done string) string {
	col := func(s string, n int) string { return lipgloss.NewStyle().Width(n).Render(s) }
	return col(set, 4) + col(ex, 16) + col(wt, 9) + col(reps, 6) + done
}

func dim(s string) string { return lipgloss.NewStyle().Foreground(theme.Dim).Render(s) }

func hint(k, label string) string {
	return lipgloss.NewStyle().Foreground(theme.Cyan).Render("["+k+"]") +
		lipgloss.NewStyle().Foreground(theme.Dim).Render(" "+label)
}

func joinHints(parts ...string) string { return strings.Join(parts, "  ") }

func fmtKg(w float64) string {
	if w == float64(int64(w)) {
		return strconv.FormatInt(int64(w), 10) + "kg"
	}
	return strconv.FormatFloat(w, 'f', 1, 64) + "kg"
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
