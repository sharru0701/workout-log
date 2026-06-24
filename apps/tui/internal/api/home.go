package api

import (
	"context"
	"net/url"
)

// HomeData is the /api/home dashboard payload (subset consumed by the TUI).
type HomeData struct {
	Today struct {
		ProgramName      string `json:"programName"`
		HasPlan          bool   `json:"hasPlan"`
		Meta             string `json:"meta"`
		CompletedSets    int    `json:"completedSets"`
		TotalPlannedSets int    `json:"totalPlannedSets"`
		PlannedExercises []struct {
			Name      string `json:"name"`
			Role      string `json:"role"`
			TotalSets int    `json:"totalSets"`
			Summary   string `json:"summary"`
		} `json:"plannedExercises"`
	} `json:"today"`
	WeeklySummary struct {
		ActiveDays int `json:"activeDays"`
		Days       []struct {
			ShortLabel string `json:"shortLabel"`
			HasWorkout bool   `json:"hasWorkout"`
			IsToday    bool   `json:"isToday"`
		} `json:"days"`
	} `json:"weeklySummary"`
	StrengthProgress []struct {
		ExerciseName string  `json:"exerciseName"`
		BestE1rm     Float64 `json:"bestE1rm"`
		LatestE1rm   Float64 `json:"latestE1rm"`
		Improvement  Float64 `json:"improvement"`
		Trend        string  `json:"trend"`
	} `json:"strengthProgress"`
	VolumeTrend []struct {
		Label   string  `json:"label"`
		Tonnage Float64 `json:"tonnage"`
		Sets    int     `json:"sets"`
	} `json:"volumeTrend"`
	QuickStats struct {
		TotalSessions     int     `json:"totalSessions"`
		TotalVolume       Float64 `json:"totalVolume"`
		CurrentStreak     int     `json:"currentStreak"`
		ThisMonthSessions int     `json:"thisMonthSessions"`
	} `json:"quickStats"`
	RecentSessions []struct {
		Title       string `json:"title"`
		Subtitle    string `json:"subtitle"`
		Description string `json:"description"`
	} `json:"recentSessions"`
}

// Home fetches the dashboard payload. timezone is an IANA name (optional).
func (c *Client) Home(ctx context.Context, timezone string) (*HomeData, error) {
	path := "/api/home?recentLimit=3"
	if timezone != "" {
		path += "&timezone=" + url.QueryEscape(timezone)
	}
	var out HomeData
	if err := c.do(ctx, "GET", path, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
