import {
  REF5_PROTOCOL_VERSION,
  REF5_RUNTIME_SCHEMA_VERSION,
  createInitialRef5State,
  deriveRef5AuxiliaryCaps,
  deriveRef5ControlRefs,
  deriveRef5Standards,
  type Ref5DirectStandardsKg,
  type Ref5RuntimeState,
  type Ref5WindowResult,
} from "./ref5";

/**
 * §18 gain rate for one lift: INCREASE judgments over completed judgment windows,
 * plus the bounded recent flow. Reads the accumulators defensively so a plan whose
 * cached state predates these counters (pre-gain-rate v1.3) still renders — a
 * later replay repopulates them.
 */
function ref5WindowGain(window: {
  completedWindowCount: number;
  increaseWindowCount?: number;
  recentResults?: Ref5WindowResult[];
}) {
  const completed = window.completedWindowCount;
  const increases = window.increaseWindowCount ?? 0;
  return {
    completed,
    increases,
    gainRate: completed > 0 ? increases / completed : null,
    recentResults: window.recentResults ?? [],
  };
}

function isRef5State(value: unknown): value is Ref5RuntimeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<Ref5RuntimeState>;
  return (
    state.schemaVersion === REF5_RUNTIME_SCHEMA_VERSION &&
    state.protocolVersion === REF5_PROTOCOL_VERSION &&
    typeof state.revision === "number" &&
    Boolean(state.directStandardsKg)
  );
}

export function buildRef5Status(
  value: unknown,
  initialDirectStandardsKg?: Ref5DirectStandardsKg,
) {
  const state = isRef5State(value)
    ? value
    : createInitialRef5State(initialDirectStandardsKg);
  const directStandardsKg = { ...state.directStandardsKg };
  const stagnationPending = (["SQ", "BP", "PULL"] as const).filter(
    (lift) => state.stagnation[lift].phase === "PENDING_MICRO",
  );
  const pendingMicroReasons = [
    ...(state.forcedMicro.pending ? ["FORCED_PRIMARY_FAILS"] : []),
    ...stagnationPending.map((lift) => `STAGNATION_${lift}`),
  ];
  return {
    schemaVersion: state.schemaVersion,
    protocolVersion: state.protocolVersion,
    revision: state.revision,
    nextFocus: state.nextFocus,
    nextSquatHard: state.nextSquatHard,
    pendingMicro: {
      pending: pendingMicroReasons.length > 0,
      reasons: pendingMicroReasons,
      forcedToken: state.forcedMicro.pending,
      stagnationLifts: stagnationPending,
    },
    windows: {
      SQ: {
        current: state.mainWindows.SQ.exposures.length,
        threshold: 6,
        volumeFailures: state.mainWindows.SQ.volumeFailEventIds.length,
        ...ref5WindowGain(state.mainWindows.SQ),
      },
      BP: {
        current: state.mainWindows.BP.exposures.length,
        threshold: 4,
        volumeFailures: state.mainWindows.BP.volumeFailEventIds.length,
        ...ref5WindowGain(state.mainWindows.BP),
      },
      PULL: {
        current: state.mainWindows.PULL.exposures.length,
        threshold: 4,
        volumeFailures: state.mainWindows.PULL.volumeFailEventIds.length,
        ...ref5WindowGain(state.mainWindows.PULL),
      },
      DL: {
        current: state.auxiliaryWindows.DL.exposures.length,
        threshold: 4,
        volumeFailures: 0,
        ...ref5WindowGain(state.auxiliaryWindows.DL),
      },
      OHP: {
        current: state.auxiliaryWindows.OHP.exposures.length,
        threshold: 4,
        volumeFailures: 0,
        ...ref5WindowGain(state.auxiliaryWindows.OHP),
      },
    },
    directStandardsKg,
    derivedStandardsKg: deriveRef5Standards(directStandardsKg),
    controlRefsKg: deriveRef5ControlRefs(directStandardsKg),
    auxiliaryCapsKg: deriveRef5AuxiliaryCaps(directStandardsKg),
    structureReview: {
      SQ: state.stagnation.SQ.structureReview,
      BP: state.stagnation.BP.structureReview,
      PULL: state.stagnation.PULL.structureReview,
      any:
        state.stagnation.SQ.structureReview ||
        state.stagnation.BP.structureReview ||
        state.stagnation.PULL.structureReview,
    },
    pullLock: state.pull.lock,
    startedSessionCount: state.startedSessions.length,
    completedSessionCount: state.completedSessions.length,
    recentChanges: state.progressionChanges.slice(-8),
  };
}

export type Ref5Status = ReturnType<typeof buildRef5Status>;
