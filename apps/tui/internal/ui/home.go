package ui

import (
	"context"
	"fmt"
	"image/color"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

type homeLoadedMsg struct {
	data *api.HomeData
	err  error
}

func homeLoadCmd(c *api.Client) tea.Cmd {
	return func() tea.Msg {
		d, err := c.Home(context.Background(), "")
		return homeLoadedMsg{data: d, err: err}
	}
}

// Home is the glanceable dashboard (1:home): today, streak, volume, strength,
// recent — all read from a single /api/home call.
type Home struct {
	client *api.Client
	data   *api.HomeData
	err    string
	w, h   int
}

func NewHome(c *api.Client) Home { return Home{client: c} }

func (m Home) Init() tea.Cmd { return homeLoadCmd(m.client) }

func (m Home) Update(msg tea.Msg) (Screen, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.w, m.h = msg.Width, msg.Height
	case homeLoadedMsg:
		if msg.err != nil {
			m.err = humanizeAuthErr(msg.err)
		} else {
			m.data, m.err = msg.data, ""
		}
	case tea.KeyPressMsg:
		if msg.String() == "r" {
			m.data, m.err = nil, ""
			return m, homeLoadCmd(m.client)
		}
	}
	return m, nil
}

func (m Home) Mode() Mode {
	if m.data == nil && m.err == "" {
		return Mode{Label: "LOADING", Tone: theme.Cyan}
	}
	return ModeNormal
}

func (m Home) StatusRight() string {
	if m.data == nil {
		return ""
	}
	return fmt.Sprintf("streak %d", m.data.QuickStats.CurrentStreak)
}

func (m Home) Hints(int) string {
	return joinHints(hint("r", "새로고침"), hint("2", "로깅"), hint("1-5", "탭"))
}

func (m Home) Editing() bool { return false }

func (m Home) Body(w, h int) string {
	if m.err != "" {
		return centered(theme.GlyphFail+" "+m.err, theme.Red, w, h)
	}
	if m.data == nil {
		return centered("불러오는 중…", theme.Dim, w, h)
	}
	d := m.data
	rows := []string{
		hrow("▶ TODAY", lipgloss.NewStyle().Foreground(theme.Fg).Render(truncate(d.Today.ProgramName, w-12)), theme.Amber),
		hrow("", lipgloss.NewStyle().Foreground(theme.Dim).Render(truncate(d.Today.Meta, w-12)), theme.Dim),
		"",
		hrow("STREAK", lipgloss.NewStyle().Foreground(theme.Gold).Render(fmt.Sprintf("%d일", d.QuickStats.CurrentStreak))+"  "+m.weeklyStrip(), theme.Dim),
		hrow("VOLUME", m.volumeLine(), theme.Dim),
		hrow("STRENGTH", m.strengthLine(), theme.Dim),
		hrow("RECENT", m.recentLine(w), theme.Dim),
	}
	return lipgloss.NewStyle().Width(w).Height(h).Padding(1, 1).Render(strings.Join(rows, "\n"))
}

func (m Home) weeklyStrip() string {
	var b strings.Builder
	for _, d := range m.data.WeeklySummary.Days {
		switch {
		case d.IsToday:
			b.WriteString(lipgloss.NewStyle().Foreground(theme.Amber).Render("▮"))
		case d.HasWorkout:
			b.WriteString(lipgloss.NewStyle().Foreground(theme.Green).Render("█"))
		default:
			b.WriteString(lipgloss.NewStyle().Foreground(theme.Ghost).Render("·"))
		}
	}
	return b.String()
}

func (m Home) volumeLine() string {
	vt := m.data.VolumeTrend
	if len(vt) == 0 {
		return lipgloss.NewStyle().Foreground(theme.Ghost).Render("기록 없음")
	}
	vals := make([]float64, len(vt))
	for i, p := range vt {
		vals[i] = float64(p.Tonnage)
	}
	spark := lipgloss.NewStyle().Foreground(theme.Cyan).Render(sparkline(vals))
	last := vt[len(vt)-1]
	return spark + "  " + lipgloss.NewStyle().Foreground(theme.Dim).Render(fmt.Sprintf("최근 %.0fkg", float64(last.Tonnage)))
}

func (m Home) strengthLine() string {
	sp := m.data.StrengthProgress
	if len(sp) == 0 {
		return lipgloss.NewStyle().Foreground(theme.Ghost).Render("기록 없음")
	}
	var parts []string
	for _, s := range sp {
		if len(parts) >= 3 {
			break
		}
		arrow, tone := "→", theme.Dim
		switch s.Trend {
		case "up":
			arrow, tone = "↑", theme.Green
		case "down":
			arrow, tone = "↓", theme.Red
		}
		parts = append(parts,
			lipgloss.NewStyle().Foreground(theme.Fg).Render(shortLift(s.ExerciseName))+
				lipgloss.NewStyle().Foreground(theme.Gold).Render(fmt.Sprintf("%.0f", float64(s.BestE1rm)))+
				lipgloss.NewStyle().Foreground(tone).Render(arrow))
	}
	return strings.Join(parts, " ")
}

func (m Home) recentLine(w int) string {
	rs := m.data.RecentSessions
	if len(rs) == 0 {
		return lipgloss.NewStyle().Foreground(theme.Ghost).Render("없음")
	}
	r := rs[0]
	txt := r.Title
	if r.Subtitle != "" {
		txt += " · " + r.Subtitle
	}
	return lipgloss.NewStyle().Foreground(theme.Fg).Render(truncate(txt, w-12))
}

// --- shared dashboard helpers ---

func hrow(label, content string, labelTone color.Color) string {
	return lipgloss.NewStyle().Foreground(labelTone).Width(9).Render(label) + " " + content
}

func centered(text string, tone color.Color, w, h int) string {
	return lipgloss.Place(w, h, lipgloss.Center, lipgloss.Center,
		lipgloss.NewStyle().Foreground(tone).Render(text))
}

func sparkline(vals []float64) string {
	if len(vals) == 0 {
		return ""
	}
	max := 0.0
	for _, v := range vals {
		if v > max {
			max = v
		}
	}
	if max <= 0 {
		return strings.Repeat(string(theme.Blocks[0]), len(vals))
	}
	var b strings.Builder
	for _, v := range vals {
		idx := int(v/max*float64(len(theme.Blocks)-1) + 0.5)
		if idx < 0 {
			idx = 0
		}
		if idx >= len(theme.Blocks) {
			idx = len(theme.Blocks) - 1
		}
		b.WriteRune(theme.Blocks[idx])
	}
	return b.String()
}

func shortLift(name string) string {
	n := strings.ToLower(name)
	switch {
	case strings.Contains(n, "squat"):
		return "SQ"
	case strings.Contains(n, "bench"):
		return "BN"
	case strings.Contains(n, "dead"):
		return "DL"
	case strings.Contains(n, "over") && strings.Contains(n, "press"):
		return "OHP"
	case strings.Contains(n, "press"):
		return "PR"
	case strings.Contains(n, "row"):
		return "ROW"
	case strings.Contains(n, "pull"):
		return "PL"
	}
	return strings.ToUpper(truncate(name, 3))
}
