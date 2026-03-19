import fs from 'fs/promises'
import path from 'path'
import type { FileNode } from '@axy/shared'

export class FileService {
  /** Read a file tree recursively (with depth limit) */
  async readTree(dirPath: string, maxDepth = 5, currentDepth = 0): Promise<FileNode[]> {
    if (currentDepth >= maxDepth) return []

    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const nodes: FileNode[] = []

    for (const entry of entries) {
      // Skip common ignore patterns (but allow dotfiles like .env, .gitignore, etc.)
      if (entry.name === 'node_modules' || entry.name === '__pycache__' || entry.name === '.git') {
        continue
      }

      const fullPath = path.join(dirPath, entry.name)
      const relativePath = fullPath // Will be made relative by caller

      if (entry.isDirectory()) {
        const children = await this.readTree(fullPath, maxDepth, currentDepth + 1)
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children,
        })
      } else {
        const stats = await fs.stat(fullPath).catch(() => null)
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
          size: stats?.size,
        })
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  /** Read a file's content */
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8')
  }

  /** Write content to a file */
  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
  }

  /** Write a binary buffer to a file */
  async writeFileBuffer(filePath: string, buffer: Buffer): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  /** Create a new file */
  async createFile(filePath: string, content = ''): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
  }

  /** Create a directory */
  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true })
  }

  /** Delete a file or directory */
  async delete(targetPath: string): Promise<void> {
    await fs.rm(targetPath, { recursive: true, force: true })
  }

  /** Rename/move a file */
  async rename(oldPath: string, newPath: string): Promise<void> {
    await fs.rename(oldPath, newPath)
  }

  /** Validate that a path is within the allowed project directory (prevent path traversal + symlink escape) */
  async validatePath(requestedPath: string, projectPath: string): Promise<string> {
    const resolved = path.resolve(projectPath, requestedPath)
    const resolvedProject = path.resolve(projectPath)

    // First check: simple path prefix (catches ../ traversal)
    if (!resolved.startsWith(resolvedProject)) {
      throw new Error('Path traversal not allowed')
    }

    // Second check: resolve symlinks and verify real path is still within project
    try {
      const realPath = await fs.realpath(resolved)
      const realProject = await fs.realpath(resolvedProject)
      if (!realPath.startsWith(realProject)) {
        throw new Error('Path traversal via symlink not allowed')
      }
      return realPath
    } catch (e: any) {
      // If file doesn't exist yet (e.g. creating new file), validate parent dir
      if (e.code === 'ENOENT') {
        const parentDir = path.dirname(resolved)
        try {
          const realParent = await fs.realpath(parentDir)
          const realProject = await fs.realpath(resolvedProject)
          if (!realParent.startsWith(realProject)) {
            throw new Error('Path traversal via symlink not allowed')
          }
        } catch {
          // Parent doesn't exist either — will be created, just validate prefix
        }
        return resolved
      }
      throw e
    }
  }
}

export const fileService = new FileService()
