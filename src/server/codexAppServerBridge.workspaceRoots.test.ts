import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  migrateWorkspaceRootsStateCompatibility,
  readPermissionState,
  readWorkspaceRootsState,
  writePermissionState,
  writeWorkspaceRootsState,
} from './codexAppServerBridge'

const originalCodexHome = process.env.CODEX_HOME

afterEach(() => {
  if (originalCodexHome === undefined) {
    delete process.env.CODEX_HOME
  } else {
    process.env.CODEX_HOME = originalCodexHome
  }
})

describe('workspace roots Desktop state compatibility', () => {
  it('stores permission presets separately from shared project state', async () => {
    const codexHome = await mkdtemp(join(tmpdir(), 'codex-home-permissions-'))
    const globalStatePath = join(codexHome, '.codex-global-state.json')
    process.env.CODEX_HOME = codexHome

    try {
      await writeFile(globalStatePath, JSON.stringify({ sentinel: 'preserved' }), 'utf8')

      await writePermissionState({
        defaultPreset: 'workspace',
        threadPresets: { 'thread-a': 'fullAccess' },
      })

      expect(await readPermissionState()).toEqual({
        defaultPreset: 'workspace',
        threadPresets: { 'thread-a': 'fullAccess' },
      })
      expect(JSON.parse(await readFile(globalStatePath, 'utf8'))).toEqual({ sentinel: 'preserved' })
    } finally {
      await rm(codexHome, { recursive: true, force: true })
    }
  })

  it('discovers Desktop local-project roots missing from saved workspace roots', async () => {
    const codexHome = await mkdtemp(join(tmpdir(), 'codex-home-local-project-read-'))
    const savedRoot = join(codexHome, 'saved-project')
    const desktopRoot = join(codexHome, 'desktop-project')
    process.env.CODEX_HOME = codexHome

    try {
      await Promise.all([
        mkdir(savedRoot, { recursive: true }),
        mkdir(desktopRoot, { recursive: true }),
      ])
      await writeFile(join(codexHome, '.codex-global-state.json'), JSON.stringify({
        'electron-saved-workspace-roots': [savedRoot],
        'active-workspace-roots': [savedRoot],
        'project-order': ['desktop-project-id'],
        'local-projects': {
          'desktop-project-id': {
            id: 'desktop-project-id',
            name: 'Desktop project',
            rootPaths: [desktopRoot],
            createdAt: 100,
            updatedAt: 100,
          },
        },
      }), 'utf8')

      const state = await readWorkspaceRootsState()

      expect(state.order).toEqual([savedRoot, desktopRoot])
      expect(state.labels[desktopRoot]).toBe('Desktop project')
      expect(state.projectOrder).toEqual([desktopRoot, savedRoot])
      expect(state.active).toEqual([savedRoot])
    } finally {
      await rm(codexHome, { recursive: true, force: true })
    }
  })

  it('migrates legacy saved-only and Desktop-only roots once', async () => {
    const codexHome = await mkdtemp(join(tmpdir(), 'codex-home-local-project-migrate-'))
    const savedRoot = join(codexHome, 'saved-project')
    const desktopRoot = join(codexHome, 'desktop-project')
    const statePath = join(codexHome, '.codex-global-state.json')
    process.env.CODEX_HOME = codexHome

    try {
      await Promise.all([
        mkdir(savedRoot, { recursive: true }),
        mkdir(desktopRoot, { recursive: true }),
      ])
      await writeFile(statePath, JSON.stringify({
        sentinel: 'preserved',
        'electron-saved-workspace-roots': [savedRoot],
        'active-workspace-roots': [savedRoot],
        'project-order': [savedRoot, 'desktop-project-id'],
        'local-projects': {
          'desktop-project-id': {
            id: 'desktop-project-id',
            name: 'Desktop project',
            rootPaths: [desktopRoot],
          },
        },
      }), 'utf8')

      expect(await migrateWorkspaceRootsStateCompatibility()).toBe(true)
      const migratedRaw = await readFile(statePath, 'utf8')
      const migrated = JSON.parse(migratedRaw) as Record<string, unknown>
      const localProjects = migrated['local-projects'] as Record<string, Record<string, unknown>>
      expect(migrated.sentinel).toBe('preserved')
      expect(migrated['electron-saved-workspace-roots']).toEqual([savedRoot, desktopRoot])
      expect(Object.values(localProjects).map((project) => project.rootPaths)).toEqual(expect.arrayContaining([
        [savedRoot],
        [desktopRoot],
      ]))
      expect(migrated['project-order']).toHaveLength(2)
      expect((migrated['project-order'] as string[]).every((item) => !item.includes(codexHome))).toBe(true)

      expect(await migrateWorkspaceRootsStateCompatibility()).toBe(false)
      expect(await readFile(statePath, 'utf8')).toBe(migratedRaw)
    } finally {
      await rm(codexHome, { recursive: true, force: true })
    }
  })

  it('registers web-added roots as Desktop local projects and stores project IDs in project-order', async () => {
    const codexHome = await mkdtemp(join(tmpdir(), 'codex-home-local-project-write-'))
    const existingRoot = join(codexHome, 'existing-project')
    const webRoot = join(codexHome, 'web-project')
    process.env.CODEX_HOME = codexHome

    try {
      await Promise.all([
        mkdir(existingRoot, { recursive: true }),
        mkdir(webRoot, { recursive: true }),
      ])
      await writeFile(join(codexHome, '.codex-global-state.json'), JSON.stringify({
        sentinel: { keep: true },
        'electron-saved-workspace-roots': [existingRoot],
        'active-workspace-roots': [existingRoot],
        'project-order': ['existing-project-id'],
        'local-projects': {
          'existing-project-id': {
            id: 'existing-project-id',
            name: 'Existing project',
            rootPaths: [existingRoot],
            createdAt: 100,
            updatedAt: 100,
            customField: 'preserved',
          },
        },
      }), 'utf8')

      await writeWorkspaceRootsState({
        order: [webRoot, existingRoot],
        labels: { [webRoot]: 'Web project' },
        active: [webRoot],
        projectOrder: [webRoot, existingRoot],
        remoteProjects: [],
      })

      const rawState = JSON.parse(await readFile(join(codexHome, '.codex-global-state.json'), 'utf8')) as Record<string, unknown>
      const localProjects = rawState['local-projects'] as Record<string, Record<string, unknown>>
      const webProject = Object.values(localProjects).find((project) => (
        Array.isArray(project.rootPaths) && project.rootPaths.includes(webRoot)
      ))
      expect(rawState.sentinel).toEqual({ keep: true })
      expect(rawState['electron-saved-workspace-roots']).toEqual([webRoot, existingRoot])
      expect(Object.keys(localProjects)).toHaveLength(2)
      expect(localProjects['existing-project-id']).toMatchObject({
        id: 'existing-project-id',
        rootPaths: [existingRoot],
        customField: 'preserved',
      })
      expect(webProject).toMatchObject({
        name: 'Web project',
        rootPaths: [webRoot],
      })
      expect(rawState['project-order']).toEqual([webProject?.id, 'existing-project-id'])

      const roundTrip = await readWorkspaceRootsState()
      expect(roundTrip.order).toEqual([webRoot, existingRoot])
      expect(roundTrip.projectOrder).toEqual([webRoot, existingRoot])
      expect(roundTrip.labels[webRoot]).toBe('Web project')
    } finally {
      await rm(codexHome, { recursive: true, force: true })
    }
  })

  it('removes the matching Desktop local project when a web root is removed', async () => {
    const codexHome = await mkdtemp(join(tmpdir(), 'codex-home-local-project-remove-'))
    const keptRoot = join(codexHome, 'kept-project')
    const removedRoot = join(codexHome, 'removed-project')
    process.env.CODEX_HOME = codexHome

    try {
      await Promise.all([
        mkdir(keptRoot, { recursive: true }),
        mkdir(removedRoot, { recursive: true }),
      ])
      await writeFile(join(codexHome, '.codex-global-state.json'), JSON.stringify({
        'electron-saved-workspace-roots': [keptRoot, removedRoot],
        'active-workspace-roots': [keptRoot],
        'project-order': ['kept-id', 'removed-id'],
        'local-projects': {
          'kept-id': { id: 'kept-id', name: 'Kept', rootPaths: [keptRoot] },
          'removed-id': { id: 'removed-id', name: 'Removed', rootPaths: [removedRoot] },
        },
      }), 'utf8')

      await writeWorkspaceRootsState({
        order: [keptRoot],
        labels: {},
        active: [keptRoot],
        projectOrder: [keptRoot],
        remoteProjects: [],
      })

      const rawState = JSON.parse(await readFile(join(codexHome, '.codex-global-state.json'), 'utf8')) as Record<string, unknown>
      expect(rawState['electron-saved-workspace-roots']).toEqual([keptRoot])
      expect(rawState['local-projects']).toEqual({
        'kept-id': { id: 'kept-id', name: 'Kept', rootPaths: [keptRoot] },
      })
      expect(rawState['project-order']).toEqual(['kept-id'])
    } finally {
      await rm(codexHome, { recursive: true, force: true })
    }
  })
})
