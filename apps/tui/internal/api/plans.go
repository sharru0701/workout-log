package api

import "context"

// Plan is a user's training plan.
type Plan struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	BaseProgramName string `json:"baseProgramName"`
}

// Plans lists the user's plans.
func (c *Client) Plans(ctx context.Context) ([]Plan, error) {
	var out struct {
		Items []Plan `json:"items"`
	}
	if err := c.do(ctx, "GET", "/api/plans", nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

// DeletePlan removes a plan and its logs.
func (c *Client) DeletePlan(ctx context.Context, id string) error {
	return c.do(ctx, "DELETE", "/api/plans/"+id, nil, nil)
}

// PlannedSet is one prescribed set in a generated session snapshot.
type PlannedSet struct {
	Reps           int     `json:"reps"`
	TargetWeightKg Float64 `json:"targetWeightKg"`
}

// PlannedExercise is one exercise in a generated session snapshot.
type PlannedExercise struct {
	ExerciseName string       `json:"exerciseName"`
	Role         string       `json:"role"`
	Sets         []PlannedSet `json:"sets"`
}

// SessionSnapshot is the materialized planned session.
type SessionSnapshot struct {
	Exercises []PlannedExercise `json:"exercises"`
}

// GeneratedSession wraps the snapshot returned by POST /api/plans/[id]/generate.
type GeneratedSession struct {
	Snapshot SessionSnapshot `json:"snapshot"`
}

// GenerateSession generates (and saves) today's session for a plan.
func (c *Client) GenerateSession(ctx context.Context, planID string) (*GeneratedSession, error) {
	var out struct {
		Session GeneratedSession `json:"session"`
	}
	if err := c.do(ctx, "POST", "/api/plans/"+planID+"/generate", map[string]any{}, &out); err != nil {
		return nil, err
	}
	return &out.Session, nil
}
