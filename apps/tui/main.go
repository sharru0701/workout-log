// Command ironlog is a rich terminal client for the workout-log app. It speaks
// to the existing HTTP API (TUI-first: no backend changes required).
package main

import (
	"fmt"
	"os"

	tea "charm.land/bubbletea/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/config"
	"github.com/sharru0701/workout-log/apps/tui/internal/ui"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fail(err)
	}
	client, err := api.New(cfg.BaseURL)
	if err != nil {
		fail(err)
	}
	if _, err := tea.NewProgram(ui.NewApp(cfg, client)).Run(); err != nil {
		fail(err)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "ironlog:", err)
	os.Exit(1)
}
