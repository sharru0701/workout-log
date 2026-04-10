const SETTINGS_ROOT_PATH = "/settings";

function isSettingsPath(pathname: string) {
  return pathname === SETTINGS_ROOT_PATH || pathname.startsWith(`${SETTINGS_ROOT_PATH}/`);
}

export function shouldUseViewTransition(currentPathname: string, nextPathname: string) {
  if (currentPathname === nextPathname) return false;

  // Settings detail routes render inside the persistent settings layout and
  // already animate with BottomSheet. Running a document-level view transition
  // at the same time makes the entry feel like a duplicated animation.
  if (isSettingsPath(currentPathname) && isSettingsPath(nextPathname)) {
    return false;
  }

  return true;
}
