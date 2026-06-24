// Package ui implements the ironlog terminal shell and views.
package ui

import (
	"image/color"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

// Tab identifies a top-level view.
type Tab int

const (
	TabHome Tab = iota
	TabLog
	TabStats
	TabCal
	TabSettings
)

var tabMeta = []struct {
	key  string
	name string
}{
	{"1", "home"},
	{"2", "log"},
	{"3", "stats"},
	{"4", "cal"},
	{"5", "set"},
}

// Mode is the status-bar label and its tone color (idle/logging/rest/...).
type Mode struct {
	Label string
	Tone  color.Color
}

// ModeNormal is the idle auto-label (NORMAL is a state label, not a vim mode).
var ModeNormal = Mode{Label: "NORMAL", Tone: theme.Dim}

// Shell is the persistent top-level chrome that hosts swappable view panes.
type Shell struct {
	width  int
	height int
	now    time.Time
	active Tab
	client *api.Client
	log    Log
}

// NewShell builds the shell with the log tab focused by default.
func NewShell(client *api.Client) Shell {
	return Shell{active: TabLog, now: time.Now(), client: client, log: NewLog(client)}
}

type tickMsg time.Time

func tick() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}

// Init starts the 1s clock tick (also drives the rest countdown).
func (m Shell) Init() tea.Cmd { return tick() }

func (m Shell) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		var cmd tea.Cmd
		m.log, cmd = m.log.Update(msg)
		return m, cmd
	case tickMsg:
		m.now = time.Time(msg)
		m.log = m.log.tickRest()
		return m, tick()
	case tea.KeyPressMsg:
		// In INSERT mode the log view owns every key (so digits edit fields
		// rather than switching tabs).
		if m.active == TabLog && m.log.Editing() {
			var cmd tea.Cmd
			m.log, cmd = m.log.Update(msg)
			return m, cmd
		}
		switch msg.String() {
		case "q":
			return m, tea.Quit
		case "1":
			m.active = TabHome
			return m, nil
		case "2":
			m.active = TabLog
			return m, nil
		case "3":
			m.active = TabStats
			return m, nil
		case "4":
			m.active = TabCal
			return m, nil
		case "5":
			m.active = TabSettings
			return m, nil
		}
		if m.active == TabLog {
			var cmd tea.Cmd
			m.log, cmd = m.log.Update(msg)
			return m, cmd
		}
		return m, nil
	}

	// other messages (save result, cursor blink, …) → active view
	if m.active == TabLog {
		var cmd tea.Cmd
		m.log, cmd = m.log.Update(msg)
		return m, cmd
	}
	return m, nil
}

// View renders the full shell: title · tabs · pane · status · hints.
func (m Shell) View() tea.View {
	w := m.width
	if w <= 0 {
		w = 36
	}
	h := m.height
	if h <= 0 {
		h = 24
	}

	const chromeRows = 4 // title + tabs + status + hints
	bodyH := h - chromeRows
	if bodyH < 1 {
		bodyH = 1
	}

	mode, right := m.statusContext()
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		fitLine(m.titleBar(w), w),
		fitLine(m.tabStrip(), w),
		m.paneBody(w, bodyH),
		fitLine(m.statusBar(w, mode, right), w),
		fitLine(m.keyHint(w), w),
	)

	v := tea.NewView(content)
	v.BackgroundColor = theme.Bg
	v.AltScreen = true
	return v
}

func (m Shell) statusContext() (Mode, string) {
	if m.active == TabLog {
		return m.log.Mode(), m.log.StatusRight()
	}
	return ModeNormal, ""
}

func (m Shell) paneBody(w, h int) string {
	if m.active == TabLog {
		return m.log.Body(w, h)
	}
	heading := lipgloss.NewStyle().Foreground(theme.Fg).Bold(true).
		Render("  " + strings.ToUpper(tabMeta[m.active].name))
	sub := lipgloss.NewStyle().Foreground(theme.Ghost).Render("  (곧 제공 — post-MVP)")
	body := "\n" + heading + "\n\n" + sub
	return lipgloss.NewStyle().Width(w).Height(h).Render(body)
}

func (m Shell) titleBar(w int) string {
	dot := func(c color.Color) string { return lipgloss.NewStyle().Foreground(c).Render("●") }
	dots := dot(theme.Red) + " " + dot(theme.Amber) + " " + dot(theme.Green)
	name := lipgloss.NewStyle().Foreground(theme.Amber).Bold(true).Render("ironlog")
	path := lipgloss.NewStyle().Foreground(theme.Dim).Render(" · " + tabMeta[m.active].name)
	clock := lipgloss.NewStyle().Foreground(theme.Dim).Render(m.now.Format("15:04:05"))
	return justify(dots+"  "+name+path, clock, w)
}

func (m Shell) tabStrip() string {
	parts := make([]string, len(tabMeta))
	for i, t := range tabMeta {
		key := lipgloss.NewStyle().Foreground(theme.Cyan).Render(t.key)
		nameStyle := lipgloss.NewStyle().Foreground(theme.Dim)
		marker := " "
		if Tab(i) == m.active {
			nameStyle = lipgloss.NewStyle().Foreground(theme.Amber).Bold(true)
			marker = lipgloss.NewStyle().Foreground(theme.Amber).Render("*")
		}
		parts[i] = key + ":" + nameStyle.Render(t.name) + marker
	}
	return strings.Join(parts, " ")
}

func (m Shell) statusBar(w int, mode Mode, right string) string {
	pill := lipgloss.NewStyle().Foreground(mode.Tone).Bold(true).Render("-- " + mode.Label + " --")
	rightText := lipgloss.NewStyle().Foreground(theme.Dim).Render(right)
	return justify(pill, rightText, w)
}

func (m Shell) keyHint(w int) string {
	if m.active == TabLog {
		return m.log.Hints(w)
	}
	return joinHints(hint("1-5", "탭"), hint("?", "help"), hint("q", "종료"))
}

// justify places left and right text on one line padded to width w.
func justify(left, right string, w int) string {
	gap := w - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + right
}

// fitLine hard-caps a line to w display columns (CJK-aware) so no chrome line
// ever overflows a narrow terminal and forces a wrap.
func fitLine(s string, w int) string {
	if lipgloss.Width(s) <= w {
		return s
	}
	return ansi.Truncate(s, w, "")
}
