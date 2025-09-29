import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export type HelpTopic = {
  id: string
  title: string
  route?: string
  roles?: string[]
  summary: string
  content: string
}

export type HelpGuide = {
  topics: HelpTopic[]
  lastLoaded: number
}

let cachedGuide: HelpGuide | null = null
let cachedMtime: number | null = null

const GUIDE_PATH = path.join(process.cwd(), 'USER_GUIDE.md')

function extractTopics(markdown: string): HelpTopic[] {
  const { content } = matter(markdown)
  const lines = content.split(/\r?\n/)
  const topics: HelpTopic[] = []
  let current: { title: string; content: string[] } | null = null

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) {
        topics.push({
          id: current.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: current.title,
          summary: current.content.slice(0, 4).join('\n'),
          content: current.content.join('\n')
        })
      }
      current = {
        title: line.replace(/^##\s+/, '').trim(),
        content: []
      }
      continue
    }

    if (current) {
      current.content.push(line)
    }
  }

  if (current) {
    topics.push({
      id: current.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: current.title,
      summary: current.content.slice(0, 4).join('\n'),
      content: current.content.join('\n')
    })
  }

  return topics
}

function loadGuideFresh(): HelpGuide {
  const stats = fs.statSync(GUIDE_PATH)
  const markdown = fs.readFileSync(GUIDE_PATH, 'utf-8')
  const topics = extractTopics(markdown)
  cachedGuide = {
    topics,
    lastLoaded: Date.now()
  }
  cachedMtime = stats.mtimeMs
  return cachedGuide
}

export function loadGuide(force = false): HelpGuide {
  if (!force && cachedGuide && cachedMtime) {
    try {
      const currentStats = fs.statSync(GUIDE_PATH)
      if (currentStats.mtimeMs === cachedMtime) {
        return cachedGuide
      }
    } catch (err) {
      // Fall through to reload on error
    }
  }

  return loadGuideFresh()
}

export function findTopicsByPage(route: string): HelpTopic[] {
  const guide = loadGuide()
  const normalizedRoute = route.replace(/\?.*$/, '')
  return guide.topics.filter((topic) => {
    if (!topic.route) return topic.title.includes(normalizedRoute)
    return topic.route === normalizedRoute
  })
}

export function searchTopics(query: string): HelpTopic[] {
  const guide = loadGuide()
  const normalized = query.toLowerCase()
  return guide.topics
    .map((topic) => ({
      topic,
      score:
        (topic.title.toLowerCase().includes(normalized) ? 2 : 0) +
        (topic.content.toLowerCase().includes(normalized) ? 1 : 0)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.topic)
}
