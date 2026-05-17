/**
 * @mc-forgelab/template-engine — 阶段 3 实施
 *
 * 契约：
 * - renderTemplate(templateId, spec, outputDir): Promise<RenderedFile[]>
 * - listTemplates(targetId?): TemplateMeta[]
 * - dryRun(...): RenderedFile[] without writing to disk
 * - 覆盖保护、路径穿越防护、生成后格式化（formatter 可插拔）
 */

import type { ProjectSpec } from "@mc-forgelab/project-model";

export interface TemplateMeta {
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly compatibleTargetIds: ReadonlyArray<string>;
  readonly descriptionZh: string;
  readonly descriptionEn: string;
}

export interface RenderedFile {
  readonly relativePath: string;
  readonly content: string;
  readonly mode?: number;
}

export interface RenderOptions {
  readonly dryRun?: boolean;
  readonly overwrite?: boolean;
}

export function listTemplates(_targetId?: string): TemplateMeta[] {
  return [];
}

export async function renderTemplate(
  templateId: string,
  spec: ProjectSpec,
  outputDir: string,
  _options: RenderOptions = {}
): Promise<RenderedFile[]> {
  throw new Error(
    `template-engine.renderTemplate: not implemented (stage 3). templateId=${templateId} slug=${spec.slug} dir=${outputDir}`
  );
}
