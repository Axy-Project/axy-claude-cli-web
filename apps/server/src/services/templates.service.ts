import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: string
  setupCommands: string[]
  claudeMd: string
  files: Record<string, string>
  mcpServers?: Array<{ name: string; command: string; argsJson: string[] }>
}

const NODE_GITIGNORE = `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
`

const PYTHON_GITIGNORE = `.venv/
__pycache__/
*.pyc
*.pyo
.env
.env.local
*.egg-info/
dist/
build/
.DS_Store
.ipynb_checkpoints/
`

const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'node-typescript',
    name: 'Node.js + TypeScript',
    description: 'A Node.js project with TypeScript, strict mode, and tsx for fast execution.',
    category: 'backend',
    icon: 'TS',
    setupCommands: [
      'npm init -y',
      'npm install typescript @types/node tsx',
      'npx tsc --init',
    ],
    claudeMd: `# Project

## Overview
Node.js + TypeScript project.

## Stack
- Runtime: Node.js
- Language: TypeScript (strict mode)
- Runner: tsx (for development)

## Commands
- Run: \`npx tsx src/index.ts\`
- Build: \`npx tsc\`
- Dev: \`npx tsx watch src/index.ts\`

## Conventions
- Source code lives in \`src/\`
- Use ES module imports
- Prefer \`const\` over \`let\`, never use \`var\`
- Use strict TypeScript — no \`any\` unless absolutely necessary
`,
    files: {
      'src/index.ts': `console.log('Hello from TypeScript!')

function greet(name: string): string {
  return \`Hello, \${name}!\`
}

console.log(greet('World'))
`,
      'tsconfig.json': JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            outDir: './dist',
            rootDir: './src',
            declaration: true,
            sourceMap: true,
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist'],
        },
        null,
        2
      ),
      '.gitignore': NODE_GITIGNORE,
    },
  },
  {
    id: 'nextjs-react',
    name: 'Next.js + React',
    description:
      'A full-stack Next.js 15 app with TypeScript, Tailwind CSS, and the App Router.',
    category: 'frontend',
    icon: 'NX',
    setupCommands: [
      'npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-eslint --no-import-alias',
    ],
    claudeMd: `# Project

## Overview
Next.js 15 application with App Router.

## Stack
- Framework: Next.js 15 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Runtime: React 19

## Commands
- Dev: \`npm run dev\`
- Build: \`npm run build\`
- Start: \`npm run start\`

## Conventions
- Pages go in \`app/\` directory using file-based routing
- Use Server Components by default, add 'use client' only when needed
- Colocate components near the pages that use them
- Use \`loading.tsx\` and \`error.tsx\` for loading/error states
- Prefer server actions for mutations
`,
    files: {},
  },
  {
    id: 'python-fastapi',
    name: 'Python + FastAPI',
    description:
      'A Python REST API using FastAPI with automatic OpenAPI docs and uvicorn.',
    category: 'backend',
    icon: 'PY',
    setupCommands: [
      'python3 -m venv .venv',
      'source .venv/bin/activate && pip install fastapi uvicorn',
    ],
    claudeMd: `# Project

## Overview
Python FastAPI REST API.

## Stack
- Framework: FastAPI
- Server: Uvicorn
- Language: Python 3

## Commands
- Dev: \`source .venv/bin/activate && uvicorn main:app --reload\`
- Docs: http://localhost:8000/docs (Swagger UI)

## Conventions
- Use type hints for all function parameters and return values
- Keep endpoint functions in \`main.py\` or split into routers
- Use Pydantic models for request/response schemas
- Use \`async def\` for async endpoints
- Virtual environment is in \`.venv/\`
`,
    files: {
      'main.py': `from fastapi import FastAPI

app = FastAPI(title="My API", version="0.1.0")


@app.get("/")
async def root():
    return {"message": "Hello, World!"}


@app.get("/health")
async def health():
    return {"status": "ok"}
`,
      'requirements.txt': `fastapi
uvicorn
`,
      '.gitignore': PYTHON_GITIGNORE,
    },
  },
  {
    id: 'rust',
    name: 'Rust',
    description:
      'A Rust project initialized with Cargo, ready for systems programming.',
    category: 'backend',
    icon: 'RS',
    setupCommands: ['cargo init .'],
    claudeMd: `# Project

## Overview
Rust project managed with Cargo.

## Stack
- Language: Rust
- Build: Cargo

## Commands
- Run: \`cargo run\`
- Build: \`cargo build --release\`
- Test: \`cargo test\`
- Check: \`cargo clippy\`

## Conventions
- Follow Rust naming conventions (snake_case for functions/variables, PascalCase for types)
- Use \`Result\` and \`Option\` instead of panicking
- Run \`cargo clippy\` before committing
- Write tests in the same file using \`#[cfg(test)]\` module
`,
    files: {},
  },
  {
    id: 'express-api',
    name: 'Express API',
    description:
      'A TypeScript Express.js REST API with CORS support and structured routing.',
    category: 'backend',
    icon: 'EX',
    setupCommands: [
      'npm init -y',
      'npm install express cors',
      'npm install -D @types/express @types/cors typescript tsx @types/node',
      'npx tsc --init',
    ],
    claudeMd: `# Project

## Overview
Express.js REST API with TypeScript.

## Stack
- Framework: Express.js
- Language: TypeScript
- Runner: tsx (for development)

## Commands
- Dev: \`npx tsx watch src/index.ts\`
- Build: \`npx tsc\`
- Start: \`node dist/index.js\`

## Conventions
- Source code lives in \`src/\`
- Routes go in \`src/routes/\`
- Middleware goes in \`src/middleware/\`
- Use async route handlers with try/catch
- Return consistent JSON responses: \`{ success: true, data }\` or \`{ success: false, error }\`
`,
    files: {
      'src/index.ts': `import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ message: 'Hello from Express!' })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`)
})
`,
      '.gitignore': NODE_GITIGNORE,
    },
  },
  {
    id: 'react-vite',
    name: 'React + Vite',
    description:
      'A React app scaffolded with Vite for lightning-fast development and HMR.',
    category: 'frontend',
    icon: 'RE',
    setupCommands: ['npm create vite@latest . -- --template react-ts'],
    claudeMd: `# Project

## Overview
React application built with Vite.

## Stack
- Framework: React 19
- Bundler: Vite
- Language: TypeScript

## Commands
- Dev: \`npm run dev\`
- Build: \`npm run build\`
- Preview: \`npm run preview\`

## Conventions
- Components go in \`src/components/\`
- Use functional components with hooks
- Use TypeScript interfaces for props
- Colocate styles with components
- Keep components small and focused
`,
    files: {},
  },
  {
    id: 'python-ml',
    name: 'Python ML/Data',
    description:
      'A Python data science environment with NumPy, Pandas, Matplotlib, scikit-learn, and Jupyter.',
    category: 'data',
    icon: 'ML',
    setupCommands: [
      'python3 -m venv .venv',
      'source .venv/bin/activate && pip install numpy pandas matplotlib scikit-learn jupyter',
    ],
    claudeMd: `# Project

## Overview
Python data science / machine learning project.

## Stack
- Language: Python 3
- Libraries: NumPy, Pandas, Matplotlib, scikit-learn
- Notebooks: Jupyter

## Commands
- Jupyter: \`source .venv/bin/activate && jupyter notebook\`
- Run script: \`source .venv/bin/activate && python script.py\`

## Conventions
- Use virtual environment in \`.venv/\`
- Keep notebooks in the root or \`notebooks/\` directory
- Use requirements.txt for dependency tracking
- Add docstrings to functions
- Use type hints where practical
`,
    files: {
      'notebook.ipynb': JSON.stringify(
        {
          nbformat: 4,
          nbformat_minor: 5,
          metadata: {
            kernelspec: {
              display_name: 'Python 3',
              language: 'python',
              name: 'python3',
            },
            language_info: {
              name: 'python',
              version: '3.11.0',
            },
          },
          cells: [
            {
              cell_type: 'markdown',
              metadata: {},
              source: ['# Data Analysis Notebook\n', '\n', 'Getting started with data exploration.'],
            },
            {
              cell_type: 'code',
              metadata: {},
              source: [
                'import numpy as np\n',
                'import pandas as pd\n',
                'import matplotlib.pyplot as plt\n',
                '\n',
                'print("Environment ready!")',
              ],
              outputs: [],
              execution_count: null,
            },
          ],
        },
        null,
        2
      ),
      'requirements.txt': `numpy
pandas
matplotlib
scikit-learn
jupyter
`,
      '.gitignore': PYTHON_GITIGNORE,
    },
  },
]

class TemplatesService {
  listTemplates(): ProjectTemplate[] {
    return TEMPLATES
  }

  getTemplate(id: string): ProjectTemplate | undefined {
    return TEMPLATES.find((t) => t.id === id)
  }

  async applyTemplate(
    projectPath: string,
    templateId: string
  ): Promise<{ filesCreated: string[]; commandsRun: string[]; errors: string[] }> {
    const template = this.getTemplate(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const filesCreated: string[] = []
    const commandsRun: string[] = []
    const errors: string[] = []

    // Write initial files
    for (const [relPath, content] of Object.entries(template.files)) {
      const fullPath = path.join(projectPath, relPath)
      try {
        await fs.mkdir(path.dirname(fullPath), { recursive: true })
        await fs.writeFile(fullPath, content, 'utf-8')
        filesCreated.push(relPath)
      } catch (err) {
        errors.push(`Failed to create ${relPath}: ${(err as Error).message}`)
      }
    }

    // Write CLAUDE.md
    if (template.claudeMd) {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md')
      try {
        await fs.writeFile(claudeMdPath, template.claudeMd, 'utf-8')
        filesCreated.push('CLAUDE.md')
      } catch (err) {
        errors.push(`Failed to create CLAUDE.md: ${(err as Error).message}`)
      }
    }

    // Run setup commands sequentially
    for (const cmd of template.setupCommands) {
      try {
        await execAsync(cmd, {
          cwd: projectPath,
          timeout: 120_000,
          env: { ...process.env, HOME: process.env.HOME },
        })
        commandsRun.push(cmd)
      } catch (err) {
        const message = (err as Error).message
        errors.push(`Command failed: ${cmd} — ${message}`)
        // Continue with remaining commands even if one fails
      }
    }

    return { filesCreated, commandsRun, errors }
  }
}

export const templatesService = new TemplatesService()
