package ui

import (
	"context"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/config"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

type appState int

const (
	stateLoading appState = iota
	stateLogin
	stateFrame
)

type authCheckedMsg struct{ user *api.User }

type loginResultMsg struct {
	user *api.User
	err  error
}

// loggedOutMsg returns to the login gate (emitted by the :logout command).
type loggedOutMsg struct{}

func authCheckCmd(c *api.Client) tea.Cmd {
	return func() tea.Msg {
		u, _ := c.Me(context.Background())
		return authCheckedMsg{user: u}
	}
}

func loginCmd(c *api.Client, email, password string) tea.Cmd {
	return func() tea.Msg {
		u, err := c.Login(context.Background(), email, password)
		return loginResultMsg{user: u, err: err}
	}
}

func signupCmd(c *api.Client, email, password string) tea.Cmd {
	return func() tea.Msg {
		u, err := c.Signup(context.Background(), api.SignupRequest{Email: email, Password: password})
		return loginResultMsg{user: u, err: err}
	}
}

// forgotResultMsg reports a password-reset request result (err set on failure).
type forgotResultMsg struct{ err error }

func forgotCmd(c *api.Client, email string) tea.Cmd {
	return func() tea.Msg {
		return forgotResultMsg{err: c.RequestPasswordReset(context.Background(), email)}
	}
}

// App is the root model: it gates on auth (login) and then hands off to the
// Frame (the workout buffer chrome).
type App struct {
	cfg    config.Config
	client *api.Client
	state  appState
	login  Login
	frame  Frame
	user   *api.User
	w, h   int
}

// NewApp wires login + frame. A persisted session token is verified on startup.
func NewApp(cfg config.Config, client *api.Client) App {
	a := App{
		cfg:    cfg,
		client: client,
		login:  NewLogin(client),
		frame:  NewFrame(client),
	}
	if tok := cfg.SessionToken(); tok != "" {
		client.SetSessionToken(tok)
		a.state = stateLoading
	} else {
		a.state = stateLogin
	}
	return a
}

func (a App) Init() tea.Cmd {
	switch a.state {
	case stateLoading:
		return authCheckCmd(a.client)
	case stateLogin:
		return a.login.Init()
	}
	return nil
}

func (a App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch m := msg.(type) {
	case tea.KeyPressMsg:
		if m.String() == "ctrl+c" {
			return a, tea.Quit
		}
	case tea.WindowSizeMsg:
		a.w, a.h = m.Width, m.Height
		a.login, _ = a.login.Update(msg)
		fm, _ := a.frame.Update(msg)
		a.frame = fm.(Frame)
		return a, nil
	case authCheckedMsg:
		if m.user != nil {
			a.user = m.user
			a.state = stateFrame
			return a, a.frame.Init()
		}
		a.state = stateLogin
		return a, a.login.Init()
	case loginResultMsg:
		if m.err == nil && m.user != nil {
			a.user = m.user
			if tok := a.client.SessionToken(); tok != "" {
				_ = a.cfg.SaveSessionToken(tok)
			}
			a.state = stateFrame
			return a, a.frame.Init()
		}
		a.login = a.login.withError(m.err)
		return a, nil
	case loggedOutMsg:
		_ = a.cfg.ClearSession()
		a.user = nil
		a.state = stateLogin
		a.login = NewLogin(a.client)
		return a, a.login.Init()
	}

	switch a.state {
	case stateLogin:
		var cmd tea.Cmd
		a.login, cmd = a.login.Update(msg)
		return a, cmd
	case stateFrame:
		fm, cmd := a.frame.Update(msg)
		a.frame = fm.(Frame)
		return a, cmd
	}
	return a, nil
}

func (a App) View() tea.View {
	switch a.state {
	case stateLogin:
		return a.login.View()
	case stateFrame:
		return a.frame.View()
	default:
		v := tea.NewView(lipgloss.NewStyle().Foreground(theme.Dim).Render("  authenticating…"))
		v.BackgroundColor = theme.Bg
		v.AltScreen = true
		return v
	}
}
