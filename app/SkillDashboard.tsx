"use client";

import { useMemo, useState } from "react";
import type { SkillRecord, SkillSummary, SkillSource } from "@/lib/skills";

type Props = {
  skills: SkillRecord[];
  summary: SkillSummary;
};

const sourceLabels: Record<SkillSource | "All", string> = {
  All: "全部",
  Claude: "克劳德目录",
  Codex: "Codex 目录",
  Plugin: "插件目录",
  Project: "项目目录",
};

function formatDate(value?: string) {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function callPrompt(skill: SkillRecord) {
  return `使用 $${skill.name} 帮我处理：`;
}

function hasChinese(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function cleanText(value: string) {
  return value
    .replace(/^description:\s*/i, "")
    .replace(/^trigger:\s*/i, "触发：")
    .replace(/^use when\s*/i, "适用场景：")
    .replace(/\s+/g, " ")
    .trim();
}

function chineseSummary(skill: SkillRecord) {
  const description = cleanText(skill.description);
  if (hasChinese(description)) {
    return description;
  }

  const lowerName = skill.name.toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (lowerName.includes("github") || lowerDescription.includes("github")) {
    return "用于处理 GitHub 仓库、议题、拉取请求、代码评审和发布相关任务。";
  }
  if (lowerName.includes("pdf") || lowerDescription.includes("pdf")) {
    return "用于处理 PDF 文件，包括读取、拆分、合并、转换、提取内容和表单相关任务。";
  }
  if (lowerName.includes("code") || lowerDescription.includes("coding")) {
    return "用于代码开发、代码修改、测试验证、代码审查和工程实现相关任务。";
  }
  if (lowerName.includes("browser") || lowerName.includes("browse") || lowerDescription.includes("browser")) {
    return "用于打开网页、测试页面流程、截图、检查响应式布局和验证前端交互。";
  }
  if (lowerName.includes("memory") || lowerDescription.includes("memory")) {
    return "用于读取、整理、检索和沉淀长期记忆或历史上下文。";
  }
  if (lowerName.includes("presentation") || lowerName.includes("ppt") || lowerDescription.includes("slide")) {
    return "用于制作、编辑、检查和导出演示文稿或幻灯片。";
  }
  if (lowerName.includes("spreadsheet") || lowerDescription.includes("spreadsheet")) {
    return "用于创建、分析、整理和导出表格数据。";
  }
  if (lowerName.includes("document") || lowerName.includes("docx")) {
    return "用于创建、编辑、整理和导出文档。";
  }
  if (lowerName.includes("image") || lowerDescription.includes("image")) {
    return "用于图片生成、图片编辑、视觉素材制作和相关提示词设计。";
  }
  if (lowerName.includes("video") || lowerDescription.includes("video")) {
    return "用于视频生成、剪辑、字幕、动画和视觉呈现相关任务。";
  }
  if (lowerName.includes("seo") || lowerDescription.includes("seo")) {
    return "用于搜索优化、内容策略、关键词分析和站点审计。";
  }

  return `用于处理 ${skill.name} 相关任务。具体规则较长，建议复制调用语句后说明你的目标。`;
}

function chineseTrigger(trigger: string, skill: SkillRecord) {
  const text = cleanText(trigger);
  if (hasChinese(text)) {
    return text;
  }

  const lower = text.toLowerCase();
  if (lower.includes("use when") || lower.includes("trigger")) {
    return `当任务和 ${skill.name} 的用途匹配时调用。`;
  }
  if (lower.includes("review")) {
    return "需要审查、检查或给出改进意见时调用。";
  }
  if (lower.includes("test") || lower.includes("verify")) {
    return "需要测试、验证结果或复现问题时调用。";
  }
  if (lower.includes("create") || lower.includes("generate")) {
    return "需要创建、生成或产出成品时调用。";
  }
  return `需要 ${skill.name} 相关能力时调用。`;
}

export default function SkillDashboard({ skills, summary }: Props) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SkillSource | "All">("All");
  const [sort, setSort] = useState<"usage" | "name">("usage");
  const [copied, setCopied] = useState("");

  const filteredSkills = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matches = skills.filter((skill) => {
      const sourceMatch = source === "All" || skill.sources.includes(source);
      const text = `${skill.name} ${skill.description} ${skill.paths.join(" ")} ${skill.triggers.join(" ")}`.toLowerCase();
      return sourceMatch && (!keyword || text.includes(keyword));
    });

    return matches.sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }
      return b.usageCount - a.usageCount || a.name.localeCompare(b.name);
    });
  }, [query, skills, sort, source]);

  async function copySkill(skill: SkillRecord) {
    const text = callPrompt(skill);
    await navigator.clipboard.writeText(text);
    setCopied(`call:${skill.name}`);
    window.setTimeout(() => setCopied(""), 1400);
  }

  async function copyPath(skill: SkillRecord) {
    await navigator.clipboard.writeText(skill.directory);
    setCopied(`path:${skill.name}`);
    window.setTimeout(() => setCopied(""), 1400);
  }

  return (
    <section className="skills-panel">
      <div className="skills-top">
        <div>
          <p className="eyebrow">技能控制台</p>
          <h1>技能面板</h1>
          <p>
            扫描本机已安装的技能说明文件，整理用途、来源、调用入口和 Chronicle 记忆里出现过的次数。
          </p>
        </div>
      </div>

      <div className="stat-grid skills-stat-grid">
        <div>
          <span>去重技能</span>
          <strong>{summary.total}</strong>
        </div>
        <div>
          <span>安装副本</span>
          <strong>{summary.installations}</strong>
        </div>
        <div>
          <span>有使用记录</span>
          <strong>{summary.used}</strong>
        </div>
      </div>

      <div className="skills-source-strip" aria-label="技能来源统计">
        {Object.entries(summary.sourceCounts).map(([key, value]) => (
          <span key={key}>
            {sourceLabels[key as SkillSource]} <strong>{value}</strong>
          </span>
        ))}
      </div>

      {summary.topSkills.length > 0 && (
        <div className="skills-top-list">
          <span>高频调用</span>
          {summary.topSkills.map((skill) => (
            <button key={skill.path} type="button" onClick={() => setQuery(skill.name)}>
              {skill.name}
              <strong>{skill.usageCount}</strong>
            </button>
          ))}
        </div>
      )}

      <div className="skills-toolbar">
        <label>
          <span>搜索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="名称、用途、路径或触发词"
          />
        </label>
        <label>
          <span>来源</span>
          <select value={source} onChange={(event) => setSource(event.target.value as SkillSource | "All")}>
            {Object.entries(sourceLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>排序</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as "usage" | "name")}>
            <option value="usage">使用次数</option>
            <option value="name">名称</option>
          </select>
        </label>
      </div>

      <div className="skills-count">
        显示 <strong>{filteredSkills.length}</strong> 个技能
      </div>

      <div className="skills-grid">
        {filteredSkills.map((skill) => (
          <article className="skill-card" key={skill.path}>
            <div className="skill-card-head">
              <div>
                <span>{skill.sources.map((item) => sourceLabels[item]).join(" / ")}</span>
                <h2>{skill.name}</h2>
              </div>
              <strong>{skill.usageCount}</strong>
            </div>

            <p>{chineseSummary(skill)}</p>

            <dl className="skill-meta">
              <div>
                <dt>最近出现</dt>
                <dd>{formatDate(skill.lastMentionedAt)}</dd>
              </div>
              <div>
                <dt>版本</dt>
                <dd>{skill.version ?? "未写明"}</dd>
              </div>
              <div>
                <dt>副本</dt>
                <dd>{skill.paths.length}</dd>
              </div>
            </dl>

            <div className="skill-trigger">
              <span>什么时候用</span>
              <ul>
                {skill.triggers.slice(0, 3).map((trigger) => (
                  <li key={trigger}>{chineseTrigger(trigger, skill)}</li>
                ))}
              </ul>
            </div>

            <code>{skill.path}</code>

            <div className="skill-card-actions">
              <button className="ritual-button" type="button" onClick={() => copySkill(skill)}>
                {copied === `call:${skill.name}` ? "已复制" : "复制调用语句"}
              </button>
              <button className="minor-button" type="button" onClick={() => copyPath(skill)}>
                {copied === `path:${skill.name}` ? "已复制" : "复制目录"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
