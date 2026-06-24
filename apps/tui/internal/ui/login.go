package ui

import (
	"strings"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

// Login is the email/password sign-in view.
type Login struct {
	email      textinput.Model
	password   textinput.Model
	client     *api.Client
	focus      int // 0 email, 1 password
	submitting bool
	err        string
	w, h       int
}

// NewLogin builds the form. client may be nil in tests (submission is gated by
// the Enter key, which the tests do not exercise).
func NewLogin(client *api.Client) Login {
	email := textinput.New()
	email.Placeholder = "you@example.com"
	email.Prompt = ""
	email.SetVirtualCursor(true)
	email.SetWidth(28)
	email.Focus()

	pw := textinput.New()
	pw.Placeholder = "••••••••"
	pw.Prompt = ""
	pw.EchoMode = textinput.EchoPassword
	pw.EchoCharacter = '•'
	pw.SetVirtualCursor(true)
	pw.SetWidth(28)

	return Login{email: email, password: pw, client: client}
}

// Init starts the focused field's cursor.
func (l Login) Init() tea.Cmd { return l.email.Focus() }

func (l Login) Update(msg tea.Msg) (Login, tea.Cmd) {
	switch m := msg.(type) {
	case tea.WindowSizeMsg:
		l.w, l.h = m.Width, m.Height
		return l, nil
	case tea.KeyPressMsg:
		switch m.String() {
		case "tab", "down", "shift+tab", "up":
			l.focus = (l.focus + 1) % 2
			return l, l.refocus()
		case "enter":
			return l.submit()
		}
	}

	var cmd tea.Cmd
	if l.focus == 0 {
		l.email, cmd = l.email.Update(msg)
	} else {
		l.password, cmd = l.password.Update(msg)
	}
	return l, cmd
}

func (l Login) submit() (Login, tea.Cmd) {
	if l.submitting {
		return l, nil
	}
	email := strings.TrimSpace(l.email.Value())
	pw := l.password.Value()
	if email == "" || pw == "" {
		l.err = "이메일과 비밀번호를 입력하세요"
		return l, nil
	}
	l.submitting = true
	l.err = ""
	return l, loginCmd(l.client, email, pw)
}

func (l *Login) refocus() tea.Cmd {
	if l.focus == 0 {
		l.password.Blur()
		return l.email.Focus()
	}
	l.email.Blur()
	return l.password.Focus()
}

// withError clears the in-flight state and shows a humanized message.
func (l Login) withError(err error) Login {
	l.submitting = false
	l.err = humanizeAuthErr(err)
	return l
}

func humanizeAuthErr(err error) string {
	switch {
	case err == nil:
		return ""
	case api.IsUnauthorized(err):
		return "이메일 또는 비밀번호가 올바르지 않습니다"
	case api.IsRateLimited(err):
		return "요청이 너무 많습니다. 잠시 후 다시 시도하세요"
	default:
		return err.Error()
	}
}

func (l Login) View() tea.View {
	w, h := l.w, l.h
	if w <= 0 {
		w = 48
	}
	if h <= 0 {
		h = 18
	}

	title := lipgloss.NewStyle().Foreground(theme.Amber).Bold(true).Render("ironlog")
	sub := lipgloss.NewStyle().Foreground(theme.Dim).Render("terminal · login")

	form := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		sub,
		"",
		l.field("email", l.email, l.focus == 0),
		l.field("password", l.password, l.focus == 1),
		"",
		l.statusLine(),
	)
	box := lipgloss.NewStyle().Padding(1, 3).Render(form)
	centered := lipgloss.Place(w, h, lipgloss.Center, lipgloss.Center, box)

	v := tea.NewView(centered)
	v.BackgroundColor = theme.Bg
	v.AltScreen = true
	return v
}

func (l Login) field(label string, ti textinput.Model, focused bool) string {
	marker := "  "
	lblColor := theme.Dim
	if focused {
		marker = lipgloss.NewStyle().Foreground(theme.Amber).Render(theme.GlyphActive + " ")
		lblColor = theme.Fg
	}
	lbl := lipgloss.NewStyle().Foreground(lblColor).Width(10).Render(label)
	box := lipgloss.NewStyle().Foreground(theme.Cyan).Render("[ " + ti.View() + " ]")
	return marker + lbl + box
}

func (l Login) statusLine() string {
	switch {
	case l.submitting:
		return lipgloss.NewStyle().Foreground(theme.Cyan).Render("로그인 중…")
	case l.err != "":
		return lipgloss.NewStyle().Foreground(theme.Red).Render(theme.GlyphFail + " " + l.err)
	default:
		return lipgloss.NewStyle().Foreground(theme.Dim).Render("[⏎] 로그인   [tab] 이동   [ctrl+c] 종료")
	}
}
