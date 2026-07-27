export type PermissionPreset = 'workspace' | 'fullAccess'

export type PermissionState = {
  defaultPreset: PermissionPreset
  threadPresets: Record<string, PermissionPreset>
}

export type PermissionConfig = {
  approvalPolicy: 'on-request' | 'never'
  sandboxPolicy: {
    type: 'workspaceWrite'
    writableRoots: string[]
    networkAccess: boolean
    excludeTmpdirEnvVar: boolean
    excludeSlashTmp: boolean
  } | {
    type: 'dangerFullAccess'
  }
}

export const DEFAULT_PERMISSION_PRESET: PermissionPreset = 'workspace'

export function normalizePermissionPreset(value: unknown, fallback = DEFAULT_PERMISSION_PRESET): PermissionPreset {
  return value === 'fullAccess' || value === 'workspace' ? value : fallback
}

export function normalizePermissionState(value: unknown, fallback = DEFAULT_PERMISSION_PRESET): PermissionState {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const rawThreadPresets = record.threadPresets !== null && typeof record.threadPresets === 'object' && !Array.isArray(record.threadPresets)
    ? record.threadPresets as Record<string, unknown>
    : {}
  const threadPresets: Record<string, PermissionPreset> = {}

  for (const [threadId, preset] of Object.entries(rawThreadPresets)) {
    const normalizedThreadId = threadId.trim()
    if (!normalizedThreadId || (preset !== 'workspace' && preset !== 'fullAccess')) continue
    threadPresets[normalizedThreadId] = preset
  }

  return {
    defaultPreset: normalizePermissionPreset(record.defaultPreset, fallback),
    threadPresets,
  }
}

export function resolvePermissionPreset(preset: PermissionPreset, projectRoot?: string): PermissionConfig {
  if (preset === 'fullAccess') {
    return {
      approvalPolicy: 'never',
      sandboxPolicy: { type: 'dangerFullAccess' },
    }
  }

  const cwd = projectRoot?.trim()
  return {
    approvalPolicy: 'on-request',
    sandboxPolicy: {
      type: 'workspaceWrite',
      writableRoots: cwd ? [cwd] : [],
      networkAccess: true,
      excludeTmpdirEnvVar: false,
      excludeSlashTmp: false,
    },
  }
}

export function inferPermissionPresetFromSettings(
  approvalPolicy: unknown,
  sandboxPolicy: unknown,
): PermissionPreset | null {
  const sandbox = sandboxPolicy !== null && typeof sandboxPolicy === 'object' && !Array.isArray(sandboxPolicy)
    ? sandboxPolicy as Record<string, unknown>
    : null
  const sandboxType = typeof sandbox?.type === 'string' ? sandbox.type : ''

  if (sandboxType === 'dangerFullAccess') return 'fullAccess'
  if (sandboxType === 'workspaceWrite' && approvalPolicy === 'on-request') return 'workspace'
  return null
}
