import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  WORKSPACE_DEPENDENCY_NAMESPACE,
  WORKSPACE_DEPENDENCY_TOOL_NAME,
  addWorkspaceDependencyDynamicTool,
  handleWorkspaceDependencyToolCall,
  isWorkspaceDependencyToolCall,
} from './workspaceDependencies.js'

const tempRoots: string[] = []

async function createRuntime(artifactVersion = '2.8.59'): Promise<{ root: string; dependencies: string }> {
  const root = await mkdtemp(join(tmpdir(), 'codex-runtime-test-'))
  tempRoots.push(root)
  const dependencies = join(root, 'dependencies')
  await mkdir(join(dependencies, 'node', 'bin'), { recursive: true })
  await mkdir(join(dependencies, 'node', 'node_modules', '@oai', 'artifact-tool'), { recursive: true })
  await mkdir(join(dependencies, 'python', 'Lib', 'site-packages'), { recursive: true })
  await mkdir(join(dependencies, 'bin', 'override'), { recursive: true })
  await mkdir(join(dependencies, 'bin', 'fallback'), { recursive: true })
  await writeFile(join(root, 'runtime.json'), JSON.stringify({
    bundleVersion: '26.test',
    artifactToolVersion: artifactVersion,
    targetPlatform: 'win32',
  }))
  await writeFile(join(dependencies, 'node', 'bin', 'node.exe'), '')
  await writeFile(join(dependencies, 'node', 'node_modules', '@oai', 'artifact-tool', 'package.json'), JSON.stringify({
    name: '@oai/artifact-tool',
    version: '2.8.59',
  }))
  await writeFile(join(dependencies, 'python', 'python.exe'), '')
  await writeFile(join(dependencies, 'bin', 'override', 'native-executables.json'), '{}')
  return { root, dependencies }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('workspace dependency dynamic tool', () => {
  it('merges the codex_app namespace without replacing caller-provided tools', () => {
    const params = addWorkspaceDependencyDynamicTool({
      cwd: 'C:/repo',
      dynamicTools: [{
        type: 'function',
        name: 'read_thread',
        description: 'read',
        inputSchema: { type: 'object' },
      }],
    }) as { dynamicTools: Array<Record<string, unknown>> }

    expect(params.dynamicTools).toHaveLength(2)
    expect(params.dynamicTools[0]).toMatchObject({ type: 'function', name: 'read_thread' })
    expect(params.dynamicTools[1]).toMatchObject({
      type: 'namespace',
      name: WORKSPACE_DEPENDENCY_NAMESPACE,
      tools: [expect.objectContaining({ type: 'function', name: WORKSPACE_DEPENDENCY_TOOL_NAME })],
    })
  })

  it('recognizes only the namespaced workspace dependency call', () => {
    expect(isWorkspaceDependencyToolCall({
      namespace: WORKSPACE_DEPENDENCY_NAMESPACE,
      tool: WORKSPACE_DEPENDENCY_TOOL_NAME,
      arguments: {},
    })).toBe(true)
    expect(isWorkspaceDependencyToolCall({
      namespace: null,
      tool: WORKSPACE_DEPENDENCY_TOOL_NAME,
      arguments: {},
    })).toBe(false)
  })

  it('returns the authoritative Windows runtime paths after validating the manifest and artifact package', async () => {
    const runtime = await createRuntime()
    const response = await handleWorkspaceDependencyToolCall({
      namespace: WORKSPACE_DEPENDENCY_NAMESPACE,
      tool: WORKSPACE_DEPENDENCY_TOOL_NAME,
      arguments: {},
    }, {
      environment: { CODEX_RUNTIME_DEPENDENCIES: runtime.dependencies },
      platform: 'win32',
      homeDir: runtime.root,
    })

    expect(response.success).toBe(true)
    const text = response.contentItems[0]?.text ?? ''
    expect(text).toContain(`RUNTIME_NODE=${join(runtime.dependencies, 'node', 'bin', 'node.exe')}`)
    expect(text).toContain(`RUNTIME_NODE_MODULES=${join(runtime.dependencies, 'node', 'node_modules')}`)
    expect(text).toContain(`RUNTIME_PYTHON=${join(runtime.dependencies, 'python', 'python.exe')}`)
    expect(text).toContain(`RUNTIME_BIN_DIR=${join(runtime.dependencies, 'bin', 'override')}`)
  })

  it('fails closed when the bundled artifact package does not match runtime.json', async () => {
    const runtime = await createRuntime('9.9.9')
    const response = await handleWorkspaceDependencyToolCall({
      namespace: WORKSPACE_DEPENDENCY_NAMESPACE,
      tool: WORKSPACE_DEPENDENCY_TOOL_NAME,
      arguments: {},
    }, {
      environment: { CODEX_RUNTIME_DEPENDENCIES: runtime.dependencies },
      platform: 'win32',
      homeDir: runtime.root,
    })

    expect(response.success).toBe(false)
    expect(response.contentItems[0]?.text).toMatch(/does not match runtime manifest/)
  })
})
