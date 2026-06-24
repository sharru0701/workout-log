package api

import (
	"context"
	"fmt"
	"net/url"
)

// E1rmPoint is one day's best estimated 1RM for an exercise.
type E1rmPoint struct {
	Date     string  `json:"date"`
	E1rm     Float64 `json:"e1rm"`
	WeightKg Float64 `json:"weightKg"`
	Reps     int     `json:"reps"`
}

// E1rmResult is the /api/stats/e1rm payload.
type E1rmResult struct {
	Exercise  string      `json:"exercise"`
	RangeDays int         `json:"rangeDays"`
	Best      *E1rmPoint  `json:"best"`
	Series    []E1rmPoint `json:"series"`
}

// E1rm fetches the estimated-1RM series for an exercise over rangeDays (0=all).
func (c *Client) E1rm(ctx context.Context, exercise string, rangeDays int) (*E1rmResult, error) {
	q := url.Values{}
	q.Set("exercise", exercise)
	q.Set("rangeDays", fmt.Sprintf("%d", rangeDays))
	var out E1rmResult
	if err := c.do(ctx, "GET", "/api/stats/e1rm?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// PrItem is a server-detected personal record (from the stats bundle).
type PrItem struct {
	ExerciseName string `json:"exerciseName"`
	Best         struct {
		E1rm     Float64 `json:"e1rm"`
		WeightKg Float64 `json:"weightKg"`
		Reps     int     `json:"reps"`
	} `json:"best"`
	Improvement Float64 `json:"improvement"`
}

// StatsBundle is the /api/stats/bundle payload (sessions/volume + top PRs).
type StatsBundle struct {
	Sessions30d int      `json:"sessions30d"`
	Tonnage30d  Float64  `json:"tonnage30d"`
	Prs90d      []PrItem `json:"prs90d"`
}

// Bundle fetches the comprehensive stats bundle over `days`.
func (c *Client) Bundle(ctx context.Context, days int) (*StatsBundle, error) {
	var out StatsBundle
	if err := c.do(ctx, "GET", fmt.Sprintf("/api/stats/bundle?days=%d", days), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// VolumePoint is one bucket's training volume (tonnage = Σ weight×reps).
type VolumePoint struct {
	Period  string  `json:"period"`
	Tonnage Float64 `json:"tonnage"`
	Reps    int     `json:"reps"`
	Sets    int     `json:"sets"`
}

// VolumeSeries is the /api/stats/volume-series payload (weekly buckets).
type VolumeSeries struct {
	Bucket string        `json:"bucket"`
	Series []VolumePoint `json:"series"`
}

// VolumeSeries fetches weekly training-volume buckets over rangeDays (0 = the
// server's default window).
func (c *Client) VolumeSeries(ctx context.Context, rangeDays int) (*VolumeSeries, error) {
	q := url.Values{}
	q.Set("bucket", "week")
	if rangeDays > 0 {
		q.Set("rangeDays", fmt.Sprintf("%d", rangeDays))
	}
	var out VolumeSeries
	if err := c.do(ctx, "GET", "/api/stats/volume-series?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
