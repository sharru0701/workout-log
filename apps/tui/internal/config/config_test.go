package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefaultBase(t *testing.T) {
	if defaultBase == "" {
		t.Fatal("defaultBase must not be empty (release builds inject production via -ldflags)")
	}
	t.Logf("defaultBase (runtime) = %q", defaultBase)
}

func TestSaveBaseURL(t *testing.T) {
	dir := t.TempDir()
	c := Config{dir: dir}

	// trailing slash is trimmed on save
	if err := c.SaveBaseURL("https://prod.example.com/"); err != nil {
		t.Fatalf("SaveBaseURL: %v", err)
	}
	b, err := os.ReadFile(filepath.Join(dir, baseURLFile))
	if err != nil {
		t.Fatalf("read back: %v", err)
	}
	if string(b) != "https://prod.example.com" {
		t.Errorf("saved = %q, want https://prod.example.com", b)
	}

	// empty clears the saved value
	if err := c.SaveBaseURL("  "); err != nil {
		t.Fatalf("SaveBaseURL(clear): %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, baseURLFile)); !os.IsNotExist(err) {
		t.Error("empty url should remove the base_url file")
	}
	// clearing an already-absent file is not an error
	if err := c.SaveBaseURL(""); err != nil {
		t.Errorf("clearing absent file should not error: %v", err)
	}
}

func TestDraftRoundTrip(t *testing.T) {
	c := Config{dir: t.TempDir()}

	// absent draft is (nil, nil), and clearing it is not an error
	if b, err := c.LoadDraft(); b != nil || err != nil {
		t.Fatalf("LoadDraft(absent) = %v, %v; want nil, nil", b, err)
	}
	if err := c.ClearDraft(); err != nil {
		t.Fatalf("ClearDraft(absent): %v", err)
	}

	want := []byte(`{"date":"2026-07-06"}`)
	if err := c.SaveDraft(want); err != nil {
		t.Fatalf("SaveDraft: %v", err)
	}
	got, err := c.LoadDraft()
	if err != nil || string(got) != string(want) {
		t.Fatalf("LoadDraft = %q, %v; want %q", got, err, want)
	}
	// atomic write leaves no tmp file behind
	if _, err := os.Stat(filepath.Join(c.dir, draftFile+".tmp")); !os.IsNotExist(err) {
		t.Error("SaveDraft must not leave a .tmp file")
	}

	if err := c.ClearDraft(); err != nil {
		t.Fatalf("ClearDraft: %v", err)
	}
	if b, _ := c.LoadDraft(); b != nil {
		t.Error("draft should be gone after ClearDraft")
	}
}
