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

  it('routes workspace approval requests through automatic review', () => {
    expect(resolvePermissionPreset('autoReview', 'D:\\Projects\\LiDAR FPGA')).toEqual({
      approvalPolicy: 'on-request',
      approvalsReviewer: 'auto_review',
      sandboxPolicy: {
        type: 'workspaceWrite',
        writableRoots: ['D:\\Projects\\LiDAR FPGA'],
        networkAccess: true,
        excludeTmpdirEnvVar: false,
        excludeSlashTmp: false,
      },
    })
  })

  it('keeps only valid persisted thread presets', () => {
    expect(normalizePermissionState({
      defaultPreset: 'fullAccess',
      threadPresets: {
        'thread-a': 'workspace',
        'thread-auto': 'autoReview',
        ' ': 'fullAccess',
        'thread-b': 'unknown',
      },
    })).toEqual({
      defaultPreset: 'fullAccess',
      threadPresets: { 'thread-a': 'workspace', 'thread-auto': 'autoReview' },
    })
  })

  it('recognizes App Server settings when resuming a thread', () => {
    expect(inferPermissionPresetFromSettings('on-request', { type: 'workspaceWrite' })).toBe('workspace')
    expect(inferPermissionPresetFromSettings('on-request', { type: 'workspaceWrite' }, 'auto_review')).toBe('autoReview')
    expect(inferPermissionPresetFromSettings('never', { type: 'dangerFullAccess' })).toBe('fullAccess')
  })
})
