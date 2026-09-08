import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export const WORKSPACE_DEPENDENCY_NAMESPACE = 'codex_app'
export const WORKSPACE_DEPENDENCY_TOOL_NAME = 'load_workspace_dependencies'

export const WORKSPACE_DEPENDENCY_DYNAMIC_TOOL = {
  type: 'namespace',
  name: WORKSPACE_DEPENDENCY_NAMESPACE,
  description: 'Workspace dependency tools provided by the Codex host.',
  tools: [{
    type: 'function',
    name: WORKSPACE_DEPENDENCY_TOOL_NAME,
    description: 'Resolve the authoritative bundled runtime paths used by Codex artifact skills.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  }],
} as const

type JsonRecord = Record<string, unknown>

export type WorkspaceDependencyRuntime = {
  runtimeRoot: string
  dependencyRoot: string
  bundleVersion: string
  artifactToolVersion: string
  runtimeNode: string
  runtimeNodeModules: string
  runtimePython: string
  runtimePythonPackages: string
  runtimeBinDir: string
  fallbackBinDir: string
}

export type WorkspaceDependencyToolResponse = {
  success: boolean
  contentItems: Array<{ type: 'inputText'; text: string }>
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function firstFile(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    if (await isFile(path)) return path
  }
  return null
}

async function resolvePythonPackages(pythonRoot: string, platform: NodeJS.Platform): Promise<string | null> {
  if (platform === 'win32') {
    const windowsSitePackages = join(pythonRoot, 'Lib', 'site-packages')
    return await isDirectory(windowsSitePackages) ? windowsSitePackages : null
  }

  const libRoot = join(pythonRoot, 'lib')
  if (!await isDirectory(libRoot)) return null
  const entries = await readdir(libRoot, { withFileTypes: true })
  const pythonDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('python'))
    .map((entry) => entry.name)
    .sort()
    .reverse()
  for (const name of pythonDirs) {
    const sitePackages = join(libRoot, name, 'site-packages')
    if (await isDirectory(sitePackages)) return sitePackages
  }
  return null
}

function dependencyRootCandidates(environment: NodeJS.ProcessEnv, homeDir: string): string[] {
  const candidates = [
    environment.CODEX_RUNTIME_DEPENDENCIES,
    environment.CODEX_WORKSPACE_DEPENDENCIES,
    environment.CODEX_DEPENDENCIES,
    join(homeDir, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies'),
  ]
  return Array.from(new Set(candidates.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => resolve(value.trim()))))
}

async function normalizeDependencyRoot(candidate: string): Promise<{ dependencyRoot: string; manifestPath: string } | null> {
  const directManifest = join(candidate, 'runtime.json')
  const directDependencies = join(candidate, 'dependencies')
  if (await isFile(directManifest) && await isDirectory(directDependencies)) {
    return { dependencyRoot: directDependencies, manifestPath: directManifest }
  }

  const parentManifest = join(dirname(candidate), 'runtime.json')
  if (await isFile(parentManifest) && await isDirectory(candidate)) {
    return { dependencyRoot: candidate, manifestPath: parentManifest }
  }
  return null
}

export async function resolveWorkspaceDependencyRuntime(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDir = homedir(),
): Promise<WorkspaceDependencyRuntime> {
  const errors: string[] = []

  for (const candidate of dependencyRootCandidates(environment, homeDir)) {
    const normalized = await normalizeDependencyRoot(candidate)
    if (!normalized) {
      errors.push(`${candidate}: runtime.json or dependencies directory missing`)
      continue
    }

    try {
      const manifest = asRecord(JSON.parse(await readFile(normalized.manifestPath, 'utf8')))
      if (!manifest) throw new Error('runtime.json is not an object')
      const targetPlatform = typeof manifest.targetPlatform === 'string' ? manifest.targetPlatform : ''
      if (targetPlatform && targetPlatform !== platform) {
        throw new Error(`runtime target platform is ${targetPlatform}, host platform is ${platform}`)
      }
      const bundleVersion = typeof manifest.bundleVersion === 'string' ? manifest.bundleVersion.trim() : ''
      const artifactToolVersion = typeof manifest.artifactToolVersion === 'string' ? manifest.artifactToolVersion.trim() : ''
      if (!bundleVersion) throw new Error('runtime.json is missing bundleVersion')
      if (!artifactToolVersion) throw new Error('runtime.json is missing artifactToolVersion')

      const nodeRoot = join(normalized.dependencyRoot, 'node')
      const runtimeNode = await firstFile(platform === 'win32'
        ? [join(nodeRoot, 'bin', 'node.exe'), join(nodeRoot, 'node.exe')]
        : [join(nodeRoot, 'bin', 'node'), join(nodeRoot, 'node')])
      if (!runtimeNode) throw new Error('bundled Node executable is missing')

      const runtimeNodeModules = join(nodeRoot, 'node_modules')
      if (!await isDirectory(runtimeNodeModules)) throw new Error('bundled node_modules directory is missing')
      const artifactPackagePath = join(runtimeNodeModules, '@oai', 'artifact-tool', 'package.json')
      if (!await isFile(artifactPackagePath)) throw new Error('@oai/artifact-tool package is missing')
      const artifactPackage = asRecord(JSON.parse(await readFile(artifactPackagePath, 'utf8')))
      const installedArtifactVersion = typeof artifactPackage?.version === 'string' ? artifactPackage.version.trim() : ''
      if (installedArtifactVersion !== artifactToolVersion) {
        throw new Error(`@oai/artifact-tool version ${installedArtifactVersion || 'unknown'} does not match runtime manifest ${artifactToolVersion}`)
      }

      const pythonRoot = join(normalized.dependencyRoot, 'python')
      const runtimePython = await firstFile(platform === 'win32'
        ? [join(pythonRoot, 'python.exe')]
        : [join(pythonRoot, 'bin', 'python3'), join(pythonRoot, 'bin', 'python')])
      if (!runtimePython) throw new Error('bundled Python executable is missing')
      const runtimePythonPackages = await resolvePythonPackages(pythonRoot, platform)
      if (!runtimePythonPackages) throw new Error('bundled Python site-packages directory is missing')

      const runtimeBinDir = join(normalized.dependencyRoot, 'bin', 'override')
      const fallbackBinDir = join(normalized.dependencyRoot, 'bin', 'fallback')
      if (!await isDirectory(runtimeBinDir)) throw new Error('runtime override bin directory is missing')
      if (!await isDirectory(fallbackBinDir)) throw new Error('runtime fallback bin directory is missing')
      if (platform === 'win32' && !await isFile(join(runtimeBinDir, 'native-executables.json'))) {
        throw new Error('runtime native-executables.json is missing')
      }

      return {
        runtimeRoot: dirname(normalized.dependencyRoot),
        dependencyRoot: normalized.dependencyRoot,
        bundleVersion,
        artifactToolVersion,
        runtimeNode,
        runtimeNodeModules,
        runtimePython,
        runtimePythonPackages,
        runtimeBinDir,
        fallbackBinDir,
      }
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(`Codex primary runtime is unavailable or invalid. ${errors.join('; ')}`)
}

export function addWorkspaceDependencyDynamicTool(params: unknown): unknown {
  const record = asRecord(params)
  if (!record) return params
  const existing = Array.isArray(record.dynamicTools) ? record.dynamicTools.slice() : []
  const namespaceIndex = existing.findIndex((value) => {
    const tool = asRecord(value)
    return tool?.type === 'namespace' && tool.name === WORKSPACE_DEPENDENCY_NAMESPACE
  })

  if (namespaceIndex >= 0) {
    const namespace = asRecord(existing[namespaceIndex])
    const tools = Array.isArray(namespace?.tools) ? namespace.tools.slice() : []
    const alreadyPresent = tools.some((value) => {
      const tool = asRecord(value)
      return tool?.type === 'function' && tool.name === WORKSPACE_DEPENDENCY_TOOL_NAME
    })
    if (!alreadyPresent && namespace) {
      existing[namespaceIndex] = {
        ...namespace,
        tools: [...tools, WORKSPACE_DEPENDENCY_DYNAMIC_TOOL.tools[0]],
      }
    }
  } else {
    existing.push(WORKSPACE_DEPENDENCY_DYNAMIC_TOOL)
  }

  return {
    ...record,
    dynamicTools: existing,
  }
}

export function isWorkspaceDependencyToolCall(params: unknown): boolean {
  const request = asRecord(params)
  return request?.namespace === WORKSPACE_DEPENDENCY_NAMESPACE && request.tool === WORKSPACE_DEPENDENCY_TOOL_NAME
}

export async function handleWorkspaceDependencyToolCall(
  params: unknown,
  options: { environment?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; homeDir?: string } = {},
): Promise<WorkspaceDependencyToolResponse> {
  try {
    const request = asRecord(params)
    const args = asRecord(request?.arguments)
    if (request?.arguments != null && (!args || Object.keys(args).length > 0)) {
      throw new Error('load_workspace_dependencies does not accept arguments')
    }
    const runtime = await resolveWorkspaceDependencyRuntime(
      options.environment ?? process.env,
      options.platform ?? process.platform,
      options.homeDir ?? homedir(),
    )
    const lines = [
      `Bundle version: ${runtime.bundleVersion}`,
      `Artifact tool version: ${runtime.artifactToolVersion}`,
      `RUNTIME_NODE=${runtime.runtimeNode}`,
      `RUNTIME_NODE_MODULES=${runtime.runtimeNodeModules}`,
      `RUNTIME_PYTHON=${runtime.runtimePython}`,
      `RUNTIME_PYTHON_PACKAGES=${runtime.runtimePythonPackages}`,
      `RUNTIME_BIN_DIR=${runtime.runtimeBinDir}`,
      `RUNTIME_FALLBACK_BIN_DIR=${runtime.fallbackBinDir}`,
      `RUNTIME_DEPENDENCIES=${runtime.dependencyRoot}`,
    ]
    return {
      success: true,
      contentItems: [{ type: 'inputText', text: lines.join('\n') }],
    }
  } catch (error) {
    return {
      success: false,
      contentItems: [{
        type: 'inputText',
        text: error instanceof Error ? error.message : String(error),
      }],
    }
  }
}
