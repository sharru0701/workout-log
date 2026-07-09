package ui

// log_commands.go — 오늘 버퍼의 Tea 커맨드/메시지와 API 효과(저장·세션 로드·부트 오토로드·
// 세션 override·운동 picker). 순수 상태 변이/렌더링과 분리 — god-component 분해 3단계.

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

type saveResultMsg struct {
	detail      *api.LogDetail
	err         error
	edited      bool
	performedAt time.Time                // when the saved log is dated, for the edit banner
	feedback    *api.ProgressionFeedback // 서버 조립 판정 카드·배너(문구 그대로 표시)
}

// saveCmd persists the done sets: PATCH when editID is set (editing a past
// session), POST otherwise. A zero performedAt means "now" (new log); editing
// preserves the original timestamp.
func saveCmd(c *api.Client, groups []exGroup, editID string, performedAt time.Time) tea.Cmd {
	var sets []api.WorkoutSet
	for _, g := range groups {
		name := strings.TrimSpace(g.name)
		for _, s := range g.sets {
			if !s.done {
				continue
			}
			w, _ := strconv.ParseFloat(s.weight, 64)
			reps, _ := strconv.Atoi(s.reps)
			ws := api.WorkoutSet{ExerciseName: name, WeightKg: w, Reps: reps}
			if isBodyweightExercise(name) && s.total > 0 {
				// weightKg is the external added weight; attach bodyweight meta so
				// the total load survives (server stores meta as-is).
				ws.Meta = &api.SetMeta{
					BodyweightKg: api.Float64(round2(s.total - w)),
					TotalLoadKg:  api.Float64(s.total),
				}
			}
			if rpe, err := strconv.Atoi(strings.TrimSpace(s.rpe)); err == nil && rpe > 0 {
				ws.RPE = &rpe
			}
			sets = append(sets, ws)
		}
	}
	return func() tea.Msg {
		at := performedAt
		if at.IsZero() {
			at = time.Now()
		}
		req := api.CreateLogRequest{Sets: sets, PerformedAt: at}
		id, err := editID, error(nil)
		var feedback *api.ProgressionFeedback
		if editID != "" {
			feedback, err = c.UpdateLog(context.Background(), editID, req)
		} else {
			id, feedback, err = c.CreateLog(context.Background(), req)
		}
		if err != nil {
			return saveResultMsg{err: err, edited: editID != ""}
		}
		detail, err := c.GetLog(context.Background(), id)
		return saveResultMsg{detail: detail, err: err, edited: editID != "", performedAt: at, feedback: feedback}
	}
}

type sessionLoadedMsg struct {
	snapshot   *api.SessionSnapshot
	prev       map[string]string // exerciseName(lower) → "weight×reps" last performance
	planName   string            // plan/program name for the today header
	sessionKey string            // generated-session key for the header label
	planID     string            // active plan id, for session overrides
	bodyweight float64           // user bodyweight for bodyweight-exercise load math
	noPlan     bool              // auto-load found no active plan
	err        error
}

// generatedSessionMsg generates a plan's session and pairs it with the prev-map
// from recent logs. Shared by the manual plan-activation path and the boot-time
// auto-load.
func generatedSessionMsg(c *api.Client, planID string) sessionLoadedMsg {
	s, err := c.GenerateSession(context.Background(), planID)
	if err != nil {
		return sessionLoadedMsg{err: err}
	}
	logs, _ := c.ListLogs(context.Background(), api.ListLogsParams{Limit: 50})
	return sessionLoadedMsg{
		snapshot:   &s.Snapshot,
		prev:       buildPrevMap(logs),
		planName:   s.Snapshot.Plan.Name,
		sessionKey: s.SessionKey,
		planID:     planID,
		bodyweight: fetchBodyweight(c),
	}
}

// fetchBodyweight reads the user's bodyweight (kg) from settings
// (prefs.bodyweight.kg). 0 when unset/unavailable — bodyweight load math then
// falls back to showing the raw prescribed total (no breakdown).
func fetchBodyweight(c *api.Client) float64 {
	vals, err := c.Settings(context.Background())
	if err != nil {
		return 0
	}
	raw, ok := vals["prefs.bodyweight.kg"]
	if !ok {
		return 0
	}
	var f float64
	if json.Unmarshal(raw, &f) == nil {
		return f
	}
	var str string
	if json.Unmarshal(raw, &str) == nil {
		if v, err := strconv.ParseFloat(strings.TrimSpace(str), 64); err == nil {
			return v
		}
	}
	return 0
}

func loadSessionCmd(c *api.Client, planID string) tea.Cmd {
	return func() tea.Msg { return generatedSessionMsg(c, planID) }
}

// overrideDoneMsg reports the result of a session override (보강/교체); on success
// the today buffer regenerates so the change appears.
type overrideDoneMsg struct {
	err    error
	planID string
	desc   string
}

func addAccessoryCmd(c *api.Client, planID, sessionKey, name string, sets []api.OverrideSet) tea.Cmd {
	return func() tea.Msg {
		err := c.AddAccessory(context.Background(), planID, sessionKey, name, sets)
		return overrideDoneMsg{err: err, planID: planID, desc: "보강 " + name}
	}
}

func replaceExerciseCmd(c *api.Client, planID, sessionKey, blockTarget, name string) tea.Cmd {
	return func() tea.Msg {
		err := c.ReplaceExercise(context.Background(), planID, sessionKey, blockTarget, name)
		return overrideDoneMsg{err: err, planID: planID, desc: "교체 → " + name}
	}
}

// autoloadCmd boots today's buffer: resolve the active plan and generate its
// session, mirroring the web bootstrap so today is never a blank canvas. With
// no active plan it returns noPlan so the buffer prompts for a program instead.
// A crash-recovery draft from today takes precedence per classifyBootDraft.
func autoloadCmd(c *api.Client, drafts draftStore) tea.Cmd {
	return func() tea.Msg {
		draft, hasDraft := loadTodayDraft(drafts, time.Now())
		// Resolve plans up front so both branches can name the session: the
		// restore branch maps a log's planId → name, the generate branch picks
		// the active plan.
		plans, plansErr := c.Plans(context.Background())
		// An existing log dated today (local) → restore it for editing (web
		// parity), so a re-open shows what was already done. Filter client-side
		// on each log's local date instead of a server date= query, so the day
		// boundary follows the user's timezone rather than the server's UTC
		// interpretation (an evening log won't slip to "yesterday").
		logs, logsErr := c.ListLogs(context.Background(), api.ListLogsParams{Limit: 5})
		var todayLog *api.LogItem
		if logsErr == nil {
			if lg, ok := todaysLog(logs, time.Now()); ok {
				todayLog = &lg
			}
		}
		switch classifyBootDraft(hasDraft, draft.EditID, todayLog, logsErr == nil) {
		case draftRestore:
			return draftRestoredMsg{draft: draft}
		case draftRestoreAsNew:
			draft.EditID = ""
			return draftRestoredMsg{draft: draft}
		case draftDrop:
			if drafts != nil {
				_ = drafts.ClearDraft()
			}
		}
		if todayLog != nil {
			return editLogMsg{
				id: todayLog.ID, performedAt: todayLog.PerformedAt, sets: todayLog.Sets,
				planName: planNameByID(plans, todayLog.PlanID), sessionKey: sessionKeyOf(*todayLog),
				planID: strOr(todayLog.PlanID), bodyweight: fetchBodyweight(c),
			}
		}
		if plansErr != nil {
			return sessionLoadedMsg{err: plansErr}
		}
		p, ok := api.ActivePlan(plans)
		if !ok {
			return sessionLoadedMsg{noPlan: true}
		}
		return generatedSessionMsg(c, p.ID)
	}
}

// openExercisePickerCmd fetches the exercise dictionary and asks the frame to
// open a fuzzy picker tagged "exercise".
func openExercisePickerCmd(c *api.Client) tea.Cmd { return exercisePickerCmd(c, "운동 ", "exercise") }

// exercisePickerCmd opens an exercise picker with a custom prompt and routing
// tag (exercise add, accessory override, replace override).
func exercisePickerCmd(c *api.Client, prompt, tag string) tea.Cmd {
	return func() tea.Msg {
		exs, _ := c.Exercises(context.Background(), "")
		items := make([]pickerItem, len(exs))
		for i, e := range exs {
			items[i] = pickerItem{label: e.Name, value: e.Name}
		}
		return openPickerMsg{prompt: prompt, tag: tag, items: items}
	}
}
