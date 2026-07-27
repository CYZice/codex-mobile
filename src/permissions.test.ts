import { describe, expect, it } from 'vitest'
import {
  inferPermissionPresetFromSettings,
  normalizePermissionState,
  resolvePermissionPreset,
} from './permissions'

describe('permission presets', () => {
  it('limits workspace access to the active project while retaining network access', () => {
    expect(resolvePermissionPreset('workspace', 'D:\\Projects\\LiDAR FPGA')).toEqual({
      approvalPolicy: 'on-request',
      sandboxPolicy: {
        type: 'workspaceWrite',
        writableRoots: ['D:\\Projects\\LiDAR FPGA'],
        networkAccess: true,
        excludeTmpdirEnvVar: false,
        excludeSlashTmp: false,
      },
    })
  })

  it('uses the App Server full-access policy without writable-root restrictions', () => {
    expect(resolvePermissionPreset('fullAccess')).toEqual({
      approvalPolicy: 'never',
      sandboxPolicy: { type: 'dangerFullAccess' },
    })
  })

  it('keeps only valid persisted thread presets', () => {
    expect(normalizePermissionState({
      defaultPreset: 'fullAccess',
      threadPresets: {
        'thread-a': 'workspace',
        ' ': 'fullAccess',
        'thread-b': 'unknown',
      },
    })).toEqual({
      defaultPreset: 'fullAccess',
      threadPresets: { 'thread-a': 'workspace' },
    })
  })

  it('recognizes App Server settings when resuming a thread', () => {
    expect(inferPermissionPresetFromSettings('on-request', { type: 'workspaceWrite' })).toBe('workspace')
    expect(inferPermissionPresetFromSettings('never', { type: 'dangerFullAccess' })).toBe('fullAccess')
  })
})
