package ui

// log_update.go — 오늘 버퍼의 키 처리와 상태 변이(NORMAL/INSERT 키맵, 세트 이동·추가·삭제·
// 완료, 편집 로드/기록, 스냅샷 로드). 렌더링/커맨드와 분리 — god-component 분해 3단계.

import (
	"fmt"
	"strconv"
	"strings"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"

	"github.com/sharru0701/workout-log/apps/tui/internal/api"
	"github.com/sharru0701/workout-log/apps/tui/internal/theme"
)

func (l Log) updateNormal(m tea.KeyPressMsg) (Log, tea.Cmd) {
	switch m.String() {
	case "j", "down":
		l.moveSet(1)
	case "k", "up":
		l.moveSet(-1)
	case "h", "left":
		if l.col > colWeight {
			l.col--
		}
	case "l", "right":
		if l.col < colRPE {
			l.col++
		}
	case "i", "enter":
		if len(l.groups) == 0 {
			return l, openExercisePickerCmd(l.client)
		}
		return l.beginEdit(editCell)
	case "e", "n":
		return l, openExercisePickerCmd(l.client)
	case "a":
		return l.beginAccessory()
	case "c":
		return l.beginReplace()
	case "x":
		return l.toggleDone()
	case "o":
		return l.addSet()
	case "d":
		return l.deleteSet()
	case "u":
		return l.undoDelete()
	case "s":
		return l.save()
	}
	return l, nil
}

func (l Log) updateEditing(m tea.KeyPressMsg) (Log, tea.Cmd) {
	switch m.String() {
	case "esc":
		l.editing, l.target = false, editNone
		return l, nil
	case "enter":
		l.writeEdit()
		l.editing = false
		switch l.target {
		case editName:
			l.col = colWeight
			return l.beginEdit(editCell)
		case editCell:
			switch l.col {
			case colWeight:
				l.col = colReps
				return l.beginEdit(editCell)
			case colReps:
				return l.completeSet()
			}
			return l, nil // colRPE is optional; close the editor
		}
		return l, nil
	case "tab":
		l.writeEdit()
		l.editing = false
		if l.target == editName {
			l.col = colWeight
		} else {
			l.col = (l.col + 1) % 3 // weight → reps → rpe → weight
		}
		return l.beginEdit(editCell)
	}
	var cmd tea.Cmd
	l.edit, cmd = l.edit.Update(m)
	return l, cmd
}

func (l *Log) moveSet(dir int) {
	if len(l.groups) == 0 {
		return
	}
	if dir > 0 {
		if l.si < len(l.groups[l.gi].sets)-1 {
			l.si++
		} else if l.gi < len(l.groups)-1 {
			l.gi, l.si = l.gi+1, 0
		}
	} else {
		if l.si > 0 {
			l.si--
		} else if l.gi > 0 {
			l.gi = l.gi - 1
			l.si = len(l.groups[l.gi].sets) - 1
		}
	}
}

// beginAccessory starts the 보강 (ADD_ACCESSORY) override flow: pick an exercise,
// then enter its sets. Only valid on a generated plan session.
func (l Log) beginAccessory() (Log, tea.Cmd) {
	if l.planID == "" || l.sessionKey == "" {
		l.status, l.statusErr = "보강은 플랜 세션에서만 가능합니다", true
		return l, nil
	}
	return l, exercisePickerCmd(l.client, "보강 운동 ", "accessory")
}

// beginReplace starts the 교체 (REPLACE_EXERCISE) override flow for the selected
// MAIN exercise's block target.
func (l Log) beginReplace() (Log, tea.Cmd) {
	if l.planID == "" || l.sessionKey == "" {
		l.status, l.statusErr = "교체는 플랜 세션에서만 가능합니다", true
		return l, nil
	}
	if l.gi >= len(l.groups) {
		return l, nil
	}
	g := l.groups[l.gi]
	if g.role != "MAIN" || g.blockTarget == "" {
		l.status, l.statusErr = "메인 운동에서만 교체할 수 있습니다", true
		return l, nil
	}
	l.pendBlock = g.blockTarget
	return l, exercisePickerCmd(l.client, "교체할 운동 ", "replace")
}

func (l Log) addSet() (Log, tea.Cmd) {
	if len(l.groups) == 0 {
		return l, openExercisePickerCmd(l.client)
	}
	at := l.si + 1
	sets := l.groups[l.gi].sets
	ns := make([]setEntry, 0, len(sets)+1)
	ns = append(ns, sets[:at]...)
	ns = append(ns, setEntry{})
	ns = append(ns, sets[at:]...)
	l.groups[l.gi].sets = ns
	l.si, l.col = at, colWeight
	l.persistDraft()
	return l, nil
}

func (l Log) deleteSet() (Log, tea.Cmd) {
	if len(l.groups) == 0 {
		return l, nil
	}
	l.undo = &undoSnapshot{groups: cloneGroups(l.groups), gi: l.gi, si: l.si}
	if len(l.groups[l.gi].sets) <= 1 {
		l.groups = append(l.groups[:l.gi], l.groups[l.gi+1:]...)
		if l.gi >= len(l.groups) {
			l.gi = len(l.groups) - 1
		}
		if l.gi < 0 {
			l.gi = 0
		}
		l.si = 0
		l.persistDraft()
		return l, nil
	}
	sets := l.groups[l.gi].sets
	l.groups[l.gi].sets = append(sets[:l.si], sets[l.si+1:]...)
	if l.si >= len(l.groups[l.gi].sets) {
		l.si = len(l.groups[l.gi].sets) - 1
	}
	l.persistDraft()
	return l, nil
}

// undoDelete restores the buffer to the state captured by the last deleteSet.
func (l Log) undoDelete() (Log, tea.Cmd) {
	if l.undo == nil {
		return l, nil
	}
	l.groups, l.gi, l.si, l.col = l.undo.groups, l.undo.gi, l.undo.si, colWeight
	l.undo = nil
	l.status, l.statusErr = theme.GlyphDone+" 삭제 되돌림", false
	l.persistDraft()
	return l, nil
}

func (l Log) toggleDone() (Log, tea.Cmd) {
	if len(l.groups) == 0 {
		return l, nil
	}
	s := &l.groups[l.gi].sets[l.si]
	if s.done {
		s.done = false
		l.persistDraft()
		return l, nil
	}
	if strings.TrimSpace(l.groups[l.gi].name) == "" || !validNum(s.weight) || !validInt(s.reps) {
		l.status, l.statusErr = "완료하려면 무게·reps가 필요합니다", true
		return l, nil
	}
	s.done = true
	l.status, l.statusErr = "", false
	l.persistDraft()
	return l, nil
}

func (l Log) completeSet() (Log, tea.Cmd) {
	s := l.groups[l.gi].sets[l.si]
	if strings.TrimSpace(l.groups[l.gi].name) == "" || !validNum(s.weight) || !validInt(s.reps) {
		l.status, l.statusErr = "무게·reps를 정확히 입력하세요", true
		return l, nil
	}
	l.groups[l.gi].sets[l.si].done = true
	l.status, l.statusErr = "", false
	l.persistDraft()
	// 세트 추가는 addSet("o")로만 — reps 엔터는 현재 세트 완료까지만 하고
	// 빈 세트를 자동으로 덧붙이지 않는다.
	// 입력 리듬: reps 완료 = 세트 완료이므로 커서를 다음 세트로 옮겨(운동 경계 넘어감)
	// 엔터 한 번으로 바로 이어 입력하게 한다. 마지막 세트면 제자리(moveSet이 no-op).
	// 에디터를 자동으로 열지는 않는다 — 이동/저장 키(j/k/s)를 편집기가 삼키면 안 된다.
	l.moveSet(1)
	l.col = colWeight
	return l, nil
}

func (l Log) save() (Log, tea.Cmd) {
	if l.saving {
		return l, nil
	}
	if l.doneCount() == 0 {
		l.status, l.statusErr = "완료된 세트가 없습니다 (x로 완료)", true
		return l, nil
	}
	l.saving, l.status, l.statusErr = true, "", false
	return l, saveCmd(l.client, l.groups, l.editID, l.performedAt)
}

// loadForEdit replaces today's buffer with a past session's sets (grouped by
// exercise, every set pre-marked done) so the user can revise and PATCH it.
func (l *Log) loadForEdit(m editLogMsg) {
	var order []string
	byEx := map[string]*exGroup{}
	for _, st := range m.sets {
		n := strings.TrimSpace(st.ExerciseName)
		if n == "" {
			continue
		}
		g, ok := byEx[n]
		if !ok {
			byEx[n] = &exGroup{name: n}
			g = byEx[n]
			order = append(order, n)
		}
		setTotal := 0.0
		if isBodyweightExercise(n) && st.Meta != nil && float64(st.Meta.TotalLoadKg) > 0 {
			setTotal = round2(float64(st.Meta.TotalLoadKg)) // weightKg is the external added weight
		}
		g.sets = append(g.sets, setEntry{
			weight: trimNum(float64(st.WeightKg)),
			reps:   strconv.Itoa(st.Reps),
			rpe:    rpeString(st.RPE),
			done:   true,
			total:  setTotal,
		})
	}
	groups := make([]exGroup, 0, len(order))
	for _, n := range order {
		groups = append(groups, *byEx[n])
	}
	if len(groups) == 0 {
		return
	}
	l.groups, l.gi, l.si, l.col = groups, 0, 0, colWeight
	l.editing, l.target = false, editNone
	l.editID, l.performedAt = m.id, m.performedAt
	l.planName, l.sessionKey, l.planID = m.planName, m.sessionKey, m.planID
	if m.bodyweight > 0 {
		l.bodyweight = m.bodyweight
	}
	l.load, l.undo = loadIdle, nil
	l.status, l.statusErr = theme.GlyphDone+" 편집 로드됨 — s로 저장", false
}

func (l Log) beginEdit(t editTarget) (Log, tea.Cmd) {
	ti := textinput.New()
	ti.Prompt = ""
	ti.SetVirtualCursor(true)
	switch t {
	case editName:
		ti.SetWidth(16)
		ti.SetValue(l.groups[l.gi].name)
	case editCell:
		s := l.groups[l.gi].sets[l.si]
		switch l.col {
		case colWeight:
			ti.SetWidth(6)
			ti.SetValue(s.weight)
		case colReps:
			ti.SetWidth(4)
			ti.SetValue(s.reps)
		case colRPE:
			ti.SetWidth(3)
			ti.SetValue(s.rpe)
		}
	}
	l.edit, l.editing, l.target = ti, true, t
	return l, l.edit.Focus()
}

// recomputeTotal refreshes a set's bodyweight-inclusive total after its external
// weight changes: total = bodyweight + external for bodyweight lifts, else 0.
func (l *Log) recomputeTotal(gi, si int) {
	g := &l.groups[gi]
	if !isBodyweightExercise(g.name) || l.bodyweight <= 0 {
		g.sets[si].total = 0
		return
	}
	ext, _ := strconv.ParseFloat(strings.TrimSpace(g.sets[si].weight), 64)
	if ext < 0 {
		ext = 0
	}
	g.sets[si].total = round2(l.bodyweight + ext)
}

func (l *Log) writeEdit() {
	v := strings.TrimSpace(l.edit.Value())
	switch l.target {
	case editName:
		l.groups[l.gi].name = v
	case editCell:
		switch l.col {
		case colWeight:
			l.groups[l.gi].sets[l.si].weight = v
			l.recomputeTotal(l.gi, l.si)
		case colReps:
			l.groups[l.gi].sets[l.si].reps = v
		case colRPE:
			l.groups[l.gi].sets[l.si].rpe = v
		}
	}
	l.persistDraft()
}

// loadSnapshot replaces today's groups with a plan's generated session,
// pre-filling each set's weight with its target and showing tgt in the header.
func (l *Log) loadSnapshot(s *api.SessionSnapshot, prev map[string]string) {
	if s == nil {
		return
	}
	var groups []exGroup
	for _, ex := range s.Exercises {
		g := exGroup{name: ex.ExerciseName, prev: prev[strings.ToLower(strings.TrimSpace(ex.ExerciseName))], blockTarget: ex.SourceBlockTarget, role: ex.Role}
		maxTgt, tgtReps := 0.0, 0
		bw := isBodyweightExercise(ex.ExerciseName)
		for _, st := range ex.Sets {
			// targetWeightKg is bodyweight-INCLUSIVE total for bodyweight lifts;
			// store the external added weight (total-bw) as the editable value and
			// keep the total for display.
			total := float64(st.TargetWeightKg)
			w, setTotal := total, 0.0
			if bw && l.bodyweight > 0 {
				w, setTotal = bwExternalFromTotal(total, l.bodyweight), total
			}
			g.sets = append(g.sets, setEntry{weight: trimNum(w), reps: "", tgtReps: st.Reps, total: setTotal})
			if total >= maxTgt {
				maxTgt, tgtReps = total, st.Reps
			}
		}
		if len(g.sets) == 0 {
			g.sets = []setEntry{{}}
		}
		if maxTgt > 0 {
			g.tgt = fmt.Sprintf("%s×%d", trimNum(maxTgt), tgtReps)
		}
		groups = append(groups, g)
	}
	if len(groups) == 0 {
		return
	}
	l.groups, l.gi, l.si, l.col = groups, 0, 0, colWeight
	l.undo = nil
	l.status, l.statusErr = theme.GlyphDone+" 플랜 세션 로드됨", false
}

// keepDoneOnly drops not-done sets (and now-empty groups) so the saved session
// stays on screen as just the completed work.
func (l *Log) keepDoneOnly() {
	var groups []exGroup
	for _, g := range l.groups {
		var sets []setEntry
		for _, s := range g.sets {
			if s.done {
				sets = append(sets, s)
			}
		}
		if len(sets) > 0 {
			g.sets = sets
			groups = append(groups, g)
		}
	}
	l.groups, l.gi, l.si, l.col = groups, 0, 0, colWeight
}
