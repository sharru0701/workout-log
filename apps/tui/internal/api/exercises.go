package api

import (
	"context"
	"net/url"
)

// Exercise is a canonical exercise from the dictionary.
type Exercise struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
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
