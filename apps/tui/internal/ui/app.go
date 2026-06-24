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
	stateShell
)

// authCheckedMsg carries the result of the startup session check.
type authCheckedMsg struct{ user *api.User }

// loginResultMsg carries the result of a login attempt.
type loginResultMsg struct {
	user *api.User
	err  error
}

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

// App is the root model: it shows the login view until authenticated, then the
// persistent shell.
type App struct {
	cfg    config.Config
	client *api.Client
	state  appState
	login  Login
	shell  Shell
	user   *api.User
	w, h   int
}

// NewApp wires the login + shell. If a session token is already persisted it
// optimistically seeds the client and verifies it on startup.
func NewApp(cfg config.Config, client *api.Client) App {
	a := App{
		cfg:    cfg,
		client: client,
		login:  NewLogin(client),
		shell:  NewShell(),
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
		// keep both submodels sized regardless of state
		a.w, a.h = m.Width, m.Height
		a.login, _ = a.login.Update(msg)
		sm, _ := a.shell.Update(msg)
		a.shell = sm.(Shell)
		return a, nil
	case authCheckedMsg:
		if m.user != nil {
			a.user = m.user
			a.state = stateShell
			return a, a.shell.Init()
		}
		a.state = stateLogin
		return a, a.login.Init()
	case loginResultMsg:
		if m.err == nil && m.user != nil {
			a.user = m.user
			if tok := a.client.SessionToken(); tok != "" {
				_ = a.cfg.SaveSessionToken(tok)
			}
			a.state = stateShell
			return a, a.shell.Init()
		}
		a.login = a.login.withError(m.err)
		return a, nil
	}

	var cmd tea.Cmd
	switch a.state {
	case stateLogin:
		a.login, cmd = a.login.Update(msg)
	case stateShell:
		sm, c := a.shell.Update(msg)
		a.shell, cmd = sm.(Shell), c
	}
	return a, cmd
}

func (a App) View() tea.View {
	switch a.state {
	case stateLogin:
		return a.login.View()
	case stateShell:
		return a.shell.View()
	default:
		v := tea.NewView(lipgloss.NewStyle().Foreground(theme.Dim).Render("  authenticating…"))
		v.BackgroundColor = theme.Bg
		v.AltScreen = true
		return v
	}
}
