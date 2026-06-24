package api

import "context"

// ChangePassword updates the account password. The server verifies the current
// password, requires the new one to be ≥8 chars and different from the current,
// then rotates the session: all sessions are revoked and a fresh cookie is
// issued on this response — the client jar absorbs it, so the session stays
// valid without a re-login.
func (c *Client) ChangePassword(ctx context.Context, current, next string) error {
	return c.do(ctx, "POST", "/api/auth/password", map[string]string{
		"currentPassword": current,
		"newPassword":     next,
	}, nil)
}

// DeleteAccount permanently deletes the account and all personal data after
// re-confirming the password. The session cookie is cleared on success; callers
// should return to the login gate.
func (c *Client) DeleteAccount(ctx context.Context, password string) error {
	return c.do(ctx, "DELETE", "/api/auth/account", map[string]string{
		"confirmToken": "DELETE_MY_ACCOUNT",
		"password":     password,
	}, nil)
}
