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

// Shell is the persistent top-level chrome that hosts swappable screens.
type Shell struct {
	width   int
	height  int
	now     time.Time
	active  Tab
	client  *api.Client
	screens map[Tab]Screen
	seen    map[Tab]bool
}

// NewShell builds the shell with the log tab focused by default.
func NewShell(client *api.Client) Shell {
	return Shell{
		active: TabLog,
		now:    time.Now(),
		client: client,
		screens: map[Tab]Screen{
			TabHome:     NewHome(client),
			TabLog:      NewLog(client),
			TabStats:    placeholder{name: "stats"},
			TabCal:      placeholder{name: "cal"},
			TabSettings: placeholder{name: "set"},
		},
		seen: map[Tab]bool{TabLog: true},
	}
}

type tickMsg time.Time

func tick() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}

// Init starts the clock tick and the initial screen's load.
func (m Shell) Init() tea.Cmd {
	return tea.Batch(tick(), m.screens[m.active].Init())
}

func (m Shell) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		for t, s := range m.screens {
			ns, _ := s.Update(msg)
			m.screens[t] = ns
		}
		return m, nil
	case tickMsg:
		m.now = time.Time(msg)
		ns, cmd := m.screens[m.active].Update(msg)
		m.screens[m.active] = ns
		return m, tea.Batch(tick(), cmd)
	case tea.KeyPressMsg:
		// In an editing/INSERT screen, every key belongs to that screen.
		if m.screens[m.active].Editing() {
			return m.route(msg)
		}
		switch msg.String() {
		case "q":
			return m, tea.Quit
		case "1":
			return m.activate(TabHome)
		case "2":
			return m.activate(TabLog)
		case "3":
			return m.activate(TabStats)
		case "4":
			return m.activate(TabCal)
		case "5":
			return m.activate(TabSettings)
		}
		return m.route(msg)
	}
	return m.route(msg)
}

// route forwards a message to the active screen and stores the result.
func (m Shell) route(msg tea.Msg) (tea.Model, tea.Cmd) {
	ns, cmd := m.screens[m.active].Update(msg)
	m.screens[m.active] = ns
	return m, cmd
}

// activate switches tabs, dispatching the screen's Init the first time it is
// shown (lazy data load).
func (m Shell) activate(t Tab) (tea.Model, tea.Cmd) {
	m.active = t
	if !m.seen[t] {
		m.seen[t] = true
		return m, m.screens[t].Init()
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

	const chromeRows = 3 // top bar + status + hints
	bodyH := h - chromeRows
	if bodyH < 1 {
		bodyH = 1
	}

	s := m.screens[m.active]
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		fitLine(m.topBar(w), w),
		s.Body(w, bodyH),
		fitLine(m.statusBar(w, s.Mode(), s.StatusRight()), w),
		fitLine(s.Hints(w), w),
	)

	v := tea.NewView(content)
	v.BackgroundColor = theme.Bg
	v.AltScreen = true
	return v
}

// topBar is the single header line: tab segments (active inverted, tmux-style)
// with the app name on wide terminals and a HH:MM clock on the right.
func (m Shell) topBar(w int) string {
	tabs := make([]string, len(tabMeta))
	for i, t := range tabMeta {
		if Tab(i) == m.active {
			tabs[i] = lipgloss.NewStyle().Background(theme.Amber).Foreground(theme.Bg).Bold(true).Render(" " + t.name + " ")
		} else {
			tabs[i] = lipgloss.NewStyle().Foreground(theme.Dim).Render(t.name)
		}
	}
	left := strings.Join(tabs, "  ")
	if w >= 52 {
		left = lipgloss.NewStyle().Foreground(theme.Amber).Bold(true).Render("ironlog") + "   " + left
	}
	clock := lipgloss.NewStyle().Foreground(theme.Dim).Render(m.now.Format("15:04"))
	return justify(left, clock, w)
}

// statusBar shows a filled mode segment (airline-style) and right-aligned
// screen context.
func (m Shell) statusBar(w int, mode Mode, right string) string {
	seg := lipgloss.NewStyle().Background(mode.Tone).Foreground(theme.Bg).Bold(true).Render(" " + mode.Label + " ")
	rightText := lipgloss.NewStyle().Foreground(theme.Dim).Render(right)
	return justify(seg, rightText, w)
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
