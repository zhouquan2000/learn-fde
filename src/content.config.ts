import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Learn FDE 内容库 schema —— 一级分类 × 内容形式 × 标签
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    titleEn: z.string(),
    description: z.string(),
    category: z.enum([
      'fde-basics', // FDE 是什么
      'five-stations', // 五站方法论
      'cases', // 实战案例
      'tools-agents', // 工具与 Agent
      'courses', // 课程与训练营
      'enterprise', // 行业与企业应用
    ]),
    type: z.enum(['article', 'video', 'podcast', 'tool', 'agent', 'skill']),
    audience: z.array(z.enum(['beginner', 'practitioner', 'business'])).default([]),
    lang: z.string().default('zh'),
    source: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { posts };
