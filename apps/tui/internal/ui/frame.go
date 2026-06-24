package ui

import (
	"image/color"
	"strings"
	"time"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

// ViewKind identifies a buffer. There is no tab bar; views are switched via the
// space-leader goto menu, the `:` command line, or 1-5 accelerators.
type ViewKind int

const (
	vToday ViewKind = iota
	vStats
	vHistory
	vPrograms
	vSettings
)

var viewMeta = map[ViewKind]struct{ key, name string }{
	vToday:    {"t", "today"},
	vStats:    {"s", "stats"},
	vHistory:  {"h", "history"},
	vPrograms: {"p", "programs"},
	vSettings: {",", "settings"},
}

var gotoOrder = []ViewKind{vToday, vStats, vHistory, vPrograms, vSettings}

// Mode is the statusline mode label and its tone color.
type Mode struct {
	Label string
	Tone  color.Color
}

// ModeNormal is the idle auto-label.
var ModeNormal = Mode{Label: "NORMAL", Tone: theme.Dim}

type tickMsg time.Time

func tick() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}

type overlayKind int

const (
	overlayNone overlayKind = iota
	overlayGoto
	overlayCmd
)

// Frame is the root chrome: a pure buffer area, a bottom region (hint line,
// command line, or the goto menu), and a statusline. No tab bar, no top chrome.
type Frame struct {
	client  *api.Client
	views   map[ViewKind]Screen
	active  ViewKind
	seen    map[ViewKind]bool
	w, h    int
	now     time.Time
	overlay overlayKind
	gotoSel int
	cmd     textinput.Model
	flash   string
}

// NewFrame builds the frame booted into the today (workout) buffer.
func NewFrame(client *api.Client) Frame {
	return Frame{
		client: client,
		now:    time.Now(),
		active: vToday,
		views: map[ViewKind]Screen{
			vToday:    NewLog(client),
			vStats:    placeholder{name: "stats"},
			vHistory:  placeholder{name: "history"},
			vPrograms: placeholder{name: "programs"},
			vSettings: placeholder{name: "settings"},
		},
		seen: map[ViewKind]bool{vToday: true},
	}
}

func (f Frame) Init() tea.Cmd {
	return tea.Batch(tick(), f.views[f.active].Init())
}

func (f Frame) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		f.w, f.h = msg.Width, msg.Height
		for k, v := range f.views {
			nv, _ := v.Update(msg)
			f.views[k] = nv
		}
		return f, nil
	case tickMsg:
		f.now = time.Time(msg)
		nv, cmd := f.views[f.active].Update(msg)
		f.views[f.active] = nv
		return f, tea.Batch(tick(), cmd)
	case tea.KeyPressMsg:
		return f.handleKey(msg)
	}
	nv, cmd := f.views[f.active].Update(msg)
	f.views[f.active] = nv
	return f, cmd
}

func (f Frame) handleKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	if msg.String() == "ctrl+c" {
		return f, tea.Quit
	}
	switch f.overlay {
	case overlayCmd:
		return f.handleCmdKey(msg)
	case overlayGoto:
		return f.handleGotoKey(msg)
	}
	// A view in INSERT/editing owns every key (digits, space in names, …).
	if f.views[f.active].Editing() {
		return f.routeKey(msg)
	}
	switch msg.String() {
	case " ":
		f.overlay = overlayGoto
		f.gotoSel = int(f.active)
		f.flash = ""
		return f, nil
	case ":":
		ti := textinput.New()
		ti.Prompt = ""
		ti.SetVirtualCursor(true)
		f.cmd = ti
		f.overlay = overlayCmd
		f.flash = ""
		return f, f.cmd.Focus()
	case "q":
		return f, tea.Quit
	case "1", "2", "3", "4", "5":
		if idx := int(msg.String()[0] - '1'); idx >= 0 && idx < len(gotoOrder) {
			return f.switchTo(gotoOrder[idx])
		}
	}
	return f.routeKey(msg)
}

func (f Frame) routeKey(msg tea.Msg) (tea.Model, tea.Cmd) {
	nv, cmd := f.views[f.active].Update(msg)
	f.views[f.active] = nv
	return f, cmd
}

func (f Frame) handleGotoKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc", " ":
		f.overlay = overlayNone
		return f, nil
	case "j", "down":
		if f.gotoSel < len(gotoOrder)-1 {
			f.gotoSel++
		}
		return f, nil
	case "k", "up":
		if f.gotoSel > 0 {
			f.gotoSel--
		}
		return f, nil
	case "enter":
		f.overlay = overlayNone
		return f.switchTo(gotoOrder[f.gotoSel])
	}
	for _, vk := range gotoOrder {
		if viewMeta[vk].key == msg.String() {
			f.overlay = overlayNone
			return f.switchTo(vk)
		}
	}
	return f, nil
}

func (f Frame) handleCmdKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		f.overlay = overlayNone
		return f, nil
	case "enter":
		cmd := strings.TrimSpace(f.cmd.Value())
		f.overlay = overlayNone
		return f.runCommand(cmd)
	}
	var cmd tea.Cmd
	f.cmd, cmd = f.cmd.Update(msg)
	return f, cmd
}

func (f Frame) runCommand(cmd string) (tea.Model, tea.Cmd) {
	word := cmd
	if i := strings.IndexByte(cmd, ' '); i >= 0 {
		word = cmd[:i]
	}
	switch word {
	case "":
		return f, nil
	case "q", "quit":
		return f, tea.Quit
	case "t", "today":
		return f.switchTo(vToday)
	case "s", "stats":
		return f.switchTo(vStats)
	case "h", "hist", "history", "cal":
		return f.switchTo(vHistory)
	case "p", "plan", "plans", "programs":
		return f.switchTo(vPrograms)
	case ",", "set", "settings":
		return f.switchTo(vSettings)
	}
	f.flash = "알 수 없는 명령: " + word
	return f, nil
}

func (f Frame) switchTo(vk ViewKind) (tea.Model, tea.Cmd) {
	f.active = vk
	f.flash = ""
	if !f.seen[vk] {
		f.seen[vk] = true
		return f, f.views[vk].Init()
	}
	return f, nil
}

// View renders the frame: buffer · region · statusline.
func (f Frame) View() tea.View {
	w := f.w
	if w <= 0 {
		w = 40
	}
	h := f.h
	if h <= 0 {
		h = 24
	}
	s := f.views[f.active]

	region, regionH := f.region(w, s)
	bodyH := h - regionH - 1 // 1 = statusline
	if bodyH < 1 {
		bodyH = 1
	}

	content := lipgloss.JoinVertical(
		lipgloss.Left,
		s.Body(w, bodyH),
		region,
		fitLine(f.statusline(w, s), w),
	)

	v := tea.NewView(content)
	v.BackgroundColor = theme.Bg
	v.AltScreen = true
	return v
}

func (f Frame) statusline(w int, s Screen) string {
	seg := lipgloss.NewStyle().Background(s.Mode().Tone).Foreground(theme.Bg).Bold(true).Render(" " + s.Mode().Label + " ")

	var left string
	if f.flash != "" {
		left = seg + " " + lipgloss.NewStyle().Foreground(theme.Red).Render(f.flash)
	} else {
		left = seg + " " + lipgloss.NewStyle().Foreground(theme.Dim).Render(viewMeta[f.active].name)
		if ctx := s.Context(); ctx != "" {
			left += lipgloss.NewStyle().Foreground(theme.Dim).Render(" · ") +
				lipgloss.NewStyle().Foreground(theme.Fg).Render(ctx)
		}
	}

	right := ""
	if r := s.StatusRight(); r != "" {
		right = lipgloss.NewStyle().Foreground(theme.Dim).Render(r) + "  "
	}
	right += lipgloss.NewStyle().Foreground(theme.Dim).Render(f.now.Format("15:04"))
	return justify(left, right, w)
}

func (f Frame) region(w int, s Screen) (string, int) {
	switch f.overlay {
	case overlayCmd:
		return lipgloss.NewStyle().Foreground(theme.Cyan).Bold(true).Render(":") + f.cmd.View(), 1
	case overlayGoto:
		return f.gotoMenu(), len(gotoOrder) + 1
	default:
		globals := lipgloss.NewStyle().Foreground(theme.Dim).Render("   ") + hint("space", "이동") + "  " + hint(":", "명령")
		return fitLine(s.Hints(w)+globals, w), 1
	}
}

func (f Frame) gotoMenu() string {
	lines := []string{lipgloss.NewStyle().Foreground(theme.Amber).Bold(true).Render("이동")}
	for i, vk := range gotoOrder {
		m := viewMeta[vk]
		key := lipgloss.NewStyle().Foreground(theme.Cyan).Bold(true).Render(m.key)
		if i == f.gotoSel {
			lines = append(lines, lipgloss.NewStyle().Foreground(theme.Amber).Render("› ")+key+"  "+
				lipgloss.NewStyle().Foreground(theme.Fg).Bold(true).Render(m.name))
		} else {
			lines = append(lines, "  "+key+"  "+lipgloss.NewStyle().Foreground(theme.Dim).Render(m.name))
		}
	}
	return strings.Join(lines, "\n")
}

// justify places left and right text on one line padded to width w.
func justify(left, right string, w int) string {
	gap := w - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + right
}

// fitLine hard-caps a line to w display columns (CJK-aware).
func fitLine(s string, w int) string {
	if lipgloss.Width(s) <= w {
		return s
	}
	return ansi.Truncate(s, w, "")
}
