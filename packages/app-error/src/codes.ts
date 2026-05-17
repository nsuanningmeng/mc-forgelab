/**
 * 错误码集中目录。所有 AppError 必须引用 ErrorCode，禁止使用 free-form string。
 *
 * 命名规范：`MCF_<域>_<语义>`，全大写，下划线。
 * 域：CORE / CONFIG / STORAGE / TARGET / COMPAT / TOOLCHAIN / TEMPLATE / BUILD / ARTIFACT / API / AUTH / CLI
 */
export const ErrorCode = {
  // Core
  CORE_PATH_ESCAPE: "MCF_CORE_PATH_ESCAPE",
  CORE_INVALID_INPUT: "MCF_CORE_INVALID_INPUT",
  CORE_NOT_IMPLEMENTED: "MCF_CORE_NOT_IMPLEMENTED",
  CORE_INTERNAL: "MCF_CORE_INTERNAL",

  // Config
  CONFIG_MISSING_KEY: "MCF_CONFIG_MISSING_KEY",
  CONFIG_INVALID_VALUE: "MCF_CONFIG_INVALID_VALUE",
  CONFIG_LOAD_FAILED: "MCF_CONFIG_LOAD_FAILED",

  // Storage
  STORAGE_OPEN_FAILED: "MCF_STORAGE_OPEN_FAILED",
  STORAGE_MIGRATION_FAILED: "MCF_STORAGE_MIGRATION_FAILED",
  STORAGE_QUERY_FAILED: "MCF_STORAGE_QUERY_FAILED",

  // Target Registry
  TARGET_NOT_FOUND: "MCF_TARGET_NOT_FOUND",
  TARGET_DUPLICATE_ID: "MCF_TARGET_DUPLICATE_ID",

  // Compatibility
  COMPAT_RULE_FAILED: "MCF_COMPAT_RULE_FAILED",
  COMPAT_BLOCKING: "MCF_COMPAT_BLOCKING",

  // CLI
  CLI_UNKNOWN_COMMAND: "MCF_CLI_UNKNOWN_COMMAND",
  CLI_USAGE_ERROR: "MCF_CLI_USAGE_ERROR",

  // AI Provider
  AI_PROVIDER_NOT_FOUND: "MCF_AI_PROVIDER_NOT_FOUND",
  AI_PROVIDER_DISABLED: "MCF_AI_PROVIDER_DISABLED",
  AI_PROVIDER_AUTH_FAILED: "MCF_AI_PROVIDER_AUTH_FAILED",
  AI_PROVIDER_RATE_LIMITED: "MCF_AI_PROVIDER_RATE_LIMITED",
  AI_PROVIDER_UPSTREAM_TIMEOUT: "MCF_AI_PROVIDER_UPSTREAM_TIMEOUT",
  AI_PROVIDER_INSUFFICIENT_QUOTA: "MCF_AI_PROVIDER_INSUFFICIENT_QUOTA",
  AI_PROVIDER_MODEL_NOT_FOUND: "MCF_AI_PROVIDER_MODEL_NOT_FOUND",
  AI_PROVIDER_STREAM_INTERRUPTED: "MCF_AI_PROVIDER_STREAM_INTERRUPTED",
  AI_PROVIDER_JSON_PARSE_FAILED: "MCF_AI_PROVIDER_JSON_PARSE_FAILED",
  AI_PROVIDER_CONTEXT_TOO_LONG: "MCF_AI_PROVIDER_CONTEXT_TOO_LONG",
  AI_PROVIDER_INVALID_RESPONSE: "MCF_AI_PROVIDER_INVALID_RESPONSE",
  AI_PROVIDER_CONNECT_FAILED: "MCF_AI_PROVIDER_CONNECT_FAILED",

  // AI Workflow
  AI_WORKFLOW_NOT_FOUND: "MCF_AI_WORKFLOW_NOT_FOUND",
  AI_WORKFLOW_RUN_NOT_FOUND: "MCF_AI_WORKFLOW_RUN_NOT_FOUND",
  AI_WORKFLOW_STEP_FAILED: "MCF_AI_WORKFLOW_STEP_FAILED",
  AI_WORKFLOW_CANCELED: "MCF_AI_WORKFLOW_CANCELED",

  // File Operation
  FILE_OP_PATH_UNSAFE: "MCF_FILE_OP_PATH_UNSAFE",
  FILE_OP_TOO_LARGE: "MCF_FILE_OP_TOO_LARGE",
  FILE_OP_NOT_FOUND: "MCF_FILE_OP_NOT_FOUND",
  FILE_OP_PATCH_INVALID: "MCF_FILE_OP_PATCH_INVALID",

  // 后续阶段保留
  TOOLCHAIN_NOT_INSTALLED: "MCF_TOOLCHAIN_NOT_INSTALLED",
  TEMPLATE_RENDER_FAILED: "MCF_TEMPLATE_RENDER_FAILED",
  BUILD_FAILED: "MCF_BUILD_FAILED",
  BUILD_CANCELED: "MCF_BUILD_CANCELED",
  ARTIFACT_NOT_FOUND: "MCF_ARTIFACT_NOT_FOUND",
  API_BAD_REQUEST: "MCF_API_BAD_REQUEST",
  API_UNAUTHORIZED: "MCF_API_UNAUTHORIZED",
  API_FORBIDDEN: "MCF_API_FORBIDDEN",
  API_NOT_FOUND: "MCF_API_NOT_FOUND",
  API_RATE_LIMITED: "MCF_API_RATE_LIMITED"
} as const;

export type ErrorCodeKey = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorCatalogEntry {
  readonly code: ErrorCodeKey;
  readonly httpStatus: number;
  readonly messageZh: string;
  readonly messageEn: string;
  readonly fixSuggestionZh?: string;
  readonly fixSuggestionEn?: string;
}

/**
 * 默认错误目录。AppError 可携带自定义 messageZh/En 覆盖此处缺省值，
 * 但 code → httpStatus 的映射由此表权威决定。
 */
export const ERROR_CATALOG: Readonly<Record<ErrorCodeKey, ErrorCatalogEntry>> = {
  [ErrorCode.CORE_PATH_ESCAPE]: {
    code: ErrorCode.CORE_PATH_ESCAPE,
    httpStatus: 400,
    messageZh: "请求路径逃逸了允许的根目录。",
    messageEn: "Requested path escapes the allowed base directory.",
    fixSuggestionZh: "检查输入路径，不要使用 .. 或绝对路径。",
    fixSuggestionEn: "Avoid using .. segments or absolute paths."
  },
  [ErrorCode.CORE_INVALID_INPUT]: {
    code: ErrorCode.CORE_INVALID_INPUT,
    httpStatus: 400,
    messageZh: "请求参数不合法。",
    messageEn: "Invalid input."
  },
  [ErrorCode.CORE_NOT_IMPLEMENTED]: {
    code: ErrorCode.CORE_NOT_IMPLEMENTED,
    httpStatus: 501,
    messageZh: "该功能在当前阶段尚未实现。",
    messageEn: "This feature is not implemented in the current stage."
  },
  [ErrorCode.CORE_INTERNAL]: {
    code: ErrorCode.CORE_INTERNAL,
    httpStatus: 500,
    messageZh: "服务器内部错误。",
    messageEn: "Internal server error."
  },
  [ErrorCode.CONFIG_MISSING_KEY]: {
    code: ErrorCode.CONFIG_MISSING_KEY,
    httpStatus: 500,
    messageZh: "配置项缺失。",
    messageEn: "Required configuration key is missing."
  },
  [ErrorCode.CONFIG_INVALID_VALUE]: {
    code: ErrorCode.CONFIG_INVALID_VALUE,
    httpStatus: 500,
    messageZh: "配置项值无效。",
    messageEn: "Configuration value is invalid."
  },
  [ErrorCode.CONFIG_LOAD_FAILED]: {
    code: ErrorCode.CONFIG_LOAD_FAILED,
    httpStatus: 500,
    messageZh: "配置加载失败。",
    messageEn: "Failed to load configuration."
  },
  [ErrorCode.STORAGE_OPEN_FAILED]: {
    code: ErrorCode.STORAGE_OPEN_FAILED,
    httpStatus: 500,
    messageZh: "无法打开本地数据库。",
    messageEn: "Failed to open local database."
  },
  [ErrorCode.STORAGE_MIGRATION_FAILED]: {
    code: ErrorCode.STORAGE_MIGRATION_FAILED,
    httpStatus: 500,
    messageZh: "数据库迁移失败。",
    messageEn: "Database migration failed."
  },
  [ErrorCode.STORAGE_QUERY_FAILED]: {
    code: ErrorCode.STORAGE_QUERY_FAILED,
    httpStatus: 500,
    messageZh: "数据库查询失败。",
    messageEn: "Database query failed."
  },
  [ErrorCode.TARGET_NOT_FOUND]: {
    code: ErrorCode.TARGET_NOT_FOUND,
    httpStatus: 404,
    messageZh: "未找到指定的目标端。",
    messageEn: "Target not found."
  },
  [ErrorCode.TARGET_DUPLICATE_ID]: {
    code: ErrorCode.TARGET_DUPLICATE_ID,
    httpStatus: 409,
    messageZh: "目标端 ID 重复。",
    messageEn: "Duplicate target id."
  },
  [ErrorCode.COMPAT_RULE_FAILED]: {
    code: ErrorCode.COMPAT_RULE_FAILED,
    httpStatus: 500,
    messageZh: "兼容性规则执行失败。",
    messageEn: "Compatibility rule failed."
  },
  [ErrorCode.COMPAT_BLOCKING]: {
    code: ErrorCode.COMPAT_BLOCKING,
    httpStatus: 422,
    messageZh: "兼容性检查未通过，存在阻断性错误。",
    messageEn: "Compatibility check failed with blocking errors."
  },
  [ErrorCode.CLI_UNKNOWN_COMMAND]: {
    code: ErrorCode.CLI_UNKNOWN_COMMAND,
    httpStatus: 404,
    messageZh: "未知的命令。",
    messageEn: "Unknown command."
  },
  [ErrorCode.CLI_USAGE_ERROR]: {
    code: ErrorCode.CLI_USAGE_ERROR,
    httpStatus: 400,
    messageZh: "命令用法不正确。",
    messageEn: "Incorrect command usage."
  },
  [ErrorCode.TOOLCHAIN_NOT_INSTALLED]: {
    code: ErrorCode.TOOLCHAIN_NOT_INSTALLED,
    httpStatus: 412,
    messageZh: "所需工具链未安装。",
    messageEn: "Required toolchain is not installed."
  },
  [ErrorCode.TEMPLATE_RENDER_FAILED]: {
    code: ErrorCode.TEMPLATE_RENDER_FAILED,
    httpStatus: 500,
    messageZh: "模板渲染失败。",
    messageEn: "Template rendering failed."
  },
  [ErrorCode.BUILD_FAILED]: {
    code: ErrorCode.BUILD_FAILED,
    httpStatus: 500,
    messageZh: "构建失败。",
    messageEn: "Build failed."
  },
  [ErrorCode.BUILD_CANCELED]: {
    code: ErrorCode.BUILD_CANCELED,
    httpStatus: 499,
    messageZh: "构建已取消。",
    messageEn: "Build canceled."
  },
  [ErrorCode.ARTIFACT_NOT_FOUND]: {
    code: ErrorCode.ARTIFACT_NOT_FOUND,
    httpStatus: 404,
    messageZh: "未找到指定产物。",
    messageEn: "Artifact not found."
  },
  [ErrorCode.API_BAD_REQUEST]: {
    code: ErrorCode.API_BAD_REQUEST,
    httpStatus: 400,
    messageZh: "请求参数错误。",
    messageEn: "Bad request."
  },
  [ErrorCode.API_UNAUTHORIZED]: {
    code: ErrorCode.API_UNAUTHORIZED,
    httpStatus: 401,
    messageZh: "需要登录。",
    messageEn: "Authentication required."
  },
  [ErrorCode.API_FORBIDDEN]: {
    code: ErrorCode.API_FORBIDDEN,
    httpStatus: 403,
    messageZh: "权限不足。",
    messageEn: "Forbidden."
  },
  [ErrorCode.API_NOT_FOUND]: {
    code: ErrorCode.API_NOT_FOUND,
    httpStatus: 404,
    messageZh: "资源不存在。",
    messageEn: "Resource not found."
  },
  [ErrorCode.API_RATE_LIMITED]: {
    code: ErrorCode.API_RATE_LIMITED,
    httpStatus: 429,
    messageZh: "请求频率过高。",
    messageEn: "Too many requests."
  },
  [ErrorCode.AI_PROVIDER_NOT_FOUND]: { code: ErrorCode.AI_PROVIDER_NOT_FOUND, httpStatus: 404, messageZh: "AI 服务商不存在。", messageEn: "AI provider not found." },
  [ErrorCode.AI_PROVIDER_DISABLED]: { code: ErrorCode.AI_PROVIDER_DISABLED, httpStatus: 422, messageZh: "AI 服务商已禁用。", messageEn: "AI provider is disabled." },
  [ErrorCode.AI_PROVIDER_AUTH_FAILED]: { code: ErrorCode.AI_PROVIDER_AUTH_FAILED, httpStatus: 401, messageZh: "API Key 无效或已过期。", messageEn: "Invalid or expired API key.", fixSuggestionZh: "检查 API Key 是否正确。", fixSuggestionEn: "Check your API key." },
  [ErrorCode.AI_PROVIDER_RATE_LIMITED]: { code: ErrorCode.AI_PROVIDER_RATE_LIMITED, httpStatus: 429, messageZh: "AI 服务商速率限制，请稍后重试。", messageEn: "AI provider rate limit exceeded." },
  [ErrorCode.AI_PROVIDER_UPSTREAM_TIMEOUT]: { code: ErrorCode.AI_PROVIDER_UPSTREAM_TIMEOUT, httpStatus: 504, messageZh: "AI 服务商响应超时。", messageEn: "AI provider upstream timeout." },
  [ErrorCode.AI_PROVIDER_INSUFFICIENT_QUOTA]: { code: ErrorCode.AI_PROVIDER_INSUFFICIENT_QUOTA, httpStatus: 402, messageZh: "AI 服务商余额不足。", messageEn: "Insufficient quota." },
  [ErrorCode.AI_PROVIDER_MODEL_NOT_FOUND]: { code: ErrorCode.AI_PROVIDER_MODEL_NOT_FOUND, httpStatus: 404, messageZh: "指定模型不存在。", messageEn: "Model not found." },
  [ErrorCode.AI_PROVIDER_STREAM_INTERRUPTED]: { code: ErrorCode.AI_PROVIDER_STREAM_INTERRUPTED, httpStatus: 500, messageZh: "流式响应中断。", messageEn: "Stream interrupted." },
  [ErrorCode.AI_PROVIDER_JSON_PARSE_FAILED]: { code: ErrorCode.AI_PROVIDER_JSON_PARSE_FAILED, httpStatus: 500, messageZh: "AI 输出 JSON 解析失败。", messageEn: "Failed to parse AI JSON output." },
  [ErrorCode.AI_PROVIDER_CONTEXT_TOO_LONG]: { code: ErrorCode.AI_PROVIDER_CONTEXT_TOO_LONG, httpStatus: 413, messageZh: "输入内容超过模型上下文限制。", messageEn: "Input exceeds model context limit." },
  [ErrorCode.AI_PROVIDER_INVALID_RESPONSE]: { code: ErrorCode.AI_PROVIDER_INVALID_RESPONSE, httpStatus: 502, messageZh: "AI 服务商返回了非标准响应。", messageEn: "Non-standard response from AI provider." },
  [ErrorCode.AI_PROVIDER_CONNECT_FAILED]: { code: ErrorCode.AI_PROVIDER_CONNECT_FAILED, httpStatus: 502, messageZh: "无法连接到 AI 服务商，请检查 baseUrl。", messageEn: "Cannot connect to AI provider. Check baseUrl.", fixSuggestionZh: "确认 baseUrl 格式正确且可访问。", fixSuggestionEn: "Verify baseUrl is correct and reachable." },
  [ErrorCode.AI_WORKFLOW_NOT_FOUND]: { code: ErrorCode.AI_WORKFLOW_NOT_FOUND, httpStatus: 404, messageZh: "工作流不存在。", messageEn: "Workflow not found." },
  [ErrorCode.AI_WORKFLOW_RUN_NOT_FOUND]: { code: ErrorCode.AI_WORKFLOW_RUN_NOT_FOUND, httpStatus: 404, messageZh: "工作流运行记录不存在。", messageEn: "Workflow run not found." },
  [ErrorCode.AI_WORKFLOW_STEP_FAILED]: { code: ErrorCode.AI_WORKFLOW_STEP_FAILED, httpStatus: 500, messageZh: "工作流步骤执行失败。", messageEn: "Workflow step failed." },
  [ErrorCode.AI_WORKFLOW_CANCELED]: { code: ErrorCode.AI_WORKFLOW_CANCELED, httpStatus: 499, messageZh: "工作流已取消。", messageEn: "Workflow canceled." },
  [ErrorCode.FILE_OP_PATH_UNSAFE]: { code: ErrorCode.FILE_OP_PATH_UNSAFE, httpStatus: 400, messageZh: "文件路径不安全，禁止访问。", messageEn: "Unsafe file path rejected.", fixSuggestionZh: "路径必须在项目 workspace 内。", fixSuggestionEn: "Path must be inside project workspace." },
  [ErrorCode.FILE_OP_TOO_LARGE]: { code: ErrorCode.FILE_OP_TOO_LARGE, httpStatus: 413, messageZh: "文件超过允许的最大大小。", messageEn: "File exceeds maximum allowed size." },
  [ErrorCode.FILE_OP_NOT_FOUND]: { code: ErrorCode.FILE_OP_NOT_FOUND, httpStatus: 404, messageZh: "文件不存在。", messageEn: "File not found." },
  [ErrorCode.FILE_OP_PATCH_INVALID]: { code: ErrorCode.FILE_OP_PATCH_INVALID, httpStatus: 400, messageZh: "Patch 格式无效或包含危险内容。", messageEn: "Invalid or dangerous patch." }
};
