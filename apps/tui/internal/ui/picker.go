package ui

import (
	"strings"

	"charm.land/bubbles/v2/textinput"
	"charm.land/lipgloss/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

// pickerItem is one selectable row: label is shown, value is acted on.
type pickerItem struct{ label, desc, value string }

// picker is a fuzzy filter + list rendered as a bottom panel (fzf/telescope
// style) — never a centered modal.
type picker struct {
	prompt string
	tag    string // "" = command palette; otherwise routed to the active view
	input  textinput.Model
	items  []pickerItem
	sel    int
}

func newPicker(prompt, tag string, items []pickerItem) picker {
	ti := textinput.New()
	ti.Prompt = ""
	ti.SetVirtualCursor(true)
	ti.SetWidth(18)
	ti.Focus()
	return picker{prompt: prompt, tag: tag, input: ti, items: items}
}

func (p picker) filtered() []pickerItem {
	q := strings.ToLower(strings.TrimSpace(p.input.Value()))
	if q == "" {
		return p.items
	}
	out := make([]pickerItem, 0, len(p.items))
	for _, it := range p.items {
		if strings.Contains(strings.ToLower(it.label), q) || strings.Contains(strings.ToLower(it.value), q) {
			out = append(out, it)
		}
	}
	return out
}

const pickerMaxRows = 6

// render returns the picker panel string and its line count.
func (p picker) render(w int) (string, int) {
	lines := []string{
		lipgloss.NewStyle().Foreground(theme.Cyan).Bold(true).Render(p.prompt) + p.input.View(),
	}
	shown := p.filtered()
	if len(shown) > pickerMaxRows {
		shown = shown[:pickerMaxRows]
	}
	for i, it := range shown {
		var line string
		if i == p.sel {
			line = lipgloss.NewStyle().Foreground(theme.Amber).Render("› ") +
				lipgloss.NewStyle().Foreground(theme.Fg).Bold(true).Render(it.label)
		} else {
			line = "  " + lipgloss.NewStyle().Foreground(theme.Dim).Render(it.label)
		}
		if it.desc != "" {
			line += lipgloss.NewStyle().Foreground(theme.Ghost).Render("  " + it.desc)
		}
		lines = append(lines, fitLine(line, w))
	}
	return strings.Join(lines, "\n"), len(lines)
}
