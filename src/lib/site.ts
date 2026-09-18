// Learn FDE 站点共享常量与工具

export interface Category {
  slug: string;
  cn: string;
  en: string;
}

export const CATEGORIES: Category[] = [
  { slug: 'fde-basics', cn: 'FDE 是什么', en: 'What is FDE' },
  { slug: 'five-stations', cn: '五站方法论', en: 'The 5-Station Method' },
  { slug: 'cases', cn: '实战案例', en: 'Real Cases' },
  { slug: 'tools-agents', cn: '工具与 Agent', en: 'Tools & Agents' },
  { slug: 'courses', cn: '课程与训练营', en: 'Courses & Bootcamp' },
  { slug: 'enterprise', cn: '行业与企业应用', en: 'Enterprise Applications' },
];

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
);

export interface AudiencePath {
  id: string;
  cn: string;
  en: string;
  desc: string;
}

export const PATHS: AudiencePath[] = [
  {
    id: '01',
    cn: '从零认识 FDE',
    en: 'For Beginners',
    desc: '0 基础自学路线：FDE 到底是什么、要会什么、怎么一步步入门。从「FDE 是什么」开始。',
  },
  {
    id: '02',
    cn: '进阶方法论与工具',
    en: 'For Practitioners',
    desc: '已经在 FDE 一线：五站方法论、证据循环法、eval 与采纳、可复用的 Agent 与 Skill。',
  },
  {
    id: '03',
    cn: '把 AI 落进生意',
    en: 'For Business',
    desc: '企业视角：怎么挑活、怎么用 PoC 证明、怎么让生意单元真正采纳，不被「买了不用」坑。',
  },
];

// 三条路径对应的一级分类串联顺序（学习逻辑）
export const PATH_CATEGORIES: Record<string, string[]> = {
  '01': ['fde-basics', 'cases', 'courses', 'five-stations'],
  '02': ['five-stations', 'tools-agents', 'cases'],
  '03': ['enterprise', 'cases', 'five-stations'],
};

export const TYPE_LABELS: Record<string, string> = {
  article: '文章',
  video: '视频',
  podcast: '播客',
  tool: '工具',
  agent: 'Agent',
  skill: 'Skill',
};

export function categoryLabel(slug: string): string {
  return CATEGORY_MAP[slug]?.cn ?? slug;
}
