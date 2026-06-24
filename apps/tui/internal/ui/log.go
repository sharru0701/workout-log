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

type logCol int

const (
	colExercise logCol = iota
	colWeight
	colReps
)

type logRow struct {
	exercise string
	weight   string // kept as text for inline editing
	reps     string
	done     bool
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

func saveCmd(c *api.Client, sets []api.WorkoutSet) tea.Cmd {
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

// Log is the hero workout-logging view (2:log): a spreadsheet-style focus-chain
// table. Navigate rows (j/k) and cells (h/l) in NORMAL; edit a cell inline in
// INSERT. Completing a set arms the rest gauge and drops a fresh row.
type Log struct {
	client    *api.Client
	rows      []logRow
	row       int
	col       logCol
	editing   bool
	edit      textinput.Model
	rest      restState
	saving    bool
	status    string
	statusErr bool
	w, h      int
}

func NewLog(client *api.Client) Log {
	return Log{client: client, rows: []logRow{{}}}
}

// Editing reports whether a cell is being edited (so the shell hands every key
// to this view instead of treating digits as tab switches).
func (l Log) Editing() bool { return l.editing }

func (l Log) Mode() Mode {
	switch {
	case l.rest.active:
		return Mode{Label: fmt.Sprintf("REST %ds", l.rest.remaining), Tone: theme.Cyan}
	case l.saving:
		return Mode{Label: "SAVING", Tone: theme.Amber}
	case l.editing:
		return Mode{Label: "INSERT", Tone: theme.Amber}
	default:
		return ModeNormal
	}
}

func (l Log) StatusRight() string {
	done := 0
	for _, r := range l.rows {
		if r.done {
			done++
		}
	}
	if done == 0 {
		return ""
	}
	return fmt.Sprintf("%d set%s", done, plural(done))
}

func (l Log) Hints(w int) string {
	if l.editing {
		return joinHints(hint("⏎", "완료"), hint("tab", "셀"), hint("esc", "취소"))
	}
	if w < 46 {
		return joinHints(hint("i", "편집"), hint("⎵", "완료"), hint("s", "저장"))
	}
	return joinHints(hint("i", "편집"), hint("⎵", "완료"), hint("o", "행"), hint("s", "저장"), hint("hjkl", "이동"))
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
		l.rows = []logRow{{}}
		l.row, l.col = 0, colExercise
		return l, nil
	case tea.KeyPressMsg:
		if l.editing {
			return l.updateEditing(m)
		}
		return l.updateNormal(m)
	}
	if l.editing {
		var cmd tea.Cmd
		l.edit, cmd = l.edit.Update(msg)
		return l, cmd
	}
	return l, nil
}

func (l Log) updateNormal(m tea.KeyPressMsg) (Log, tea.Cmd) {
	switch m.String() {
	case "j", "down":
		if l.row < len(l.rows)-1 {
			l.row++
		}
	case "k", "up":
		if l.row > 0 {
			l.row--
		}
	case "h", "left":
		if l.col > colExercise {
			l.col--
		}
	case "l", "right":
		if l.col < colReps {
			l.col++
		}
	case "i", "enter":
		return l.beginEdit()
	case " ":
		return l.toggleDone()
	case "o":
		return l.addRow(), nil
	case "d":
		return l.deleteRow(), nil
	case "s":
		return l.save()
	case "r":
		l.rest.active = false
	}
	return l, nil
}

func (l Log) updateEditing(m tea.KeyPressMsg) (Log, tea.Cmd) {
	switch m.String() {
	case "esc":
		l.editing = false
		return l, nil
	case "enter":
		l.writeCell()
		l.editing = false
		if l.col == colReps {
			return l.completeRow()
		}
		l.col++
		return l.beginEdit()
	case "tab":
		l.writeCell()
		l.editing = false
		if l.col < colReps {
			l.col++
		} else {
			l.col = colExercise
		}
		return l.beginEdit()
	}
	var cmd tea.Cmd
	l.edit, cmd = l.edit.Update(m)
	return l, cmd
}

func (l Log) beginEdit() (Log, tea.Cmd) {
	ti := textinput.New()
	ti.Prompt = ""
	ti.SetVirtualCursor(true)
	r := l.rows[l.row]
	switch l.col {
	case colExercise:
		ti.SetWidth(13)
		ti.SetValue(r.exercise)
	case colWeight:
		ti.SetWidth(7)
		ti.SetValue(r.weight)
	case colReps:
		ti.SetWidth(4)
		ti.SetValue(r.reps)
	}
	l.edit = ti
	l.editing = true
	return l, l.edit.Focus()
}

func (l *Log) writeCell() {
	v := strings.TrimSpace(l.edit.Value())
	switch l.col {
	case colExercise:
		l.rows[l.row].exercise = v
	case colWeight:
		l.rows[l.row].weight = v
	case colReps:
		l.rows[l.row].reps = v
	}
}

func (l Log) completeRow() (Log, tea.Cmd) {
	r := l.rows[l.row]
	if strings.TrimSpace(r.exercise) == "" || !validNum(r.weight) || !validInt(r.reps) {
		l.status = "운동·무게·reps를 정확히 입력하세요"
		l.statusErr = true
		return l, nil
	}
	l.rows[l.row].done = true
	l.status, l.statusErr = "", false
	l.rest = restState{active: true, remaining: defaultRestSeconds, total: defaultRestSeconds}
	l.rows = append(l.rows, logRow{exercise: r.exercise})
	l.row = len(l.rows) - 1
	l.col = colWeight
	return l.beginEdit()
}

func (l Log) toggleDone() (Log, tea.Cmd) {
	if l.rows[l.row].done {
		l.rows[l.row].done = false
		return l, nil
	}
	r := l.rows[l.row]
	if strings.TrimSpace(r.exercise) == "" || !validNum(r.weight) || !validInt(r.reps) {
		l.status = "완료하려면 운동·무게·reps가 필요합니다"
		l.statusErr = true
		return l, nil
	}
	l.rows[l.row].done = true
	l.status, l.statusErr = "", false
	l.rest = restState{active: true, remaining: defaultRestSeconds, total: defaultRestSeconds}
	return l, nil
}

func (l Log) addRow() Log {
	ex := l.rows[l.row].exercise
	at := l.row + 1
	rows := make([]logRow, 0, len(l.rows)+1)
	rows = append(rows, l.rows[:at]...)
	rows = append(rows, logRow{exercise: ex})
	rows = append(rows, l.rows[at:]...)
	l.rows = rows
	l.row, l.col = at, colWeight
	return l
}

func (l Log) deleteRow() Log {
	if len(l.rows) <= 1 {
		l.rows = []logRow{{}}
		l.row, l.col = 0, colExercise
		return l
	}
	rows := make([]logRow, 0, len(l.rows)-1)
	rows = append(rows, l.rows[:l.row]...)
	rows = append(rows, l.rows[l.row+1:]...)
	l.rows = rows
	if l.row >= len(l.rows) {
		l.row = len(l.rows) - 1
	}
	return l
}

func (l Log) save() (Log, tea.Cmd) {
	if l.saving {
		return l, nil
	}
	var sets []api.WorkoutSet
	for _, r := range l.rows {
		if !r.done {
			continue
		}
		w, _ := strconv.ParseFloat(r.weight, 64)
		reps, _ := strconv.Atoi(r.reps)
		sets = append(sets, api.WorkoutSet{ExerciseName: strings.TrimSpace(r.exercise), WeightKg: w, Reps: reps})
	}
	if len(sets) == 0 {
		l.status = "완료된 세트가 없습니다 ([space]로 완료)"
		l.statusErr = true
		return l, nil
	}
	l.saving = true
	l.status, l.statusErr = "", false
	return l, saveCmd(l.client, sets)
}

func (l Log) tickRest() Log {
	if l.rest.active && l.rest.remaining > 0 {
		l.rest.remaining--
		if l.rest.remaining <= 0 {
			l.rest.active = false
		}
	}
	return l
}

// --- rendering ---

func (l Log) Body(w, h int) string {
	var b strings.Builder
	b.WriteString(l.renderTable(w))
	if l.rest.active {
		b.WriteString("\n\n" + l.restBar(w))
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

func (l Log) renderTable(w int) string {
	showE1rm := w >= 46
	exW := 13
	if !showE1rm {
		exW = 15
	}
	lines := []string{l.tableHeader(exW, showE1rm)}
	prevEx := ""
	for i, r := range l.rows {
		lines = append(lines, l.tableRow(i, r, prevEx, exW, showE1rm))
		prevEx = r.exercise
	}
	return strings.Join(lines, "\n")
}

func (l Log) tableHeader(exW int, showE1rm bool) string {
	d := lipgloss.NewStyle().Foreground(theme.Dim)
	cells := []string{
		d.Width(3).Render("#"),
		d.Width(exW).Render("EXERCISE"),
		d.Width(7).Render("WEIGHT"),
		d.Width(4).Render("REPS"),
	}
	if showE1rm {
		cells = append(cells, d.Width(5).Render("e1RM"))
	}
	cells = append(cells, d.Render("✓"))
	return "  " + strings.Join(cells, " ")
}

func (l Log) tableRow(i int, r logRow, prevEx string, exW int, showE1rm bool) string {
	marker := "  "
	if i == l.row {
		marker = lipgloss.NewStyle().Foreground(theme.Amber).Render("▸ ")
	}

	idx := lipgloss.NewStyle().Foreground(theme.Dim).Width(3).Render(fmt.Sprintf("%02d", i+1))

	exText, exStyle := r.exercise, lipgloss.NewStyle().Foreground(theme.Fg)
	if r.exercise == "" {
		exText, exStyle = "운동?", lipgloss.NewStyle().Foreground(theme.Ghost)
	} else if r.exercise == prevEx {
		exText, exStyle = "〃", lipgloss.NewStyle().Foreground(theme.Ghost)
	}
	ex := l.cell(i, colExercise, exText, exW, exStyle)

	wt := l.cell(i, colWeight, orDot(r.weight), 7, lipgloss.NewStyle().Foreground(theme.Cyan))
	rp := l.cell(i, colReps, orDot(r.reps), 4, lipgloss.NewStyle().Foreground(theme.Fg))

	cells := []string{idx, ex, wt, rp}
	if showE1rm {
		e := ""
		if v := rowE1rm(r); v > 0 {
			e = fmt.Sprintf("%.0f", v)
		}
		cells = append(cells, lipgloss.NewStyle().Foreground(theme.Dim).Width(5).Render(e))
	}
	mark := lipgloss.NewStyle().Foreground(theme.Ghost).Render("·")
	if r.done {
		mark = lipgloss.NewStyle().Foreground(theme.Green).Render(theme.GlyphDone)
	}
	cells = append(cells, mark)

	return marker + strings.Join(cells, " ")
}

// cell renders one table cell, showing the inline editor when it is the active
// cell in INSERT, an amber highlight when active in NORMAL, else plain.
func (l Log) cell(i int, c logCol, text string, width int, base lipgloss.Style) string {
	active := i == l.row && c == l.col
	if active && l.editing {
		return l.edit.View()
	}
	if active {
		return lipgloss.NewStyle().Foreground(theme.Amber).Width(width).Render(truncate(text, width))
	}
	return base.Width(width).Render(truncate(text, width))
}

func (l Log) restBar(w int) string {
	cells := 16
	if w < 44 {
		cells = 12
	}
	frac := 0.0
	if l.rest.total > 0 {
		frac = float64(l.rest.remaining) / float64(l.rest.total)
	}
	if frac < 0 {
		frac = 0
	}
	filled := int(frac * float64(cells))
	tone := theme.Green
	if frac < 0.5 {
		tone = theme.Amber
	}
	if frac < 0.2 {
		tone = theme.Red
	}
	gauge := lipgloss.NewStyle().Foreground(tone).Render(strings.Repeat("█", filled) + strings.Repeat("░", cells-filled))
	label := lipgloss.NewStyle().Foreground(theme.Dim).Render(fmt.Sprintf(" rest %d:%02d  [r]skip", l.rest.remaining/60, l.rest.remaining%60))
	return "▕" + gauge + "▏" + label
}

func summarizePRs(log *api.LogDetail) string {
	if log == nil || len(log.PersonalRecords) == 0 {
		return theme.GlyphDone + " 저장됨"
	}
	parts := make([]string, 0, len(log.PersonalRecords))
	for _, pr := range log.PersonalRecords {
		parts = append(parts, fmt.Sprintf("%s %s e1RM %.1f (+%.1f)",
			theme.GlyphPeak, pr.ExerciseName, float64(pr.EstOneRm), float64(pr.DeltaE1rm)))
	}
	return "[PR] " + strings.Join(parts, "   ")
}

// --- helpers ---

func orDot(s string) string {
	if strings.TrimSpace(s) == "" {
		return "·"
	}
	return s
}

func rowE1rm(r logRow) float64 {
	w, err1 := strconv.ParseFloat(strings.TrimSpace(r.weight), 64)
	reps, err2 := strconv.Atoi(strings.TrimSpace(r.reps))
	if err1 != nil || err2 != nil || reps <= 0 {
		return 0
	}
	return w * (1 + float64(reps)/30.0) // Epley estimate (display only)
}

func validNum(s string) bool {
	v, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return err == nil && v >= 0
}

func validInt(s string) bool {
	v, err := strconv.Atoi(strings.TrimSpace(s))
	return err == nil && v > 0
}

func dim(s string) string { return lipgloss.NewStyle().Foreground(theme.Dim).Render(s) }

func hint(k, label string) string {
	return lipgloss.NewStyle().Foreground(theme.Cyan).Render("["+k+"]") +
		lipgloss.NewStyle().Foreground(theme.Dim).Render(label)
}

func joinHints(parts ...string) string { return strings.Join(parts, "  ") }

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	if n <= 1 {
		return string(r[:n])
	}
	return string(r[:n-1]) + "…"
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
