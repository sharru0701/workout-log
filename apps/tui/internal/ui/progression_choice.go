package ui

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	tea "charm.land/bubbletea/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

const progressionWeightStepKg = 2.5

type progressionRuntimeTarget struct {
	ProgressionTarget string      `json:"progressionTarget"`
	WorkKg            api.Float64 `json:"workKg"`
	FailureStreak     int         `json:"failureStreak"`
	SuccessStreak     int         `json:"successStreak"`
}

type progressionRuntimeState struct {
	Targets map[string]progressionRuntimeTarget `json:"targets"`
}

type progressionChoiceTarget struct {
	Key               string
	Canonical         string
	Label             string
	CurrentWorkKg     float64
	RecommendedWorkKg float64
}

type progressionChoiceFlow struct {
	planID, sessionKey, editID string
	targets                    []progressionChoiceTarget
	index                      int
	decisions                  map[string]api.ProgressionTargetDecision
}

type progressionChoiceLoadedMsg struct {
	planID, sessionKey, editID string
	state                      *api.PlanProgressionState
	beforeState                json.RawMessage
	snapshot                   *api.SessionSnapshot
	err                        error
}

type progressionChoiceConfirmedMsg struct {
	planID, sessionKey, editID string
	decisions                  map[string]api.ProgressionTargetDecision
}

type progressionChoiceRestartMsg struct{}
type progressionChoiceCancelledMsg struct{}

func cloneProgressionDecisions(in map[string]api.ProgressionTargetDecision) map[string]api.ProgressionTargetDecision {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]api.ProgressionTargetDecision, len(in))
	for key, decision := range in {
		out[key] = decision
	}
	return out
}

func snapProgressionWeight(value float64) float64 {
	return math.Max(0, math.Round(value/progressionWeightStepKg)*progressionWeightStepKg)
}

func sessionWeekDay(key string) (week, day int, ok bool) {
	key = strings.TrimSpace(key)
	if match := reCycleWave.FindStringSubmatch(key); match != nil {
		week, _ = strconv.Atoi(match[2])
		day, _ = strconv.Atoi(match[3])
		return week, day, week > 0 && day > 0
	}
	if match := reDateProg.FindStringSubmatch(key); match != nil {
		week, _ = strconv.Atoi(match[2])
		day, _ = strconv.Atoi(match[3])
		return week, day, week > 0 && day > 0
	}
	return 0, 0, false
}

func isPotentialBlockCompletionSession(sessionKey string) bool {
	week, day, ok := sessionWeekDay(sessionKey)
	return ok && ((week == 6 && day == 3) || (week == 4 && day == 4))
}

func loadProgressionChoiceCmd(c *api.Client, planID, sessionKey, editID string) tea.Cmd {
	return func() tea.Msg {
		msg := progressionChoiceLoadedMsg{planID: planID, sessionKey: sessionKey, editID: editID}
		if c == nil {
			msg.err = fmt.Errorf("API client is unavailable")
			return msg
		}
		if editID != "" {
			detail, err := c.GetLog(context.Background(), editID)
			if err != nil {
				msg.err = fmt.Errorf("기존 진행 판정 조회: %w", err)
				return msg
			}
			if detail.Progression != nil && detail.Progression.Event != nil {
				msg.beforeState = append(json.RawMessage(nil), detail.Progression.Event.BeforeState...)
			}
			if detail.GeneratedSession != nil {
				snapshot := detail.GeneratedSession.Snapshot
				msg.snapshot = &snapshot
			}
		}
		state, err := c.PlanProgressionState(context.Background(), planID)
		msg.state, msg.err = state, err
		return msg
	}
}

func progressionTargetFromGroup(group exGroup) string {
	for _, value := range []string{group.progressionTarget, group.blockTarget} {
		if target := strings.ToUpper(strings.TrimSpace(value)); target != "" {
			return target
		}
	}
	for _, set := range group.sets {
		if set.originalMeta == nil || set.originalMeta.Extra == nil {
			continue
		}
		raw := set.originalMeta.Extra["plannedRef"]
		var planned struct {
			ProgressionTarget string `json:"progressionTarget"`
		}
		if len(raw) > 0 && json.Unmarshal(raw, &planned) == nil {
			if target := strings.ToUpper(strings.TrimSpace(planned.ProgressionTarget)); target != "" {
				return target
			}
		}
	}
	name := strings.ToLower(strings.TrimSpace(group.name))
	switch {
	case strings.Contains(name, "squat"):
		return "SQUAT"
	case strings.Contains(name, "bench"):
		return "BENCH"
	case strings.Contains(name, "deadlift"):
		return "DEADLIFT"
	case strings.Contains(name, "overhead") || strings.Contains(name, "ohp") || strings.Contains(name, "military press"):
		return "OHP"
	case strings.Contains(name, "pull") || strings.Contains(name, "chin"):
		return "PULL"
	default:
		return ""
	}
}

func plannedRepsFromSet(set setEntry) int {
	if set.tgtReps > 0 {
		return set.tgtReps
	}
	if set.originalMeta == nil || set.originalMeta.Extra == nil {
		return 0
	}
	raw := set.originalMeta.Extra["plannedRef"]
	var planned struct {
		Reps int `json:"reps"`
	}
	if len(raw) > 0 && json.Unmarshal(raw, &planned) == nil && planned.Reps > 0 {
		return planned.Reps
	}
	return 0
}

func progressionOutcomeFromGroup(group exGroup) (target string, observed, failed bool) {
	if group.skipProgression {
		return "", false, false
	}
	target = progressionTargetFromGroup(group)
	if target == "" {
		return "", false, false
	}
	for _, set := range group.sets {
		if !set.done || set.isExtra {
			continue
		}
		planned := plannedRepsFromSet(set)
		if planned <= 0 {
			continue
		}
		actual, err := strconv.Atoi(strings.TrimSpace(set.reps))
		if err != nil {
			continue
		}
		observed = true
		if actual < planned {
			failed = true
		}
	}
	return target, observed, failed
}

func observedAndFailedTargets(groups []exGroup) (map[string]bool, map[string]bool) {
	observed := make(map[string]bool)
	failed := make(map[string]bool)
	for _, group := range groups {
		target, groupObserved, groupFailed := progressionOutcomeFromGroup(group)
		if !groupObserved {
			continue
		}
		observed[target] = true
		if groupFailed {
			failed[target] = true
		}
	}
	return observed, failed
}

type progressionFailureRef struct {
	Key, Canonical, Label string
}

func failedProgressionRefs(groups []exGroup) []progressionFailureRef {
	refs := make([]progressionFailureRef, 0)
	seen := make(map[string]bool)
	for _, group := range groups {
		target, observed, failed := progressionOutcomeFromGroup(group)
		if !observed || !failed {
			continue
		}
		key := strings.TrimSpace(group.progressionKey)
		identity := key
		if identity == "" {
			identity = target
		}
		if seen[identity] {
			continue
		}
		seen[identity] = true
		refs = append(refs, progressionFailureRef{
			Key: key, Canonical: target, Label: strings.TrimSpace(group.name),
		})
	}
	return refs
}

func progressionTargetLabel(target string) string {
	switch strings.ToUpper(strings.TrimSpace(target)) {
	case "SQUAT":
		return "스쿼트"
	case "BENCH":
		return "벤치프레스"
	case "DEADLIFT":
		return "데드리프트"
	case "OHP":
		return "오버헤드프레스"
	case "PULL":
		return "풀"
	default:
		return target
	}
}

func progressionTargetOrder(key, canonical string) int {
	value := strings.ToUpper(strings.TrimSpace(canonical))
	if value == "" {
		value = strings.ToUpper(strings.TrimSpace(key))
	}
	switch value {
	case "SQUAT":
		return 0
	case "BENCH":
		return 1
	case "DEADLIFT":
		return 2
	case "OHP":
		return 3
	case "PULL":
		return 4
	default:
		return 100
	}
}

func progressionCanonicalTarget(key string, target progressionRuntimeTarget, rule api.ProgressionEffectiveRule) string {
	canonical := strings.ToUpper(strings.TrimSpace(target.ProgressionTarget))
	if canonical == "" {
		canonical = strings.ToUpper(strings.TrimSpace(rule.ProgressionTarget))
	}
	if canonical == "" {
		canonical = strings.ToUpper(strings.TrimSpace(key))
	}
	return canonical
}

func progressionRuntimeForChoice(
	state *api.PlanProgressionState,
	beforeState json.RawMessage,
) (progressionRuntimeState, error) {
	var runtime progressionRuntimeState
	if state == nil {
		return runtime, nil
	}
	rawState := state.State
	if trimmed := strings.TrimSpace(string(beforeState)); trimmed != "" && trimmed != "null" && trimmed != "{}" {
		rawState = beforeState
	}
	if trimmed := strings.TrimSpace(string(rawState)); trimmed == "" || trimmed == "null" || trimmed == "{}" {
		return runtime, nil
	}
	if err := json.Unmarshal(rawState, &runtime); err != nil {
		return runtime, fmt.Errorf("진행 상태 해석: %w", err)
	}
	return runtime, nil
}

func progressionGroupsWithSnapshot(groups []exGroup, snapshot *api.SessionSnapshot) []exGroup {
	if snapshot == nil || len(snapshot.Exercises) == 0 {
		return groups
	}
	enriched := cloneGroups(groups)
	used := make([]bool, len(snapshot.Exercises))
	for gi := range enriched {
		match := -1
		for i, exercise := range snapshot.Exercises {
			if !used[i] && strings.EqualFold(strings.TrimSpace(exercise.ExerciseName), strings.TrimSpace(enriched[gi].name)) {
				match = i
				break
			}
		}
		if match < 0 {
			continue
		}
		used[match] = true
		exercise := snapshot.Exercises[match]
		group := &enriched[gi]
		group.blockTarget = exercise.SourceBlockTarget
		group.role = exercise.Role
		group.progressionKey = exercise.ProgressionKey
		group.progressionTarget = exercise.ProgressionTarget
		group.enforcePlannedReps = exercise.EnforcePlannedReps
		group.skipProgression = exercise.SkipProgression

		plannedByNumber := make(map[int]api.PlannedSet, len(exercise.Sets))
		for i, planned := range exercise.Sets {
			number := planned.SetNumber
			if number <= 0 {
				number = i + 1
			}
			plannedByNumber[number] = planned
		}
		fallbackIndex := 0
		for si := range group.sets {
			set := &group.sets[si]
			if set.isExtra {
				continue
			}
			planned, ok := plannedByNumber[set.setNumber]
			if !ok && fallbackIndex < len(exercise.Sets) {
				planned = exercise.Sets[fallbackIndex]
				ok = true
			}
			fallbackIndex++
			if !ok {
				continue
			}
			set.tgtReps = planned.Reps
			set.amrap = planned.Amrap
			set.prescribed = true
		}
	}
	return enriched
}

func buildBlockCompletionChoices(
	sessionKey string,
	state *api.PlanProgressionState,
	beforeState json.RawMessage,
	groups []exGroup,
) ([]progressionChoiceTarget, error) {
	if state == nil || state.Program == nil {
		return nil, nil
	}
	program := strings.ToLower(strings.TrimSpace(*state.Program))
	week, day, ok := sessionWeekDay(sessionKey)
	if !ok || !((program == "operator" && week == 6 && day == 3) ||
		(program == "wendler-531" && week == 4 && day == 4)) {
		return nil, nil
	}

	runtime, err := progressionRuntimeForChoice(state, beforeState)
	if err != nil {
		return nil, err
	}
	if len(runtime.Targets) == 0 {
		return nil, nil
	}

	observed, failed := observedAndFailedTargets(groups)
	freezeAll := false
	for key, target := range runtime.Targets {
		rule := state.EffectiveRules[key]
		canonical := progressionCanonicalTarget(key, target, rule)
		failureCount := target.FailureStreak
		if observed[canonical] {
			failureCount = 0
			if failed[canonical] {
				failureCount = target.FailureStreak + 1
			}
		}
		if failureCount > 0 {
			freezeAll = true
			break
		}
	}

	targets := make([]progressionChoiceTarget, 0, len(runtime.Targets))
	for key, target := range runtime.Targets {
		current := snapProgressionWeight(float64(target.WorkKg))
		if current <= 0 {
			continue
		}
		rule, hasRule := state.EffectiveRules[key]
		canonical := progressionCanonicalTarget(key, target, rule)
		increase := float64(rule.IncreaseKg)
		if !hasRule {
			increase = 2.5
			if canonical == "SQUAT" || canonical == "DEADLIFT" {
				increase = 5
			}
		}
		recommended := current
		if !freezeAll {
			recommended = snapProgressionWeight(current + increase)
		}
		targets = append(targets, progressionChoiceTarget{
			Key: key, Canonical: canonical, Label: progressionTargetLabel(canonical),
			CurrentWorkKg: current, RecommendedWorkKg: recommended,
		})
	}
	sort.SliceStable(targets, func(i, j int) bool {
		left := progressionTargetOrder(targets[i].Key, targets[i].Canonical)
		right := progressionTargetOrder(targets[j].Key, targets[j].Canonical)
		if left != right {
			return left < right
		}
		return targets[i].Key < targets[j].Key
	})
	return targets, nil
}

func failureResetChoiceConfig(program string) (threshold int, resetFactor float64, ok bool) {
	switch strings.ToLower(strings.TrimSpace(program)) {
	case "greyskull-lp":
		return 2, 0.9, true
	case "starting-strength-lp", "stronglifts-5x5", "texas-method":
		return 3, 0.9, true
	default:
		return 0, 0, false
	}
}

func resetProgressionWeight(current float64, rule api.ProgressionEffectiveRule, hasRule bool, fallbackFactor float64) float64 {
	if hasRule && rule.DecreaseKg != nil {
		return snapProgressionWeight(current - float64(*rule.DecreaseKg))
	}
	factor := fallbackFactor
	if hasRule && float64(rule.ResetFactor) > 0 {
		factor = float64(rule.ResetFactor)
	}
	return snapProgressionWeight(current * factor)
}

func buildFailureResetChoices(
	state *api.PlanProgressionState,
	beforeState json.RawMessage,
	groups []exGroup,
) ([]progressionChoiceTarget, error) {
	if state == nil || state.Program == nil {
		return nil, nil
	}
	threshold, resetFactor, ok := failureResetChoiceConfig(*state.Program)
	if !ok {
		return nil, nil
	}
	refs := failedProgressionRefs(groups)
	if len(refs) == 0 {
		return nil, nil
	}
	runtime, err := progressionRuntimeForChoice(state, beforeState)
	if err != nil {
		return nil, err
	}
	if len(runtime.Targets) == 0 {
		return nil, nil
	}

	targets := make([]progressionChoiceTarget, 0, len(refs))
	seenKeys := make(map[string]bool)
	for _, ref := range refs {
		key := ref.Key
		target, found := runtime.Targets[key]
		if key == "" || !found {
			keys := make([]string, 0)
			for candidateKey, candidate := range runtime.Targets {
				rule := state.EffectiveRules[candidateKey]
				if progressionCanonicalTarget(candidateKey, candidate, rule) == ref.Canonical {
					keys = append(keys, candidateKey)
				}
			}
			sort.Strings(keys)
			if len(keys) == 0 {
				continue
			}
			key = keys[0]
			target = runtime.Targets[key]
		}
		if seenKeys[key] || target.FailureStreak+1 < threshold {
			continue
		}
		seenKeys[key] = true
		current := snapProgressionWeight(float64(target.WorkKg))
		if current <= 0 {
			continue
		}
		rule, hasRule := state.EffectiveRules[key]
		canonical := progressionCanonicalTarget(key, target, rule)
		label := ref.Label
		if label == "" {
			label = progressionTargetLabel(canonical)
		}
		targets = append(targets, progressionChoiceTarget{
			Key: key, Canonical: canonical, Label: label,
			CurrentWorkKg:     current,
			RecommendedWorkKg: resetProgressionWeight(current, rule, hasRule, resetFactor),
		})
	}
	sort.SliceStable(targets, func(i, j int) bool {
		left := progressionTargetOrder(targets[i].Key, targets[i].Canonical)
		right := progressionTargetOrder(targets[j].Key, targets[j].Canonical)
		if left != right {
			return left < right
		}
		return targets[i].Key < targets[j].Key
	})
	return targets, nil
}

func buildProgressionChoices(
	sessionKey string,
	state *api.PlanProgressionState,
	beforeState json.RawMessage,
	snapshot *api.SessionSnapshot,
	groups []exGroup,
) ([]progressionChoiceTarget, error) {
	groups = progressionGroupsWithSnapshot(groups, snapshot)
	targets, err := buildBlockCompletionChoices(sessionKey, state, beforeState, groups)
	if err != nil || len(targets) > 0 {
		return targets, err
	}
	return buildFailureResetChoices(state, beforeState, groups)
}

func shouldCheckProgressionChoices(sessionKey string, groups []exGroup, requireEditSnapshot bool) bool {
	// History rows do not always retain enough planned-rep metadata locally
	// (notably legacy Greyskull AMRAP rows). Fetch the immutable generated
	// snapshot before deciding so an edit cannot silently bypass its threshold.
	if requireEditSnapshot {
		return true
	}
	if isPotentialBlockCompletionSession(sessionKey) {
		return true
	}
	return len(failedProgressionRefs(groups)) > 0
}

func (l Log) openProgressionWeightPicker() tea.Cmd {
	flow := l.progressionChoice
	if flow == nil || flow.index < 0 || flow.index >= len(flow.targets) {
		return nil
	}
	target := flow.targets[flow.index]
	initial := target.RecommendedWorkKg
	if decision, ok := flow.decisions[target.Key]; ok {
		initial = decision.WorkKg
	}
	prompt := fmt.Sprintf("%s 다음 무게 kg (현재 %s · 추천 %s) ", target.Label, trimNum(target.CurrentWorkKg), trimNum(target.RecommendedWorkKg))
	return func() tea.Msg {
		return openPickerMsg{
			prompt: prompt, tag: "progression-weight", initial: trimNum(initial),
			owner: vToday, owned: true,
		}
	}
}

func progressionDecisionMode(current, next float64) string {
	if next > current {
		return "increase"
	}
	if next < current {
		return "reset"
	}
	return "hold"
}

func progressionChoiceSummary(flow *progressionChoiceFlow) string {
	if flow == nil {
		return ""
	}
	parts := make([]string, 0, len(flow.targets))
	for _, target := range flow.targets {
		decision, ok := flow.decisions[target.Key]
		if !ok {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s %skg", target.Label, trimNum(decision.WorkKg)))
	}
	return strings.Join(parts, " · ")
}

func (l Log) handleProgressionWeightPicked(value string) (Log, tea.Cmd) {
	flow := l.progressionChoice
	if flow == nil || flow.index < 0 || flow.index >= len(flow.targets) {
		return l, nil
	}
	next, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil || math.IsNaN(next) || math.IsInf(next, 0) || next < 0 || next > 500 {
		l.status, l.statusErr = "다음 무게는 0..500kg 숫자로 입력하세요", true
		return l, l.openProgressionWeightPicker()
	}
	next = snapProgressionWeight(next)
	target := flow.targets[flow.index]
	flow.decisions[target.Key] = api.ProgressionTargetDecision{
		Mode: progressionDecisionMode(target.CurrentWorkKg, next), WorkKg: next,
	}
	flow.index++
	l.status, l.statusErr = "", false
	if flow.index < len(flow.targets) {
		return l, l.openProgressionWeightPicker()
	}

	confirmed := progressionChoiceConfirmedMsg{
		planID: flow.planID, sessionKey: flow.sessionKey, editID: flow.editID,
		decisions: cloneProgressionDecisions(flow.decisions),
	}
	summary := progressionChoiceSummary(flow)
	return l, func() tea.Msg {
		return confirmMsg{
			prompt:   summary + " · 이 무게로 저장?",
			yesLabel: "저장", noLabel: "다시설정", cancelLabel: "취소",
			onYes:    func() tea.Msg { return confirmed },
			onNo:     func() tea.Msg { return progressionChoiceRestartMsg{} },
			onCancel: func() tea.Msg { return progressionChoiceCancelledMsg{} },
		}
	}
}
