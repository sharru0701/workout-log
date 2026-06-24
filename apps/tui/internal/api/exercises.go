package api

import (
	"context"
	"net/url"
)

// Exercise is a canonical exercise from the dictionary.
type Exercise struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Category string   `json:"category"`
	Aliases  []string `json:"aliases,omitempty"`
}

// Exercises searches the exercise dictionary (empty query = all, up to 200).
func (c *Client) Exercises(ctx context.Context, query string) ([]Exercise, error) {
	q := url.Values{}
	if query != "" {
		q.Set("query", query)
	}
	q.Set("limit", "200")
	var out struct {
		Items []Exercise `json:"items"`
	}
	if err := c.do(ctx, "GET", "/api/exercises?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

// CreateExercise adds a canonical exercise and returns its id (idempotent: an
// existing name returns that row's id with created=false on the server).
func (c *Client) CreateExercise(ctx context.Context, name string) (string, error) {
	var out struct {
		Exercise struct {
			ID string `json:"id"`
		} `json:"exercise"`
	}
	if err := c.do(ctx, "POST", "/api/exercises", map[string]string{"name": name}, &out); err != nil {
		return "", err
	}
	return out.Exercise.ID, nil
}

// RenameExercise changes a canonical exercise's name (409 if the name collides).
func (c *Client) RenameExercise(ctx context.Context, id, name string) error {
	return c.do(ctx, "PATCH", "/api/exercises/"+id, map[string]string{"name": name}, nil)
}

// DeleteExercise removes a canonical exercise from the dictionary.
func (c *Client) DeleteExercise(ctx context.Context, id string) error {
	return c.do(ctx, "DELETE", "/api/exercises/"+id, nil, nil)
}

// AddAlias maps an alias name onto an exercise (409 if already mapped elsewhere).
func (c *Client) AddAlias(ctx context.Context, exerciseID, alias string) error {
	return c.do(ctx, "POST", "/api/exercises/alias", map[string]string{
		"exerciseId": exerciseID,
		"alias":      alias,
	}, nil)
}
