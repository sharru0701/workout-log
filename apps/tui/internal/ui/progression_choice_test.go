package ui

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
)

func progressionChoiceState(
	t *testing.T,
	program string,
	targets map[string]progressionRuntimeTarget,
	rules map[string]api.ProgressionEffectiveRule,
) *api.PlanProgressionState {
	t.Helper()
	raw, err := json.Marshal(progressionRuntimeState{Targets: targets})
	if err != nil {
		t.Fatal(err)
	}
	return &api.PlanProgressionState{
		Program: &program, State: raw, EffectiveRules: rules,
	}
}

func progressionRule(target string, increase float64) api.ProgressionEffectiveRule {
	return api.ProgressionEffectiveRule{
		ProgressionTarget: target,
		IncreaseKg:        api.Float64(increase),
	}
}

func completedProgressionGroup(target string, planned, actual int) exGroup {
	return exGroup{
		name: target, progressionTarget: target,
		sets: []setEntry{{done: true, tgtReps: planned, reps: trimNum(float64(actual))}},
	}
}

func failedProgressionGroup(name, key, target string, planned, actual int) exGroup {
	return exGroup{
		name: name, progressionKey: key, progressionTarget: target,
		sets: []setEntry{{done: true, prescribed: true, tgtReps: planned, reps: trimNum(float64(actual))}},
	}
}

func TestBuildBlockCompletionChoicesMatchesOperatorDefaults(t *testing.T) {
	state := progressionChoiceState(t, "operator", map[string]progressionRuntimeTarget{
		"EX_PULL_UP":     {ProgressionTarget: "PULL", WorkKg: 20},
		"EX_DEADLIFT":    {ProgressionTarget: "DEADLIFT", WorkKg: 120},
		"EX_BENCH_PRESS": {ProgressionTarget: "BENCH", WorkKg: 80},
		"EX_BACK_SQUAT":  {ProgressionTarget: "SQUAT", WorkKg: 100},
	}, map[string]api.ProgressionEffectiveRule{
		"EX_PULL_UP":     progressionRule("PULL", 2.5),
		"EX_DEADLIFT":    progressionRule("DEADLIFT", 5),
		"EX_BENCH_PRESS": progressionRule("BENCH", 2.5),
		"EX_BACK_SQUAT":  progressionRule("SQUAT", 5),
	})
	targets, err := buildBlockCompletionChoices("C3W6D3", state, nil, []exGroup{
		completedProgressionGroup("SQUAT", 1, 1),
		completedProgressionGroup("BENCH", 1, 1),
		completedProgressionGroup("DEADLIFT", 1, 1),
	})
	if err != nil {
		t.Fatal(err)
	}
	wantCanonical := []string{"SQUAT", "BENCH", "DEADLIFT", "PULL"}
	wantNext := []float64{105, 82.5, 125, 22.5}
	if len(targets) != len(wantCanonical) {
		t.Fatalf("targets = %#v", targets)
	}
	for i := range targets {
		if targets[i].Canonical != wantCanonical[i] || targets[i].RecommendedWorkKg != wantNext[i] {
			t.Errorf("target[%d] = %#v, want %s -> %g", i, targets[i], wantCanonical[i], wantNext[i])
		}
	}
}

func TestBuildBlockCompletionChoicesFreezesAllForUnresolvedFailure(t *testing.T) {
	state := progressionChoiceState(t, "operator", map[string]progressionRuntimeTarget{
		"SQUAT": {ProgressionTarget: "SQUAT", WorkKg: 100},
		"PULL":  {ProgressionTarget: "PULL", WorkKg: 20, FailureStreak: 1},
	}, map[string]api.ProgressionEffectiveRule{
		"SQUAT": progressionRule("SQUAT", 5),
		"PULL":  progressionRule("PULL", 2.5),
	})
	targets, err := buildBlockCompletionChoices("C3W6D3", state, nil, []exGroup{
		completedProgressionGroup("SQUAT", 1, 1),
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, target := range targets {
		if target.RecommendedWorkKg != target.CurrentWorkKg {
			t.Errorf("unresolved failure did not freeze %#v", target)
		}
	}
}

func TestBuildBlockCompletionChoicesUsesPreEditState(t *testing.T) {
	state := progressionChoiceState(t, "operator", map[string]progressionRuntimeTarget{
		"SQUAT": {ProgressionTarget: "SQUAT", WorkKg: 107.5},
	}, map[string]api.ProgressionEffectiveRule{
		"SQUAT": progressionRule("SQUAT", 5),
	})
	before, err := json.Marshal(progressionRuntimeState{Targets: map[string]progressionRuntimeTarget{
		"SQUAT": {ProgressionTarget: "SQUAT", WorkKg: 102.5},
	}})
	if err != nil {
		t.Fatal(err)
	}
	targets, err := buildBlockCompletionChoices("C3W6D3", state, before, []exGroup{
		completedProgressionGroup("SQUAT", 1, 1),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(targets) != 1 || targets[0].CurrentWorkKg != 102.5 || targets[0].RecommendedWorkKg != 107.5 {
		t.Fatalf("edit choice used advanced state: %#v", targets)
	}
}

func TestCurrentSuccessClearsPriorFailureForRecommendation(t *testing.T) {
	state := progressionChoiceState(t, "operator", map[string]progressionRuntimeTarget{
		"SQUAT": {ProgressionTarget: "SQUAT", WorkKg: 100, FailureStreak: 1},
	}, map[string]api.ProgressionEffectiveRule{
		"SQUAT": progressionRule("SQUAT", 5),
	})
	targets, err := buildBlockCompletionChoices("C3W6D3", state, nil, []exGroup{
		completedProgressionGroup("SQUAT", 1, 1),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(targets) != 1 || targets[0].RecommendedWorkKg != 105 {
		t.Fatalf("current success did not clear prior failure: %#v", targets)
	}
}

func TestBuildBlockCompletionChoicesSupportsWendlerAndSkipsAssistance(t *testing.T) {
	state := progressionChoiceState(t, "wendler-531", map[string]progressionRuntimeTarget{
		"SQUAT": {ProgressionTarget: "SQUAT", WorkKg: 100},
		"OHP":   {ProgressionTarget: "OHP", WorkKg: 50},
	}, map[string]api.ProgressionEffectiveRule{
		"SQUAT": progressionRule("SQUAT", 5),
		"OHP":   progressionRule("OHP", 2.5),
	})
	assist := failedProgressionGroup("BBB Squat", "", "SQUAT", 10, 0)
	snapshot := &api.SessionSnapshot{Exercises: []api.PlannedExercise{
		{ExerciseName: "SQUAT", ProgressionKey: "SQUAT", ProgressionTarget: "SQUAT", Sets: []api.PlannedSet{{Reps: 5}}},
		{ExerciseName: "OHP", ProgressionKey: "OHP", ProgressionTarget: "OHP", Sets: []api.PlannedSet{{Reps: 5}}},
		{ExerciseName: "BBB Squat", ProgressionTarget: "SQUAT", SkipProgression: true, Sets: []api.PlannedSet{{Reps: 10}}},
	}}
	targets, err := buildProgressionChoices("C2W4D4", state, nil, snapshot, []exGroup{
		completedProgressionGroup("SQUAT", 5, 5),
		completedProgressionGroup("OHP", 5, 5),
		assist,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(targets) != 2 || targets[0].Canonical != "SQUAT" || targets[0].RecommendedWorkKg != 105 ||
		targets[1].Canonical != "OHP" || targets[1].RecommendedWorkKg != 52.5 {
		t.Fatalf("wendler choices = %#v", targets)
	}
}

func TestBuildFailureResetChoicesMatchesWebThresholds(t *testing.T) {
	tests := []struct {
		name, program, key, target, exercise string
		failureStreak                        int
	}{
		{name: "greyskull second miss", program: "greyskull-lp", key: "SQUAT", target: "SQUAT", exercise: "Back Squat", failureStreak: 1},
		{name: "starting strength third miss", program: "starting-strength-lp", key: "SQUAT", target: "SQUAT", exercise: "Back Squat", failureStreak: 2},
		{name: "stronglifts third miss", program: "stronglifts-5x5", key: "BENCH", target: "BENCH", exercise: "Bench Press", failureStreak: 2},
		{name: "texas intensity third miss", program: "texas-method", key: "I_s0", target: "SQUAT", exercise: "Back Squat", failureStreak: 2},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			state := progressionChoiceState(t, tc.program, map[string]progressionRuntimeTarget{
				tc.key: {ProgressionTarget: tc.target, WorkKg: 100, FailureStreak: tc.failureStreak},
			}, map[string]api.ProgressionEffectiveRule{
				tc.key: progressionRule(tc.target, 2.5),
			})
			targets, err := buildProgressionChoices("D1", state, nil, nil, []exGroup{
				failedProgressionGroup(tc.exercise, tc.key, tc.target, 5, 4),
			})
			if err != nil {
				t.Fatal(err)
			}
			if len(targets) != 1 || targets[0].Key != tc.key || targets[0].RecommendedWorkKg != 90 {
				t.Fatalf("reset choices = %#v", targets)
			}
		})
	}
}

func TestFailureResetChoiceWaitsForThresholdAndHonorsAbsoluteDecrease(t *testing.T) {
	decrease := api.Float64(7.5)
	state := progressionChoiceState(t, "greyskull-lp", map[string]progressionRuntimeTarget{
		"SQUAT": {ProgressionTarget: "SQUAT", WorkKg: 100, FailureStreak: 0},
	}, map[string]api.ProgressionEffectiveRule{
		"SQUAT": {
			ProgressionTarget: "SQUAT", IncreaseKg: 2.5, DecreaseKg: &decrease, ResetFactor: 0.9,
		},
	})
	groups := []exGroup{failedProgressionGroup("Back Squat", "SQUAT", "SQUAT", 5, 4)}
	targets, err := buildProgressionChoices("D1", state, nil, nil, groups)
	if err != nil {
		t.Fatal(err)
	}
	if len(targets) != 0 {
		t.Fatalf("first Greyskull miss opened reset choices: %#v", targets)
	}
	stateTarget := progressionRuntimeTarget{ProgressionTarget: "SQUAT", WorkKg: 100, FailureStreak: 1}
	raw, err := json.Marshal(progressionRuntimeState{Targets: map[string]progressionRuntimeTarget{"SQUAT": stateTarget}})
	if err != nil {
		t.Fatal(err)
	}
	state.State = raw
	targets, err = buildProgressionChoices("D1", state, nil, nil, groups)
	if err != nil {
		t.Fatal(err)
	}
	if len(targets) != 1 || targets[0].RecommendedWorkKg != 92.5 {
		t.Fatalf("absolute decrease was not honored: %#v", targets)
	}
}

func TestFailureResetChoiceUsesSnapshotAndPreEditState(t *testing.T) {
	state := progressionChoiceState(t, "texas-method", map[string]progressionRuntimeTarget{
		"I_s0": {ProgressionTarget: "SQUAT", WorkKg: 90},
	}, map[string]api.ProgressionEffectiveRule{
		"I_s0": progressionRule("SQUAT", 5),
	})
	before, err := json.Marshal(progressionRuntimeState{Targets: map[string]progressionRuntimeTarget{
		"I_s0": {ProgressionTarget: "SQUAT", WorkKg: 100, FailureStreak: 2},
	}})
	if err != nil {
		t.Fatal(err)
	}
	snapshot := &api.SessionSnapshot{Exercises: []api.PlannedExercise{{
		ExerciseName: "Back Squat", ProgressionKey: "I_s0", ProgressionTarget: "SQUAT",
		Sets: []api.PlannedSet{{SetNumber: 1, Reps: 5}},
	}}}
	groups := []exGroup{{name: "Back Squat", sets: []setEntry{{setNumber: 1, reps: "4", done: true}}}}
	targets, err := buildProgressionChoices("D3", state, before, snapshot, groups)
	if err != nil {
		t.Fatal(err)
	}
	if len(targets) != 1 || targets[0].Key != "I_s0" || targets[0].CurrentWorkKg != 100 || targets[0].RecommendedWorkKg != 90 {
		t.Fatalf("edited reset choices = %#v", targets)
	}
}

func TestProgressionChoiceTriggerIgnoresExcludedFailure(t *testing.T) {
	group := failedProgressionGroup("Recovery Squat", "", "SQUAT", 5, 0)
	group.skipProgression = true
	if shouldCheckProgressionChoices("D2", []exGroup{group}, false) {
		t.Fatal("progression-excluded prescription opened a choice flow")
	}
	if !shouldCheckProgressionChoices("D2", []exGroup{group}, true) {
		t.Fatal("history edit did not request its immutable prescription snapshot")
	}
}

func TestFailureResetChoiceFlowsIntoSaveRequest(t *testing.T) {
	var posted api.CreateLogRequest
	mux := http.NewServeMux()
	mux.HandleFunc("/api/logs", func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&posted); err != nil {
			t.Errorf("decode save request: %v", err)
		}
		writeUITestJSON(t, w, map[string]any{"log": map[string]any{"id": "saved-reset"}})
	})
	mux.HandleFunc("/api/logs/saved-reset", func(w http.ResponseWriter, _ *http.Request) {
		writeUITestJSON(t, w, map[string]any{"item": map[string]any{
			"id": "saved-reset", "performedAt": time.Now(), "sets": []any{},
		}})
	})
	client := newUITestClient(t, mux)
	state := progressionChoiceState(t, "greyskull-lp", map[string]progressionRuntimeTarget{
		"SQUAT": {ProgressionTarget: "SQUAT", WorkKg: 100, FailureStreak: 1},
	}, map[string]api.ProgressionEffectiveRule{
		"SQUAT": progressionRule("SQUAT", 2.5),
	})

	l := NewLog(client)
	l.load, l.planID, l.sessionKey, l.generatedSessionID = loadIdle, "plan-1", "D1", "generated-1"
	l.groups = []exGroup{failedProgressionGroup("Back Squat", "SQUAT", "SQUAT", 5, 4)}
	l.groups[0].sets[0].weight = "100"
	l.progressionChoiceLoading = true
	screen, pickerCmd := l.Update(progressionChoiceLoadedMsg{
		planID: "plan-1", sessionKey: "D1", state: state,
	})
	next := screen.(Log)
	if pickerCmd == nil || next.progressionChoice == nil {
		t.Fatalf("choice flow did not open: status=%q", next.status)
	}
	picker, ok := pickerCmd().(openPickerMsg)
	if !ok || picker.initial != "90" {
		t.Fatalf("reset picker = %#v", picker)
	}

	next, confirmCmd := next.handleProgressionWeightPicked("92.5")
	confirm, ok := confirmCmd().(confirmMsg)
	if !ok || confirm.onYes == nil {
		t.Fatalf("choice confirmation = %#v", confirm)
	}
	screen, saveCmd := next.Update(confirm.onYes())
	next = screen.(Log)
	if saveCmd == nil || !next.saving {
		t.Fatalf("confirmed choice did not start save: status=%q", next.status)
	}
	result, ok := saveCmd().(saveResultMsg)
	if !ok || result.err != nil {
		t.Fatalf("save result = %#v", result)
	}
	decision, ok := posted.ProgressionTargetDecisions["SQUAT"]
	if !ok || decision.Mode != "reset" || decision.WorkKg != 92.5 {
		t.Fatalf("posted progression decision = %#v", posted.ProgressionTargetDecisions)
	}
}
