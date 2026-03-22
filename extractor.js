#!/usr/bin/env node
/**
 * FORGECLAW SKILL EXTRACTOR
 * Extracts skills from OpenClaw repository for standalone use
 * MIT License - OpenClaw authors retain original copyright
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const https = require('https')

class SkillExtractor {
  constructor() {
    this.openclawDir = './openclaw-source'
    this.outputDir = './forgeclaw_skills'
    this.skills = []
  }

  async run() {
    console.log(`
╔══════════════════════════════════════════════════════╗
║     🔥 FORGECLAW SKILL EXTRACTOR                    ║
║     Extracting OpenClaw skills for standalone use   ║
╚══════════════════════════════════════════════════════╝
`)

    await this.cloneOpenClaw()
    await this.extractSkills()
    await this.createSkillRegistry()
    await this.generateReadme()
    
    console.log(`
✅ EXTRACTION COMPLETE!

Skills location: ${path.resolve(this.outputDir)}/skills/
Registry: ${path.resolve(this.outputDir)}/registry.json

Extracted ${this.skills.length} skills ready for use.
`)
  }

  async cloneOpenClaw() {
    console.log('📦 Cloning OpenClaw repository...')
    
    if (fs.existsSync(this.openclawDir)) {
      console.log('   ✓ Source already exists, updating...')
      execSync(`cd ${this.openclawDir} && git pull`, { stdio: 'pipe' })
    } else {
      execSync(`git clone --depth 1 https://github.com/openclaw/openclaw.git ${this.openclawDir}`, { 
        stdio: 'inherit' 
      })
    }
    console.log('   ✓ OpenClaw source ready')
  }

  async extractSkills() {
    console.log('🔧 Extracting skills...')
    
    const skillsDir = path.join(this.openclawDir, 'skills')
    const packagesDir = path.join(this.openclawDir, 'packages')
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
    if (!fs.existsSync(path.join(this.outputDir, 'skills'))) {
      fs.mkdirSync(path.join(this.outputDir, 'skills'), { recursive: true })
    }

    // Extract from skills directory
    if (fs.existsSync(skillsDir)) {
      const skillFiles = this.findSkillFiles(skillsDir)
      for (const skillPath of skillFiles) {
        const skill = this.processSkill(skillPath)
        if (skill) {
          this.skills.push(skill)
          this.saveSkill(skill)
        }
      }
    }

    // Extract from packages directory (shared packages may contain skills)
    if (fs.existsSync(packagesDir)) {
      const packageSkills = this.findPackageSkills(packagesDir)
      for (const skill of packageSkills) {
        this.skills.push(skill)
        this.saveSkill(skill)
      }
    }

    console.log(`   ✓ Extracted ${this.skills.length} skills`)
  }

  findSkillFiles(dir) {
    const results = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        // Check if this directory contains a skill
        const skillFile = path.join(fullPath, 'SKILL.md')
        const indexFile = path.join(fullPath, 'index.js')
        const mainFile = path.join(fullPath, 'main.js')
        
        if (fs.existsSync(skillFile) || fs.existsSync(indexFile) || fs.existsSync(mainFile)) {
          results.push(fullPath)
        }
        
        // Recurse into subdirectories
        results.push(...this.findSkillFiles(fullPath))
      }
    }
    
    return results
  }

  processSkill(skillDir) {
    const skillName = path.basename(skillDir)
    const skillData = {
      name: skillName,
      description: '',
      version: '1.0.0',
      files: [],
      dependencies: []
    }

    // Read SKILL.md if exists
    const skillMdPath = path.join(skillDir, 'SKILL.md')
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf-8')
      skillData.description = this.extractDescription(content)
      skillData.dependencies = this.extractDependencies(content)
    }

    // Copy all files from skill directory
    const files = fs.readdirSync(skillDir)
    for (const file of files) {
      const filePath = path.join(skillDir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isFile()) {
        skillData.files.push({
          name: file,
          content: fs.readFileSync(filePath, 'utf-8')
        })
      }
    }

    return skillData
  }

  extractDescription(content) {
    // Try to extract from YAML frontmatter first
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1]
      const descMatch = frontmatter.match(/description:\s*["']?([^"'\n]+)["']?/)
      if (descMatch) {
        return descMatch[1].trim().substring(0, 200)
      }
    }
    
    // Fall back to first non-header line
    const lines = content.split('\n')
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#') && !line.startsWith('---')) {
        return line.trim().substring(0, 200)
      }
    }
    return 'Extracted OpenClaw skill'
  }

  extractDependencies(content) {
    const deps = []
    const depMatch = content.match(/dependencies?:\s*\[([^\]]+)\]/i)
    if (depMatch) {
      return depMatch[1].split(',').map(d => d.trim().replace(/['"]/g, ''))
    }
    return deps
  }

  findPackageSkills(packagesDir) {
    const skills = []
    const packages = fs.readdirSync(packagesDir)
    
    for (const pkg of packages) {
      const pkgDir = path.join(packagesDir, pkg)
      const stat = fs.statSync(pkgDir)
      
      if (stat.isDirectory()) {
        const pkgJsonPath = path.join(pkgDir, 'package.json')
        if (fs.existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
          
          if (pkgJson.keywords?.includes('skill') || pkgJson.keywords?.includes('openclaw')) {
            skills.push({
              name: pkg,
              description: pkgJson.description || 'Package skill',
              version: pkgJson.version || '1.0.0',
              files: this.collectPackageFiles(pkgDir),
              dependencies: pkgJson.dependencies ? Object.keys(pkgJson.dependencies) : []
            })
          }
        }
      }
    }
    
    return skills
  }

  collectPackageFiles(dir) {
    const files = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith('.') && !entry.name.includes('node_modules')) {
        const fullPath = path.join(dir, entry.name)
        files.push({
          name: entry.name,
          content: fs.readFileSync(fullPath, 'utf-8')
        })
      }
    }
    
    return files
  }

  saveSkill(skill) {
    const skillOutputDir = path.join(this.outputDir, 'skills', skill.name)
    fs.mkdirSync(skillOutputDir, { recursive: true })
    
    for (const file of skill.files) {
      const filePath = path.join(skillOutputDir, file.name)
      fs.writeFileSync(filePath, file.content)
    }

    // Create manifest
    const manifest = {
      name: skill.name,
      description: skill.description,
      version: skill.version,
      source: 'OpenClaw (MIT License)',
      extracted: new Date().toISOString()
    }
    fs.writeFileSync(path.join(skillOutputDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  }

  async createSkillRegistry() {
    console.log('📋 Creating skill registry...')
    
    const registry = {
      name: 'ForgeClaw Skills',
      version: '1.0.0',
      source: 'OpenClaw (MIT License)',
      extracted: new Date().toISOString(),
      skills: this.skills.map(s => ({
        name: s.name,
        description: s.description,
        version: s.version,
        dependencies: s.dependencies
      }))
    }
    
    fs.writeFileSync(
      path.join(this.outputDir, 'registry.json'),
      JSON.stringify(registry, null, 2)
    )
    
    console.log('   ✓ Registry created')
  }

  async generateReadme() {
    console.log('📖 Generating README...')
    
    const readme = `# ForgeClaw Skills

Extracted skills from OpenClaw for standalone use.

## License

Original skills are © OpenClaw authors, released under MIT License.
See individual skill directories for full license text.

## Extracted Skills

| Skill | Description |
|-------|-------------|
${this.skills.map(s => `| ${s.name} | ${s.description.substring(0, 50)}... |`).join('\n')}

## Usage

Each skill is in its own directory under \`./skills/\`.
Refer to the skill's \`SKILL.md\` or \`manifest.json\` for usage instructions.

## Attribution

These skills were extracted from:
- Repository: https://github.com/openclaw/openclaw
- License: MIT
- Original Authors: OpenClaw Contributors

## ForgeClaw Enhancements

Skills extracted using ForgeClaw Skill Extractor.
`
    
    fs.writeFileSync(path.join(this.outputDir, 'README.md'), readme)
    console.log('   ✓ README generated')
  }
}

// Run
const extractor = new SkillExtractor()
extractor.run().catch(console.error)
