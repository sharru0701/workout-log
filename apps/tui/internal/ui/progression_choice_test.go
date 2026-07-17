package ui

import (
	"encoding/json"
	"testing"

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
