package ui

// log.go — 오늘 버퍼(Log)의 진입점: 모델 구조체 + Screen 인터페이스 메서드 + Update 디스패처.
// 순수 헬퍼는 log_model.go, Tea 커맨드는 log_commands.go, 키 처리·변이는 log_update.go,
// 렌더링은 log_view.go (god-component 분해 3단계).

import (
	"fmt"
	"strings"
	"time"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

// Log is the today buffer: exercises grouped (a section header per exercise),
// each holding its sets. Navigate sets with j/k, cells (weight/reps) with h/l,
// edit inline in INSERT. `e` starts a new exercise.
type Log struct {
	client      *api.Client
	drafts      draftStore // crash-recovery persistence for unsaved sets (nil = off)
	groups      []exGroup
	gi, si      int // active group / set index
	col         logCol
	editing     bool
	target      editTarget
	edit        textinput.Model
	saving      bool
	editID      string        // non-empty when editing a past log (saves via PATCH)
	performedAt time.Time     // preserved on edit; zero = now (new log)
	planName    string        // active plan/program name for today's session header
	sessionKey  string        // generated-session key (e.g. "C2W6D1") for the header label
	planID      string        // active plan id, for session overrides (보강/교체)
	pendAccsry  string        // accessory exercise awaiting its sets input (override flow)
	pendBlock   string        // block target awaiting its replacement exercise (override flow)
	bodyweight  float64       // user bodyweight (kg) for bodyweight-exercise load math
	load        loadState     // boot-time auto-load of today's session
	undo        *undoSnapshot // last delete, restorable with `u`
	// v0.5.1 피드백: 세션 태그(스냅샷 승격 메타)와 저장 직후 판정 라인(서버 조립 문구).
	amrapDeferred bool     // 오늘 AMRAP 보류(연속일) — 헤더 태그
	lightBlock    bool     // 라이트(회복) 블록 — 헤더 태그
	feedback      []string // 저장 응답의 판정 카드/배너 라인(styled) — 다음 로드/편집 시 소거
	status        string
	statusErr     bool
	w, h          int
}

// NewLog starts in loadPending so the very first render shows "loading today's
// session" rather than the empty-canvas hint while autoloadCmd runs.
func NewLog(client *api.Client) Log { return Log{client: client, load: loadPending} }

// withDrafts enables crash-recovery draft persistence (frame wiring; tests use
// the zero value = disabled).
func (l Log) withDrafts(d draftStore) Log {
	l.drafts = d
	return l
}

func (l Log) Editing() bool { return l.editing }
func (l Log) Init() tea.Cmd { return autoloadCmd(l.client, l.drafts) }

func (l Log) Mode() Mode {
	switch {
	case l.saving:
		return Mode{Label: "SAVING", Tone: theme.Amber}
	case l.editing:
		return Mode{Label: "INSERT", Tone: theme.Amber}
	case l.load == loadPending:
		return Mode{Label: "LOADING", Tone: theme.Cyan}
	default:
		return ModeNormal
	}
}

func (l Log) Context() string {
	if l.gi >= len(l.groups) {
		return ""
	}
	g := l.groups[l.gi]
	if strings.TrimSpace(g.name) == "" {
		return ""
	}
	return fmt.Sprintf("%s %d/%d", truncate(g.name, 12), l.si+1, len(g.sets))
}

func (l Log) StatusRight() string {
	n := l.doneCount()
	if n == 0 {
		return ""
	}
	return fmt.Sprintf("%d set%s", n, plural(n))
}

func (l Log) Hints() []hintItem {
	if l.editing {
		return []hintItem{{"⏎", "다음"}, {"tab", "셀"}, {"esc", "취소"}}
	}
	h := []hintItem{{"i", "편집"}, {"e", "운동"}, {"s", "저장"}}
	if l.planID != "" && l.sessionKey != "" {
		h = append(h, hintItem{"a", "보강"}, hintItem{"c", "교체"})
	}
	return h
}

func (l Log) doneCount() int {
	n := 0
	for _, g := range l.groups {
		for _, s := range g.sets {
			if s.done {
				n++
			}
		}
	}
	return n
}

func (l Log) Update(msg tea.Msg) (Screen, tea.Cmd) {
	switch m := msg.(type) {
	case tea.WindowSizeMsg:
		l.w, l.h = m.Width, m.Height
		return l, nil
	case saveResultMsg:
		l.saving = false
		verb := "저장"
		if m.edited {
			verb = "수정"
		}
		if m.err != nil {
			l.status, l.statusErr = verb+" 실패: "+humanizeAuthErr(m.err), true
			return l, nil
		}
		// Keep the saved session on screen (done sets only) and switch to PATCH,
		// so it reads as "today's record" instead of a blank canvas; re-saving
		// edits the same log.
		l.status, l.statusErr = summarizeSaved(l.groups, m.detail, m.edited), false
		l.feedback = feedbackLines(m.feedback)
		l.keepDoneOnly()
		if m.detail != nil {
			l.editID = m.detail.ID
		}
		l.performedAt = m.performedAt
		l.load, l.undo = loadIdle, nil
		l.clearDraft() // 서버 상태 == 버퍼 — draft는 역할 종료
		return l, nil
	case editLogMsg:
		l.amrapDeferred, l.lightBlock, l.feedback = false, false, nil
		l.loadForEdit(m)
		return l, nil
	case draftRestoredMsg:
		l.loadFromDraft(m.draft)
		return l, nil
	case pickedMsg:
		switch m.tag {
		case "exercise":
			if strings.TrimSpace(m.value) != "" {
				l.groups = append(l.groups, exGroup{name: m.value, sets: []setEntry{{}}})
				l.gi, l.si, l.col = len(l.groups)-1, 0, colWeight
				l.persistDraft()
				return l.beginEdit(editCell)
			}
		case "accessory":
			if name := strings.TrimSpace(m.value); name != "" {
				l.pendAccsry = name
				l.status, l.statusErr = "보강: "+name, false
				// second step: free-text sets prompt (an item-less picker returns
				// whatever the user types).
				return l, func() tea.Msg {
					return openPickerMsg{prompt: "세트 (예 3x10@20) ", tag: "accessory-sets"}
				}
			}
		case "accessory-sets":
			name := l.pendAccsry
			l.pendAccsry = ""
			if name == "" {
				return l, nil
			}
			l.status, l.statusErr = "보강 추가 중…", false
			return l, addAccessoryCmd(l.client, l.planID, l.sessionKey, name, parseAccessorySets(m.value))
		case "replace":
			name, bt := strings.TrimSpace(m.value), l.pendBlock
			l.pendBlock = ""
			if name == "" || bt == "" {
				return l, nil
			}
			l.status, l.statusErr = "교체 중…", false
			return l, replaceExerciseCmd(l.client, l.planID, l.sessionKey, bt, name)
		}
		return l, nil
	case overrideDoneMsg:
		if m.err != nil {
			l.status, l.statusErr = "변경 실패: "+humanizeAuthErr(m.err), true
			return l, nil
		}
		l.status, l.statusErr = theme.GlyphDone+" "+m.desc+" — 세션 재생성", false
		l.load = loadPending
		return l, loadSessionCmd(l.client, m.planID)
	case planActivatedMsg:
		l.load = loadPending
		return l, loadSessionCmd(l.client, m.id)
	case sessionLoadedMsg:
		l.load = loadIdle
		if m.err != nil {
			l.status, l.statusErr = "세션 로드 실패: "+humanizeAuthErr(m.err), true
			return l, nil
		}
		if m.noPlan {
			l.load = loadNoPlan
			return l, nil
		}
		l.planName, l.sessionKey, l.planID = m.planName, m.sessionKey, m.planID
		l.bodyweight = m.bodyweight
		l.amrapDeferred, l.lightBlock = false, false
		if m.snapshot != nil {
			l.amrapDeferred, l.lightBlock = m.snapshot.AmrapDeferred, m.snapshot.LightBlockMode
		}
		l.feedback = nil
		l.loadSnapshot(m.snapshot, m.prev)
		return l, nil
	case tea.KeyPressMsg:
		if l.editing {
			nl, cmd := l.updateEditing(m)
			return nl, cmd
		}
		nl, cmd := l.updateNormal(m)
		return nl, cmd
	}
	if l.editing {
		var cmd tea.Cmd
		l.edit, cmd = l.edit.Update(msg)
		return l, cmd
	}
	return l, nil
}
