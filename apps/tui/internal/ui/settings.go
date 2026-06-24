package ui

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

// --- PREFERENCES section: server-backed key/value rows ---

type settingKind int

const (
	skEnum settingKind = iota
	skNumber
)

type settingDef struct {
	label   string
	key     string
	kind    settingKind
	options []string // enum
	unit    string   // number suffix
}

var settingDefs = []settingDef{
	{label: "언어", key: "prefs.locale", kind: skEnum, options: []string{"ko", "en"}},
	{label: "목표", key: "prefs.trainingGoal.primary", kind: skEnum, options: []string{"general", "strength", "hypertrophy", "endurance", "powerlifting"}},
	{label: "체중", key: "prefs.bodyweight.kg", kind: skNumber, unit: "kg"},
	{label: "증가단위", key: "prefs.minimumPlate.defaultKg", kind: skNumber, unit: "kg"},
}

// --- ACCOUNT section: self-service actions opened as inline password forms ---

const (
	actChangePassword = iota
	actDeleteAccount
)

var accountActions = []struct {
	label string
	hint  string
}{
	{label: "비밀번호", hint: "변경"},
	{label: "계정 삭제", hint: "삭제"},
}

// settingsForm is the inline overlay opened on an ACCOUNT row.
type settingsForm int

const (
	formNone settingsForm = iota
	formPassword
	formDelete
)

// --- messages ---

type settingsLoadedMsg struct {
	values map[string]json.RawMessage
	err    error
}

type settingSavedMsg struct{ err error }

// accountActionMsg reports the result of a password change (ok set) or any
// account action failure (err set). Account deletion success returns
// loggedOutMsg instead, routed to the root App.
type accountActionMsg struct {
	ok  string
	err error
}

// --- commands ---

func settingsLoadCmd(c *api.Client) tea.Cmd {
	return func() tea.Msg {
		v, err := c.Settings(context.Background())
		return settingsLoadedMsg{values: v, err: err}
	}
}

func setSettingCmd(c *api.Client, key string, value any) tea.Cmd {
	return func() tea.Msg {
		return settingSavedMsg{err: c.SetSetting(context.Background(), key, value)}
	}
}

func changePasswordCmd(c *api.Client, cur, next string) tea.Cmd {
	return func() tea.Msg {
		if err := c.ChangePassword(context.Background(), cur, next); err != nil {
			return accountActionMsg{err: err}
		}
		return accountActionMsg{ok: "비밀번호를 변경했습니다"}
	}
}

func deleteAccountCmd(c *api.Client, pw string) tea.Cmd {
	return func() tea.Msg {
		if err := c.DeleteAccount(context.Background(), pw); err != nil {
			return accountActionMsg{err: err}
		}
		return loggedOutMsg{}
	}
}

// Settings is the settings buffer: a PREFERENCES list plus an ACCOUNT section.
// j/k moves; on prefs, enter cycles enums / i edits numbers; on account rows,
// enter opens an inline password form (change password / delete account).
type Settings struct {
	client  *api.Client
	values  map[string]json.RawMessage
	sel     int
	editing bool // inline number edit (prefs)
	edit    textinput.Model
	form    settingsForm      // account form overlay
	pw      []textinput.Model // form fields (3 for password, 1 for delete)
	ffocus  int
	pending bool // account request in flight
	loaded  bool
	err     string
	flash   string
	flashOk bool
	w, h    int
}

func NewSettings(c *api.Client) Settings { return Settings{client: c} }

func (s Settings) Init() tea.Cmd { return settingsLoadCmd(s.client) }

// Editing reports whether the buffer owns every key (number edit or a form),
// so the frame routes input here instead of treating digits/space as globals.
func (s Settings) Editing() bool { return s.editing || s.form != formNone }

func (s Settings) rowCount() int      { return len(settingDefs) + len(accountActions) }
func (s Settings) isAccountRow() bool { return s.sel >= len(settingDefs) }
func (s Settings) accountIdx() int    { return s.sel - len(settingDefs) }

func (s Settings) Update(msg tea.Msg) (Screen, tea.Cmd) {
	switch m := msg.(type) {
	case tea.WindowSizeMsg:
		s.w, s.h = m.Width, m.Height
		return s, nil
	case settingsLoadedMsg:
		s.loaded = true
		if m.err != nil {
			s.err = humanizeAuthErr(m.err)
			return s, nil
		}
		s.err, s.values = "", m.values
		return s, nil
	case settingSavedMsg:
		if m.err != nil {
			s.setFlash("저장 실패", false)
			return s, settingsLoadCmd(s.client) // revert to server truth
		}
		return s, nil
	case accountActionMsg:
		s.pending = false
		if m.err != nil {
			s.setFlash(humanizeAccountErr(m.err), false)
			return s, nil // keep the password form open for retry
		}
		s.form = formNone
		s.setFlash(m.ok, true)
		return s, nil
	case tea.KeyPressMsg:
		switch {
		case s.form != formNone:
			return s.updateForm(m)
		case s.editing:
			return s.updateEditing(m)
		default:
			return s.handleKey(m)
		}
	}
	// passive updates to the focused textinput
	if s.form != formNone && s.ffocus < len(s.pw) {
		var cmd tea.Cmd
		s.pw[s.ffocus], cmd = s.pw[s.ffocus].Update(msg)
		return s, cmd
	}
	if s.editing {
		var cmd tea.Cmd
		s.edit, cmd = s.edit.Update(msg)
		return s, cmd
	}
	return s, nil
}

func (s Settings) handleKey(m tea.KeyPressMsg) (Screen, tea.Cmd) {
	switch m.String() {
	case "j", "down":
		if s.sel < s.rowCount()-1 {
			s.sel++
		}
	case "k", "up":
		if s.sel > 0 {
			s.sel--
		}
	case "enter", " ":
		if s.isAccountRow() {
			return s.triggerAccount()
		}
		def := settingDefs[s.sel]
		if def.kind == skEnum {
			return s.cycle(def)
		}
		return s.beginEdit(def)
	case "i":
		if !s.isAccountRow() {
			def := settingDefs[s.sel]
			if def.kind == skNumber {
				return s.beginEdit(def)
			}
		}
	}
	return s, nil
}

// --- PREFERENCES interactions ---

func (s Settings) cycle(def settingDef) (Screen, tea.Cmd) {
	cur := s.rawString(def.key)
	next := def.options[0]
	for i, o := range def.options {
		if o == cur {
			next = def.options[(i+1)%len(def.options)]
			break
		}
	}
	s.setRaw(def.key, fmt.Sprintf("%q", next))
	return s, setSettingCmd(s.client, def.key, next)
}

func (s Settings) beginEdit(def settingDef) (Screen, tea.Cmd) {
	ti := textinput.New()
	ti.Prompt = ""
	ti.SetVirtualCursor(true)
	ti.SetWidth(8)
	ti.SetValue(s.numberString(def.key))
	s.edit = ti
	s.editing = true
	return s, s.edit.Focus()
}

func (s Settings) updateEditing(m tea.KeyPressMsg) (Screen, tea.Cmd) {
	switch m.String() {
	case "esc":
		s.editing = false
		return s, nil
	case "enter":
		s.editing = false
		def := settingDefs[s.sel]
		v, err := strconv.ParseFloat(strings.TrimSpace(s.edit.Value()), 64)
		if err != nil || v < 0 {
			s.setFlash("숫자를 입력하세요", false)
			return s, nil
		}
		s.setRaw(def.key, strconv.FormatFloat(v, 'f', -1, 64))
		return s, setSettingCmd(s.client, def.key, v)
	}
	var cmd tea.Cmd
	s.edit, cmd = s.edit.Update(m)
	return s, cmd
}

// --- ACCOUNT interactions ---

func (s Settings) triggerAccount() (Screen, tea.Cmd) {
	switch s.accountIdx() {
	case actChangePassword:
		return s.beginPasswordForm()
	case actDeleteAccount:
		return s.beginDeleteForm()
	}
	return s, nil
}

func newPwField() textinput.Model {
	ti := textinput.New()
	ti.Prompt = ""
	ti.Placeholder = "••••••••"
	ti.EchoMode = textinput.EchoPassword
	ti.EchoCharacter = '•'
	ti.SetVirtualCursor(true)
	ti.SetWidth(22)
	return ti
}

func (s Settings) beginPasswordForm() (Screen, tea.Cmd) {
	s.pw = []textinput.Model{newPwField(), newPwField(), newPwField()}
	s.form, s.ffocus = formPassword, 0
	s.flash = ""
	return s, s.pw[0].Focus()
}

func (s Settings) beginDeleteForm() (Screen, tea.Cmd) {
	s.pw = []textinput.Model{newPwField()}
	s.form, s.ffocus = formDelete, 0
	s.flash = ""
	return s, s.pw[0].Focus()
}

func (s Settings) updateForm(m tea.KeyPressMsg) (Screen, tea.Cmd) {
	switch m.String() {
	case "esc":
		s.form, s.pending, s.flash = formNone, false, ""
		return s, nil
	case "tab", "down", "shift+tab", "up":
		if s.form == formPassword {
			s.ffocus = (s.ffocus + 1) % len(s.pw)
			return s, s.refocusForm()
		}
		return s, nil
	case "enter":
		if s.pending {
			return s, nil
		}
		if s.form == formPassword {
			return s.submitPassword()
		}
		return s.submitDelete()
	}
	var cmd tea.Cmd
	s.pw[s.ffocus], cmd = s.pw[s.ffocus].Update(m)
	return s, cmd
}

func (s *Settings) refocusForm() tea.Cmd {
	for i := range s.pw {
		if i != s.ffocus {
			s.pw[i].Blur()
		}
	}
	return s.pw[s.ffocus].Focus()
}

func (s Settings) submitPassword() (Screen, tea.Cmd) {
	cur, next, confirm := s.pw[0].Value(), s.pw[1].Value(), s.pw[2].Value()
	switch {
	case cur == "" || next == "":
		s.setFlash("현재·새 비밀번호를 입력하세요", false)
		return s, nil
	case len(next) < 8:
		s.setFlash("새 비밀번호는 8자 이상이어야 합니다", false)
		return s, nil
	case next != confirm:
		s.setFlash("새 비밀번호 확인이 일치하지 않습니다", false)
		return s, nil
	case next == cur:
		s.setFlash("새 비밀번호가 현재와 같습니다", false)
		return s, nil
	}
	s.pending, s.flash = true, ""
	return s, changePasswordCmd(s.client, cur, next)
}

func (s Settings) submitDelete() (Screen, tea.Cmd) {
	pw := s.pw[0].Value()
	if pw == "" {
		s.setFlash("비밀번호를 입력하세요", false)
		return s, nil
	}
	// Hand off to the frame's confirm overlay; deletion runs only on y.
	s.form = formNone
	client := s.client
	return s, func() tea.Msg {
		return confirmMsg{
			prompt: "계정과 모든 기록을 영구 삭제합니다",
			onYes:  deleteAccountCmd(client, pw),
		}
	}
}

func humanizeAccountErr(err error) string {
	switch {
	case err == nil:
		return ""
	case api.IsUnauthorized(err):
		return "현재 비밀번호가 올바르지 않습니다"
	case api.IsRateLimited(err):
		return "요청이 너무 많습니다. 잠시 후 다시 시도하세요"
	default:
		return err.Error()
	}
}

// --- status reporting ---

func (s Settings) Mode() Mode {
	if !s.loaded && s.err == "" {
		return Mode{Label: "LOADING", Tone: theme.Cyan}
	}
	if s.form == formDelete {
		return Mode{Label: "DELETE", Tone: theme.Red}
	}
	if s.editing || s.form != formNone {
		return Mode{Label: "INSERT", Tone: theme.Amber}
	}
	return ModeNormal
}

func (s Settings) Context() string {
	switch s.form {
	case formPassword:
		return "비밀번호 변경"
	case formDelete:
		return "계정 삭제"
	}
	if s.isAccountRow() {
		if s.accountIdx() == actChangePassword {
			return "비밀번호 변경"
		}
		return "계정 삭제"
	}
	return settingDefs[s.sel].label
}

func (s Settings) StatusRight() string { return "" }

func (s Settings) Hints(int) string {
	switch s.form {
	case formPassword:
		return joinHints(hint("⏎", "변경"), hint("tab", "이동"), hint("esc", "취소"))
	case formDelete:
		return joinHints(hint("⏎", "계속"), hint("esc", "취소"))
	}
	if s.editing {
		return joinHints(hint("⏎", "저장"), hint("esc", "취소"))
	}
	return joinHints(hint("jk", "이동"), hint("⏎", "변경"), hint("i", "숫자편집"))
}

// --- rendering ---

func (s Settings) Body(w, h int) string {
	if s.err != "" {
		return centered(theme.GlyphFail+" "+s.err, theme.Red, w, h)
	}
	if !s.loaded {
		return centered("불러오는 중…", theme.Dim, w, h)
	}
	switch s.form {
	case formPassword:
		return s.passwordFormBody(w, h)
	case formDelete:
		return s.deleteFormBody(w, h)
	}
	return s.listBody(w, h)
}

func (s Settings) listBody(w, h int) string {
	lines := []string{sectionHeader("PREFERENCES")}
	for i, def := range settingDefs {
		lines = append(lines, s.prefRow(i, def))
	}
	lines = append(lines, "", sectionHeader("ACCOUNT"))
	for i := range accountActions {
		lines = append(lines, s.actionRow(len(settingDefs)+i))
	}
	if s.flash != "" {
		lines = append(lines, "", s.flashLine())
	}
	return lipgloss.NewStyle().Width(w).Height(h).Padding(1, 1).Render(strings.Join(lines, "\n"))
}

func (s Settings) prefRow(i int, def settingDef) string {
	marker, labelStyle := "  ", lipgloss.NewStyle().Foreground(theme.Dim)
	if i == s.sel {
		marker = lipgloss.NewStyle().Foreground(theme.Amber).Render("› ")
		labelStyle = lipgloss.NewStyle().Foreground(theme.Fg)
	}
	label := labelStyle.Width(12).Render(def.label)
	var val string
	if s.editing && i == s.sel && def.kind == skNumber {
		val = lipgloss.NewStyle().Foreground(theme.Amber).Render("["+s.edit.View()+"]") + def.unit
	} else {
		val = lipgloss.NewStyle().Foreground(theme.Cyan).Render(s.displayValue(def))
	}
	return marker + label + val
}

func (s Settings) actionRow(idx int) string {
	ai := idx - len(settingDefs)
	act := accountActions[ai]
	marker, labelColor := "  ", theme.Dim
	valColor := theme.Cyan
	if ai == actDeleteAccount {
		valColor = theme.Red
	}
	if idx == s.sel {
		marker = lipgloss.NewStyle().Foreground(theme.Amber).Render("› ")
		labelColor = theme.Fg
	}
	label := lipgloss.NewStyle().Foreground(labelColor).Width(12).Render(act.label)
	val := lipgloss.NewStyle().Foreground(valColor).Render(act.hint)
	return marker + label + val
}

func (s Settings) passwordFormBody(w, h int) string {
	labels := []string{"현재 비밀번호", "새 비밀번호", "새 비밀번호 확인"}
	rows := make([]string, len(s.pw))
	for i := range s.pw {
		rows[i] = s.formField(labels[i], s.pw[i], i == s.ffocus)
	}
	parts := []string{lipgloss.NewStyle().Foreground(theme.Amber).Bold(true).Render("비밀번호 변경"), ""}
	parts = append(parts, rows...)
	parts = append(parts, "", s.formStatus("[⏎] 변경   [tab] 이동   [esc] 취소"))
	return lipgloss.NewStyle().Width(w).Height(h).Padding(1, 1).Render(strings.Join(parts, "\n"))
}

func (s Settings) deleteFormBody(w, h int) string {
	title := lipgloss.NewStyle().Foreground(theme.Red).Bold(true).Render("계정 삭제")
	warn := lipgloss.NewStyle().Foreground(theme.Dim).Render(
		"운동 기록·세트·플랜·커스텀 템플릿이 영구 삭제됩니다.\n복구할 수 없습니다.")
	field := s.formField("현재 비밀번호", s.pw[0], true)
	body := strings.Join([]string{title, "", warn, "", field, "", s.formStatus("[⏎] 계속   [esc] 취소")}, "\n")
	return lipgloss.NewStyle().Width(w).Height(h).Padding(1, 1).Render(body)
}

func (s Settings) formField(label string, ti textinput.Model, focused bool) string {
	marker, lblColor := "  ", theme.Dim
	if focused {
		marker = lipgloss.NewStyle().Foreground(theme.Amber).Render(theme.GlyphActive + " ")
		lblColor = theme.Fg
	}
	lbl := lipgloss.NewStyle().Foreground(lblColor).Width(18).Render(label)
	box := lipgloss.NewStyle().Foreground(theme.Cyan).Render("[ " + ti.View() + " ]")
	return marker + lbl + box
}

func (s Settings) formStatus(idle string) string {
	if s.pending {
		return lipgloss.NewStyle().Foreground(theme.Cyan).Render("변경 중…")
	}
	if s.flash != "" {
		return s.flashLine()
	}
	return lipgloss.NewStyle().Foreground(theme.Dim).Render(idle)
}

func sectionHeader(s string) string {
	return lipgloss.NewStyle().Foreground(theme.Ghost).Bold(true).Render(s)
}

func (s Settings) flashLine() string {
	tone := theme.Red
	if s.flashOk {
		tone = theme.Green
	}
	return lipgloss.NewStyle().Foreground(tone).Render(s.flash)
}

func (s Settings) displayValue(def settingDef) string {
	switch def.kind {
	case skEnum:
		v := s.rawString(def.key)
		if def.key == "prefs.locale" {
			if v == "en" {
				return "English"
			}
			return "한국어"
		}
		if v == "" {
			return def.options[0]
		}
		return v
	default: // skNumber
		n := s.numberString(def.key)
		if n == "" || n == "0" {
			return lipgloss.NewStyle().Foreground(theme.Ghost).Render("—")
		}
		return n + def.unit
	}
}

// --- raw value helpers ---

func (s Settings) rawString(key string) string {
	r, ok := s.values[key]
	if !ok {
		return ""
	}
	var str string
	if json.Unmarshal(r, &str) == nil {
		return str
	}
	return strings.Trim(string(r), `"`)
}

func (s Settings) numberString(key string) string {
	r, ok := s.values[key]
	if !ok {
		return ""
	}
	var f float64
	if json.Unmarshal(r, &f) == nil {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
	return ""
}

func (s *Settings) setRaw(key, rawJSON string) {
	if s.values == nil {
		s.values = map[string]json.RawMessage{}
	}
	s.values[key] = json.RawMessage(rawJSON)
	s.flash = ""
}

func (s *Settings) setFlash(msg string, ok bool) {
	s.flash, s.flashOk = msg, ok
}
