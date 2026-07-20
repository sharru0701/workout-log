package selfupdate

import (
	"os"
	"strings"
	"testing"
	"text/template"
)

// archiveName() hand-copies the release archive naming rules that
// .goreleaser.yaml owns. Nothing links the two: change the name_template and
// self-update keeps requesting the old filename, so every installed binary
// starts 404ing on update while the release itself looks fine. TestArchiveName
// does not catch that either — its expectations are hard-coded, so it stays
// consistent with the code and wrong about reality.
//
// This test derives the expectation from the config instead: it renders the
// actual name_template and compares it against archiveName().

const goreleaserConfig = "../../.goreleaser.yaml"

type archiveNaming struct {
	nameTemplate  string
	defaultFormat string
	osFormats     map[string]string // goos -> format override
}

// parseArchiveNaming pulls the archive naming rules out of .goreleaser.yaml.
// It is deliberately a small line scanner rather than a YAML dependency: the
// only shapes it must understand are the ones this config actually uses, and a
// parse failure fails the test loudly rather than silently passing.
func parseArchiveNaming(t *testing.T, raw string) archiveNaming {
	t.Helper()
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")

	out := archiveNaming{osFormats: map[string]string{}}
	indent := func(s string) int { return len(s) - len(strings.TrimLeft(s, " ")) }

	for i := 0; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])

		// Folded block scalar: `name_template: >-` followed by more-indented
		// lines. YAML folds those into one line joined by single spaces; Go's
		// `{{-` trim markers then remove that whitespace, exactly as GoReleaser
		// evaluates it. (checksum.name_template is inline, so it never matches.)
		if strings.HasPrefix(trimmed, "name_template:") && strings.Contains(trimmed, ">") {
			base := indent(lines[i])
			var parts []string
			for j := i + 1; j < len(lines); j++ {
				if strings.TrimSpace(lines[j]) == "" {
					break
				}
				if indent(lines[j]) <= base {
					break
				}
				parts = append(parts, strings.TrimSpace(lines[j]))
			}
			if out.nameTemplate == "" {
				out.nameTemplate = strings.Join(parts, " ")
			}
			continue
		}

		// `formats:` directly under the archive is the default; one that follows
		// a `goos: <x>` line inside format_overrides applies to that OS only.
		if trimmed == "formats:" {
			var value string
			if i+1 < len(lines) {
				value = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(lines[i+1]), "-"))
			}
			if value == "" {
				continue
			}
			overrideOS := ""
			for j := i - 1; j >= 0 && j > i-4; j-- {
				if after, ok := strings.CutPrefix(strings.TrimSpace(lines[j]), "- goos:"); ok {
					overrideOS = strings.TrimSpace(after)
					break
				}
			}
			if overrideOS != "" {
				out.osFormats[overrideOS] = value
			} else if out.defaultFormat == "" {
				out.defaultFormat = value
			}
		}
	}
	return out
}

func TestArchiveNameMatchesGoreleaserConfig(t *testing.T) {
	raw, err := os.ReadFile(goreleaserConfig)
	if err != nil {
		t.Fatalf("read %s: %v", goreleaserConfig, err)
	}
	naming := parseArchiveNaming(t, string(raw))

	if naming.nameTemplate == "" {
		t.Fatal("no folded archives.name_template found — the parser needs updating for the new config shape")
	}
	if naming.defaultFormat == "" {
		t.Fatal("no default archives.formats entry found")
	}

	tmpl, err := template.New("name").Parse(naming.nameTemplate)
	if err != nil {
		t.Fatalf("parse name_template %q: %v", naming.nameTemplate, err)
	}

	const version = "0.3.2"
	for _, c := range []struct{ goos, goarch string }{
		{"linux", "amd64"},
		{"linux", "arm64"},
		{"darwin", "amd64"},
		{"darwin", "arm64"},
		{"windows", "amd64"},
		{"windows", "arm64"},
	} {
		var stem strings.Builder
		if err := tmpl.Execute(&stem, struct{ Version, Os, Arch string }{version, c.goos, c.goarch}); err != nil {
			t.Fatalf("execute name_template for %s/%s: %v", c.goos, c.goarch, err)
		}
		format := naming.defaultFormat
		if override, ok := naming.osFormats[c.goos]; ok {
			format = override
		}
		want := stem.String() + "." + format

		if got := archiveName(version, c.goos, c.goarch); got != want {
			t.Errorf(
				"archiveName(%s, %s, %s) = %q, but .goreleaser.yaml produces %q — "+
					"self-update would request a file the release does not publish",
				version, c.goos, c.goarch, got, want,
			)
		}
	}
}

// The parser must fail loudly if the config stops looking the way it assumes,
// rather than silently finding nothing and passing.
func TestParseArchiveNamingReadsFoldedTemplate(t *testing.T) {
	naming := parseArchiveNaming(t, strings.Join([]string{
		"archives:",
		"  - id: ironlog",
		"    name_template: >-",
		"      demo_{{ .Version }}_",
		`      {{- if eq .Os "darwin" }}macos{{- else }}{{ .Os }}{{- end }}_{{ .Arch }}`,
		"    formats:",
		"      - tar.gz",
		"    format_overrides:",
		"      - goos: windows",
		"        formats:",
		"          - zip",
		"",
	}, "\n"))

	if !strings.HasPrefix(naming.nameTemplate, "demo_{{ .Version }}_") {
		t.Errorf("nameTemplate = %q", naming.nameTemplate)
	}
	if naming.defaultFormat != "tar.gz" {
		t.Errorf("defaultFormat = %q, want tar.gz", naming.defaultFormat)
	}
	if naming.osFormats["windows"] != "zip" {
		t.Errorf("windows override = %q, want zip", naming.osFormats["windows"])
	}
}
