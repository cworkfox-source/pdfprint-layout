// §19.4 手動檢查更新(Phase 12 R-4)— 全文件唯一允許連網的地方
// (decision_log D-007)。純函式 orchestration:實際的 `fetch()` 呼叫經
// `deps.fetch` 注入,同 export.js 的 pdfLib/export-adapters.js 的 DOM glue
// 是同一種「唯一不可移植的呼叫才注入」慣例(§4.1),讓這裡在 Node 用假
// fetch 測試,真正的 `window.fetch` 只在瀏覽器呼叫端出現。這個模組本身
// 不會主動呼叫任何東西——§19.4 明訂觸發方式僅限使用者主動點擊按鈕,
// 呼不呼叫 checkForUpdate() 完全是呼叫端(app.html)的責任。

export const RELEASES_API_URL = 'https://api.github.com/repos/cworkfox-source/pdfprint-layout/releases/latest';

// GitHub release tag 通常是 "v1.2.3" 或 "1.2.3"——這裡只需要「遠端版本
// 是否比目前新」,不需要完整 semver range 語意(pre-release/build
// metadata 一律忽略,只看 major.minor.patch 三段數字)。
export function parseVersion(tag) {
  const match = String(tag ?? '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function isNewerVersion(remoteTag, currentVersion) {
  const remote = parseVersion(remoteTag);
  const current = parseVersion(currentVersion);
  if (!remote || !current) return false;
  if (remote.major !== current.major) return remote.major > current.major;
  if (remote.minor !== current.minor) return remote.minor > current.minor;
  return remote.patch > current.patch;
}

// Returns one of:
//   { status: 'up-to-date' }
//   { status: 'update-available', latestVersion, releaseNotes, releaseUrl }
//   { status: 'error', message }
// Never throws — §19.4 requires a failed check to degrade to a message,
// not block or otherwise affect any core functionality.
export async function checkForUpdate(currentVersion, deps) {
  const { fetch: fetchFn } = deps;
  if (!fetchFn) throw new Error('checkForUpdate requires deps.fetch');

  let response;
  try {
    response = await fetchFn(RELEASES_API_URL);
  } catch {
    return { status: 'error', message: '無法檢查更新(可能離線)' };
  }
  if (!response.ok) {
    return { status: 'error', message: `無法檢查更新(GitHub 回應狀態 ${response.status})` };
  }

  let json;
  try {
    json = await response.json();
  } catch {
    return { status: 'error', message: '無法檢查更新(回應格式無法解析)' };
  }

  const tagName = json?.tag_name;
  if (!tagName) {
    return { status: 'error', message: '無法檢查更新(回應缺少版本資訊)' };
  }

  if (isNewerVersion(tagName, currentVersion)) {
    return {
      status: 'update-available',
      latestVersion: tagName,
      releaseNotes: json.body ?? '',
      releaseUrl: json.html_url ?? `https://github.com/cworkfox-source/pdfprint-layout/releases/tag/${tagName}`,
    };
  }
  return { status: 'up-to-date' };
}
