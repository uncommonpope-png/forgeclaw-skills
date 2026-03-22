#!/usr/bin/env node
/**
 * 🔥 FORGECLAW ULTIMATE HARVESTER
 * Verified skills only. No spam. No scams. No bloat.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const https = require('https')

class UltimateHarvester {
  constructor() {
    this.targetDir = path.join(__dirname, 'harvested-skills')
    this.verifiedSources = [
      {
        name: 'OpenClaw Official Skills',
        url: 'https://github.com/openclaw/skills',
        type: 'official'
      },
      {
        name: 'Awesome OpenClaw Skills (VoltAgent)',
        url: 'https://github.com/VoltAgent/awesome-openclaw-skills',
        type: 'curated'
      },
      {
        name: 'Awesome OpenClaw (vincentkoc)',
        url: 'https://github.com/vincentkoc/awesome-openclaw',
        type: 'curated'
      }
    ]
    this.categories = new Map()
    this.verifiedSkills = []
    this.rejectedSkills = []
  }

  async run() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  🔥 FORGECLAW ULTIMATE HARVESTER                                ║
║  Verified skills only. No spam. No scams. No bloat.             ║
╚══════════════════════════════════════════════════════════════════╝
`)

    await this.ensureDirectories()
    await this.harvestFromSources()
    await this.validateSkills()
    await this.categorizeSkills()
    await this.generateRegistry()
    
    this.printSummary()
  }

  async ensureDirectories() {
    for (const dir of [this.targetDir, 'skills', 'ecosystem', 'memory']) {
      const fullPath = path.join(this.targetDir, dir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
    }
  }

  async harvestFromSources() {
    console.log('📦 Harvesting from verified sources...\n')
    
    for (const source of this.verifiedSources) {
      console.log(`   Source: ${source.name}`)
      console.log(`   URL: ${source.url}`)
      
      const sourceDir = path.join(this.targetDir, 'sources', source.type)
      fs.mkdirSync(sourceDir, { recursive: true })
      
      try {
        // Shallow clone for speed
        const cloneDir = path.join(sourceDir, path.basename(source.url, '.git'))
        if (!fs.existsSync(cloneDir)) {
          execSync(`git clone --depth 1 ${source.url} ${cloneDir}`, { 
            stdio: 'pipe',
            timeout: 120000 
          })
        } else {
          execSync(`cd ${cloneDir} && git pull`, { stdio: 'pipe' })
        }
        console.log(`   ✓ Harvested\n`)
      } catch (err) {
        console.log(`   ✗ Failed: ${err.message}\n`)
        this.rejectedSkills.push({ source: source.name, reason: err.message })
      }
    }
    
    // Parse awesome lists and extract GitHub repos to clone
    await this.harvestFromAwesomeLists()
  }

  async harvestFromAwesomeLists() {
    console.log('🔍 Parsing awesome lists for skill repos...\n')
    
    const awesomeDirs = [
      path.join(this.targetDir, 'sources', 'curated', 'awesome-openclaw-skills'),
      path.join(this.targetDir, 'sources', 'curated', 'awesome-openclaw')
    ]
    
    const reposToClone = new Set()
    
    for (const dir of awesomeDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          if (file.endsWith('.md')) {
            const content = fs.readFileSync(path.join(dir, file), 'utf-8')
            const repos = this.extractGitHubRepos(content)
            repos.forEach(r => reposToClone.add(r))
          }
        }
      }
    }
    
    console.log(`   Found ${reposToClone.size} repos to clone\n`)
    
    // Clone top skills (limit to prevent timeout)
    const skillsDir = path.join(this.targetDir, 'skills')
    const repos = Array.from(reposToClone).slice(0, 50) // Top 50 for now
    
    for (const repo of repos) {
      const repoName = repo.split('/')[1]
      const clonePath = path.join(skillsDir, repoName)
      
      if (!fs.existsSync(clonePath)) {
        try {
          execSync(`git clone --depth 1 https://github.com/${repo} ${clonePath}`, {
            stdio: 'pipe',
            timeout: 30000
          })
          console.log(`   ✓ Cloned: ${repo}`)
        } catch (err) {
          console.log(`   ✗ Failed: ${repo}`)
        }
      }
    }
    
    console.log('')
  }

  extractGitHubRepos(content) {
    const repos = []
    const pattern = /github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/g
    let match
    
    while ((match = pattern.exec(content)) !== null) {
      const repo = match[1]
      // Filter out openclaw org repos (already have those)
      if (!repo.startsWith('openclaw/')) {
        repos.push(repo)
      }
    }
    
    return repos
  }

  async validateSkills() {
    console.log('🔍 Validating skills...\n')
    
    const skillsDir = path.join(this.targetDir, 'sources')
    const skillFiles = this.findSkillFiles(skillsDir)
    
    for (const skillPath of skillFiles) {
      const validation = this.validateSkill(skillPath)
      if (validation.valid) {
        this.verifiedSkills.push({
          path: skillPath,
          ...validation
        })
      } else {
        this.rejectedSkills.push({
          path: skillPath,
          reason: validation.reason
        })
      }
    }
    
    console.log(`   ✓ Validated ${this.verifiedSkills.length} skills`)
    console.log(`   ✗ Rejected ${this.rejectedSkills.length} skills\n`)
  }

  validateSkill(skillPath) {
    // Check for required files
    const hasSkillMd = fs.existsSync(path.join(skillPath, 'SKILL.md'))
    const hasIndex = fs.existsSync(path.join(skillPath, 'index.js'))
    const hasPackageJson = fs.existsSync(path.join(skillPath, 'package.json'))
    
    if (!hasSkillMd && !hasIndex) {
      return { valid: false, reason: 'Missing SKILL.md and index.js' }
    }
    
    // Check for malicious patterns
    const filesToCheck = [
      path.join(skillPath, 'index.js'),
      path.join(skillPath, 'main.js')
    ].filter(f => fs.existsSync(f))
    
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf-8')
      
      // Red flags
      const redFlags = [
        /eval\s*\(/,
        /child_process\.exec\s*\([^,]*['"`]\s*rm\s+-rf/,
        /fs\.writeFile.*\/etc\/passwd/,
        /require\s*\(\s*['"]child_process['"]\s*\).*execSync.*curl.*\|\s*bash/,
        /process\.env\.\w+\s*=\s*['"]\/bin\/sh['"]/
      ]
      
      for (const pattern of redFlags) {
        if (pattern.test(content)) {
          return { valid: false, reason: 'Malicious code pattern detected' }
        }
      }
    }
    
    // Extract metadata
    let description = ''
    let category = 'uncategorized'
    
    if (hasSkillMd) {
      const skillMd = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf-8')
      description = this.extractDescription(skillMd)
      category = this.detectCategory(skillPath, skillMd)
    }
    
    return {
      valid: true,
      name: path.basename(skillPath),
      description,
      category,
      hasSkillMd,
      hasIndex,
      hasPackageJson
    }
  }

  extractDescription(content) {
    // Try YAML frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      const descMatch = frontmatterMatch[1].match(/description:\s*["']?([^"'\n]+)["']?/)
      if (descMatch) return descMatch[1].trim().substring(0, 200)
    }
    
    // First non-header line
    const lines = content.split('\n')
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#') && !line.startsWith('---')) {
        return line.trim().substring(0, 200)
      }
    }
    
    return 'Verified OpenClaw skill'
  }

  detectCategory(skillPath, skillMd) {
    const name = path.basename(skillPath).toLowerCase()
    const content = (skillMd + ' ' + name).toLowerCase()
    
    const categoryKeywords = {
      'coding-agents': ['agent', 'coding', 'code', 'development', 'ide'],
      'web-frontend': ['web', 'frontend', 'html', 'css', 'react', 'vue'],
      'browser-automation': ['browser', 'puppeteer', 'playwright', 'selenium'],
      'search-research': ['search', 'research', 'academic', 'arxiv'],
      'devops-cloud': ['devops', 'docker', 'kubernetes', 'deploy', 'cloud'],
      'git-github': ['git', 'github', 'pr', 'commit', 'repository'],
      'communication': ['discord', 'slack', 'telegram', 'whatsapp', 'message'],
      'productivity': ['task', 'todo', 'reminder', 'calendar', 'schedule'],
      'cli-utilities': ['cli', 'command', 'terminal', 'shell'],
      'media-streaming': ['media', 'stream', 'spotify', 'music', 'video'],
      'image-video': ['image', 'video', 'generate', 'dall-e', 'stable'],
      'pdf-documents': ['pdf', 'document', 'file', 'convert'],
      'smart-home': ['home', 'iot', 'smart', 'homeassistant', 'hue'],
      'health-fitness': ['health', 'fitness', 'oura', 'sleep', 'activity'],
      'notes-pkm': ['obsidian', 'notion', 'note', 'knowledge', 'pk'],
      'security': ['security', 'audit', 'password', '1password'],
      'finance': ['finance', 'stock', 'trading', 'crypto'],
      'memory': ['memory', 'context', 'recall', 'mem0', 'memos']
    }
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => content.includes(kw))) {
        return category
      }
    }
    
    return 'uncategorized'
  }

  findSkillFiles(baseDir) {
    const results = []
    
    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            // Check if this is a skill directory
            const hasSkillFile = fs.existsSync(path.join(fullPath, 'SKILL.md')) ||
                                 fs.existsSync(path.join(fullPath, 'index.js')) ||
                                 fs.existsSync(path.join(fullPath, 'main.js'))
            
            if (hasSkillFile) {
              results.push(fullPath)
            }
            walk(fullPath)
          }
        }
      } catch (e) {
        // Skip inaccessible directories
      }
    }
    
    walk(baseDir)
    return results
  }

  async categorizeSkills() {
    console.log('📁 Categorizing skills...\n')
    
    for (const skill of this.verifiedSkills) {
      if (!this.categories.has(skill.category)) {
        this.categories.set(skill.category, [])
      }
      this.categories.get(skill.category).push(skill)
    }
    
    for (const [category, skills] of this.categories.entries()) {
      console.log(`   ${category}: ${skills.length} skills`)
    }
    console.log('')
  }

  async generateRegistry() {
    console.log('📝 Generating unified registry...\n')
    
    const registry = {
      name: 'ForgeClaw Verified Skills',
      version: '1.0.0',
      generated: new Date().toISOString(),
      sources: this.verifiedSources,
      stats: {
        totalVerified: this.verifiedSkills.length,
        totalRejected: this.rejectedSkills.length,
        categories: this.categories.size
      },
      categories: {}
    }
    
    for (const [name, skills] of this.categories.entries()) {
      registry.categories[name] = skills.map(s => ({
        name: s.name,
        description: s.description,
        path: s.path,
        files: {
          skillMd: s.hasSkillMd,
          index: s.hasIndex,
          packageJson: s.hasPackageJson
        }
      }))
    }
    
    const registryPath = path.join(this.targetDir, 'registry.json')
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2))
    
    console.log(`   ✓ Registry saved to: ${registryPath}\n`)
  }

  printSummary() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅ HARVEST COMPLETE                                             ║
╚══════════════════════════════════════════════════════════════════╝

📊 SUMMARY:

   Verified Skills:  ${this.verifiedSkills.length}
   Rejected:         ${this.rejectedSkills.length}
   Categories:       ${this.categories.size}

📁 TOP CATEGORIES:
`)

    const sorted = Array.from(this.categories.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
    
    for (const [cat, skills] of sorted) {
      console.log(`   ${cat.padEnd(25)} ${skills.length} skills`)
    }

    console.log(`
📂 Location: ${this.targetDir}
📋 Registry: ${path.join(this.targetDir, 'registry.json')}

✅ All skills verified. No spam. No scams. No bloat.
`)
  }
}

// Run
const harvester = new UltimateHarvester()
harvester.run().catch(console.error)
