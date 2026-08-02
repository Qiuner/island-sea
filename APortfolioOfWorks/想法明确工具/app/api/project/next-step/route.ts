import { NextResponse } from "next/server";

type Stage =
  | "initial_diagnosis"
  | "need_validation"
  | "fake_need_review"
  | "mvp_scope"
  | "prompt_generation";

type Verdict = "pass" | "revise" | "reject" | "pending";

type Message = {
  role: "user" | "assistant";
  stage: Stage;
  content: string;
};

type Project = {
  idea?: string;
  targetUser?: string;
  scenario?: string;
  problem?: string;
  frequency?: string;
  currentAlternative?: string;
  whyAlternativeNotEnough?: string;
  consequence?: string;
  externalEvidence?: string;
  validationPlan?: string;
  whyOpenTool?: string;
  replacementRisk?: string;
  mustHave?: string;
  coreMvp?: string;
  finalOutput?: string;
  platform?: string;
  constraints?: string;
  cutFeatures?: string[];
};

type StageAnswers = Record<string, string>;
type AnswerBook = Partial<Record<Stage, StageAnswers>>;

type ModelResult = {
  stage: Stage;
  assistantMessage: string;
  diagnosis: {
    verdict: Verdict;
    riskLevel: "low" | "medium" | "high" | "unknown";
    summary: string;
    missingInfo: string[];
    risks: string[];
    nextQuestion: string;
  };
  productJudgment: {
    shouldBe: string;
    shouldNotBe: string;
    realNeed: string;
    nextFocus: string;
  };
  extractedProject: Project;
  finalPrompt: string | null;
};

const stages: Stage[] = [
  "initial_diagnosis",
  "need_validation",
  "fake_need_review",
  "mvp_scope",
  "prompt_generation",
];

const stageGuide: Record<Stage, string> = {
  initial_diagnosis:
    "先澄清目标用户、发生场景和问题。若其中任一项仍不具体，留在本阶段，只问最关键的一项。",
  need_validation:
    "确认问题频率、用户当前怎样处理、现有替代方式为什么不够好，并收集来自潜在用户的外部证据和 7 天验证计划。只有自述或主观判断时必须要求补证，不能判定需求成立。",
  fake_need_review:
    "审查是否为伪需求：通用 AI、微信、表格或现有 App 能否充分替代；用户为何要打开新工具。风险高时 verdict 必须是 revise 或 reject，并给明确修改方向。",
  mvp_scope:
    "只保留一个目标用户、一个核心场景、一个核心问题、一个核心动作和一个最终产出。主动砍掉账号、社区、复杂权限、后台、多端、模板市场等非必要功能。",
  prompt_generation:
    "仅当 MVP 已足够具体时，生成完整的、可以直接交给 AI 编程工具的中文开发提示词。",
};

const stageRequiredFields: Record<Stage, Array<keyof Project>> = {
  initial_diagnosis: ["idea", "targetUser", "scenario", "problem"],
  need_validation: ["frequency", "currentAlternative", "whyAlternativeNotEnough", "consequence", "externalEvidence", "validationPlan"],
  fake_need_review: ["whyOpenTool", "replacementRisk", "mustHave"],
  mvp_scope: ["coreMvp", "finalOutput", "cutFeatures"],
  prompt_generation: ["platform", "constraints"],
};

const fieldLabels: Record<keyof Project, string> = {
  idea: "项目想法",
  targetUser: "目标用户",
  scenario: "使用场景",
  problem: "核心问题",
  frequency: "发生频率",
  currentAlternative: "当前做法",
  whyAlternativeNotEnough: "不足之处",
  consequence: "后果",
  externalEvidence: "外部证据",
  validationPlan: "验证计划",
  whyOpenTool: "打开理由",
  replacementRisk: "替代风险",
  mustHave: "不可缺能力",
  coreMvp: "核心动作",
  finalOutput: "最终产出",
  platform: "开发形态",
  constraints: "开发约束",
  cutFeatures: "砍掉功能",
};

const nextStageByStage: Partial<Record<Stage, Stage>> = {
  initial_diagnosis: "need_validation",
  need_validation: "fake_need_review",
  fake_need_review: "mvp_scope",
  mvp_scope: "prompt_generation",
};

const systemPrompt = `你是严肃的项目初诊顾问，不是鼓励型聊天机器人。你的用户是懂一点开发、但不懂完整项目流程的新手。你的任务是把模糊或混乱的想法变成可验证、可开发的 MVP；必要时直接指出伪需求风险并要求修改。

原则：
1. 用户每提交一个回答都需要得到反馈；反馈先说明你理解到什么，再说明下一步要补什么。一次只问一个问题，问题短、具体、有判断力。
2. 不使用闯关、升级、恭喜、奖励等游戏化语言。
3. 不要泛泛夸奖。证据不足时明确说不足在哪里。
4. 不允许用户直接跳过真实需求判断和伪需求审查。真实需求不能只凭用户自述成立：没有来自潜在用户的行为、原话、付费/试用意愿、已有数据或其他可核验外部证据时，verdict 必须是 revise 或 reject。
5. 当 verdict 为 revise 或 reject 时，assistantMessage 先指出问题，再提出一个必须回答的修改问题。
6. 不要重复询问“已回答字段”里的事实；若信息已存在但质量不足，只能追问更具体的证据或要求改写，不要换句话问同一个问题。
7. missingInfo 只能包含真正缺失或明显不可判断的信息，不能包含已回答字段的字段名。
8. 所有输出使用简洁、直接的中文。
9. 每次都要给出 productJudgment：这个项目应该做成什么、不应该做成什么、真正需求是什么、接下来最值得判断什么。即使信息不足也要给暂定判断，并明确它仍待验证。
10. 只能输出严格 JSON，不要 markdown，不要代码块。`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      stage?: Stage;
      messages?: Message[];
      currentAnswer?: string;
      currentQuestionId?: keyof Project;
      extractedProject?: Project;
      answers?: AnswerBook;
    };

    if (!body.stage || !stages.includes(body.stage) || !body.currentAnswer?.trim()) {
      return errorResponse("INVALID_REQUEST", "请求缺少当前阶段或有效回答。", 400);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return errorResponse(
        "MISSING_API_KEY",
        "AI 服务尚未配置，请联系管理员。",
        503,
      );
    }

    const model = process.env.DEEPSEEK_MODEL || process.env.BAILIAN_MODEL || "deepseek-v4-flash";
    const baseUrl = (process.env.DEEPSEEK_BASE_URL || process.env.BAILIAN_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
    const localProject = mergeProjectFromAnswers(body.extractedProject ?? {}, body.answers ?? {});
    const stageState = getStageState(body.stage, localProject);
    const modelResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: buildUserPrompt(
              body.stage,
              body.messages ?? [],
              body.currentAnswer,
              body.currentQuestionId,
              localProject,
              body.answers ?? {},
              stageState,
            ),
          },
        ],
      }),
    });

    if (!modelResponse.ok) {
      const details = await modelResponse.text();
      console.error("Model request failed", modelResponse.status, details.slice(0, 500));
      return errorResponse("MODEL_CALL_FAILED", "模型服务调用失败，请确认模型、Base URL 和 API Key 配置。", 502);
    }

    const payload = (await modelResponse.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return errorResponse("MODEL_RESPONSE_PARSE_FAILED", "模型没有返回可用内容，请再试一次。", 502);
    }

    const result = normalizeResult(parseJson(content), body.stage, localProject, stageState);
    return NextResponse.json(result);
  } catch (caughtError) {
    console.error("Project next-step failed", caughtError);
    return errorResponse("MODEL_RESPONSE_PARSE_FAILED", "AI 返回格式异常，请再试一次。", 502);
  }
}

function buildUserPrompt(
  stage: Stage,
  messages: Message[],
  currentAnswer: string,
  currentQuestionId: keyof Project | undefined,
  extractedProject: Project,
  answers: AnswerBook,
  stageState: StageState,
) {
  const currentQuestionLabel = currentQuestionId ? fieldLabels[currentQuestionId] : "当前问题";
  const unknownMode = isUnknownLike(currentAnswer);
  return `当前阶段：${stage}\n本阶段目标：${stageGuide[stage]}\n当前问题字段：${currentQuestionLabel}\n用户是否在表达不知道或没想好：${unknownMode ? "是" : "否"}\n\n本阶段程序侧判断：${JSON.stringify(stageState)}\n\n已知项目字段：${JSON.stringify(extractedProject)}\n\n全部阶段答案：${JSON.stringify(answers)}\n\n对话记录：${JSON.stringify(messages.slice(-10))}\n\n用户刚刚的回答：${currentAnswer}\n\n请返回下列精确结构的 JSON：\n{\n  "stage": "${stages.join(' | ')}",\n  "assistantMessage": "对本次回答的简洁反馈，不要直接命令用户进入下一阶段",\n  "diagnosis": {\n    "verdict": "pass | revise | reject | pending",\n    "riskLevel": "low | medium | high | unknown",\n    "summary": "一句当前判断",\n    "missingInfo": ["还缺什么"],\n    "risks": ["当前风险"],\n    "nextQuestion": "下一道且仅一道问题"\n  },\n  "productJudgment": {\n    "shouldBe": "这个项目应该聚焦成什么",\n    "shouldNotBe": "这个项目不应变成什么",\n    "realNeed": "目前真正需要被解决或验证的需求",\n    "nextFocus": "下一步最值得判断的事情"\n  },\n  "extractedProject": {\n    "idea": "", "targetUser": "", "scenario": "", "problem": "", "frequency": "", "currentAlternative": "", "whyAlternativeNotEnough": "", "consequence": "", "externalEvidence": "", "validationPlan": "", "whyOpenTool": "", "replacementRisk": "", "mustHave": "", "coreMvp": "", "finalOutput": "", "platform": "", "constraints": "", "cutFeatures": []\n  },\n  "finalPrompt": null\n}\n\n阶段转换规则：\n1. 如果用户是在表达“不知道、不清楚、没想好、没有证据或不会验证”，不要要求补字数，也不要把这句话当成已明确事实写入 extractedProject。assistantMessage 先接住这个状态，再给 2 到 3 个可选方向，或把问题拆成一个更容易回答的小问题；verdict 用 pending 或 revise，missingInfo 包含${currentQuestionLabel}，stage 保持当前阶段。\n2. 如果当前阶段为 need_validation 且程序侧判断 externalEvidenceReady=false，必须停留在本阶段，verdict 必须是 revise 或 reject，并要求补充可核验的外部证据；不能把验证计划或用户自己的推测当作证据。\n3. 只有本阶段程序侧判断 complete=true 时，才可以把 stage 写成 nextStage；否则 stage 必须保持当前阶段。即使 complete=true，用户也会先看到反馈并自行决定是否继续，因此 assistantMessage 不要说“直接进入下一阶段”。\n4. fake_need_review 判定为 revise/reject 时可以停留，但必须指出具体风险，并追问“如何修改差异或不可替代能力”，不要重复问用户为什么打开工具。\n5. prompt_generation 时 finalPrompt 必须是完整开发提示词，其余阶段必须为 null。`;
}

function parseJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in model response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

type StageState = {
  complete: boolean;
  answeredFields: string[];
  missingFields: string[];
  nextStage: Stage | null;
  externalEvidenceReady: boolean;
};

function normalizeResult(value: unknown, currentStage: Stage, previousProject: Project, stageState: StageState): ModelResult {
  if (!value || typeof value !== "object") throw new Error("Invalid model result");
  const result = value as Partial<ModelResult>;
  const diagnosis = result.diagnosis as Partial<ModelResult["diagnosis"]> | undefined;
  const modelVerdict: Verdict = ["pass", "revise", "reject", "pending"].includes(diagnosis?.verdict ?? "")
    ? diagnosis?.verdict as Verdict
    : "pending";
  const safeRisk = ["low", "medium", "high", "unknown"].includes(diagnosis?.riskLevel ?? "")
    ? diagnosis?.riskLevel as ModelResult["diagnosis"]["riskLevel"]
    : "unknown";
  const mergedProject = mergeProject(previousProject, result.extractedProject ?? {});
  const needsEvidenceRevision = currentStage === "need_validation" && !stageState.externalEvidenceReady;
  const safeVerdict: Verdict = needsEvidenceRevision ? "revise" : modelVerdict;
  const shouldStayForRevision = ["revise", "reject"].includes(safeVerdict);
  const safeStage = !needsEvidenceRevision && stageState.complete && stageState.nextStage && !shouldStayForRevision
    ? stageState.nextStage
    : currentStage;
  const missingInfo = needsEvidenceRevision
    ? uniqueItems(["来自潜在用户的可核验证据", ...filterRepeatedMissingInfo(stringArray(diagnosis?.missingInfo), mergedProject)])
    : filterRepeatedMissingInfo(stringArray(diagnosis?.missingInfo), mergedProject);
  const nextQuestion = chooseNextQuestion(stringValue(diagnosis?.nextQuestion), currentStage, safeStage, safeVerdict, stageState, mergedProject);
  const assistantMessage = chooseAssistantMessage(stringValue(result.assistantMessage), safeStage, currentStage, nextQuestion, safeVerdict, stageState, mergedProject);
  const productJudgment = normalizeProductJudgment(result.productJudgment, currentStage, mergedProject, nextQuestion);

  return {
    stage: safeStage,
    assistantMessage,
    diagnosis: {
      verdict: safeVerdict,
      riskLevel: safeRisk,
      summary: needsEvidenceRevision
        ? "当前只有自述或验证计划，尚不能证明这是一个真实需求。"
        : stringValue(diagnosis?.summary) || "还需要更多具体信息才能做出判断。",
      missingInfo,
      risks: needsEvidenceRevision
        ? uniqueItems(["把自己的判断当成市场证据，可能继续投入在无人需要的功能上", ...stringArray(diagnosis?.risks)])
        : stringArray(diagnosis?.risks),
      nextQuestion,
    },
    productJudgment,
    extractedProject: mergedProject,
    // 只有用户已经答完“开发形态”和“开发约束”后，才允许模型交付最终提示词。
    finalPrompt: typeof result.finalPrompt === "string" && currentStage === "prompt_generation" && stageState.complete && safeVerdict === "pass"
      ? result.finalPrompt.trim() || null
      : null,
  };
}

function normalizeProductJudgment(value: unknown, stage: Stage, project: Project, nextQuestion: string) {
  const judgment = value && typeof value === "object"
    ? value as Partial<ModelResult["productJudgment"]>
    : {};
  const fallback = fallbackProductJudgment(stage, project, nextQuestion);
  return {
    shouldBe: stringValue(judgment.shouldBe) || fallback.shouldBe,
    shouldNotBe: stringValue(judgment.shouldNotBe) || fallback.shouldNotBe,
    realNeed: stringValue(judgment.realNeed) || fallback.realNeed,
    nextFocus: stringValue(judgment.nextFocus) || fallback.nextFocus,
  };
}

function fallbackProductJudgment(stage: Stage, project: Project, nextQuestion: string) {
  const user = project.targetUser || "一个具体目标用户";
  const problem = project.problem || "一个可观察的问题";
  const defaults: Record<Stage, Omit<ModelResult["productJudgment"], "nextFocus">> = {
    initial_diagnosis: {
      shouldBe: `先服务${user}，在明确场景中解决${problem}。`,
      shouldNotBe: "不要把它定义成面向所有人的万能工具。",
      realNeed: "确认目标用户是否会在这个场景下持续遇到该问题。",
    },
    need_validation: {
      shouldBe: "围绕一个已经发生且能被外部证据验证的问题推进。",
      shouldNotBe: "不要把个人判断、想象或验证计划当成需求已经成立。",
      realNeed: "确认目标用户是否真的遭遇问题，并愿意改变现有做法。",
    },
    fake_need_review: {
      shouldBe: "把产品收敛成一项通用工具无法稳定替代的判断或行动。",
      shouldNotBe: "不要只是把通用 AI、表格或笔记工具换一个界面。",
      realNeed: "确认用户为什么愿意专门打开它，而不是沿用现有工具。",
    },
    mvp_scope: {
      shouldBe: "第一版只完成一个核心动作，并交付一个可用结果。",
      shouldNotBe: "不要在第一版加入账号、社区、后台或多端协作等扩张功能。",
      realNeed: "确认最小交付物是否足够让用户完成关键动作。",
    },
    prompt_generation: {
      shouldBe: "把已经明确的判断翻译为可开发、可验收的产品说明。",
      shouldNotBe: "不要生成包含未验证功能或模糊边界的开发提示词。",
      realNeed: "让开发工具得到足够具体的范围、约束和验收结果。",
    },
  };
  return { ...defaults[stage], nextFocus: nextQuestion };
}

function mergeProject(previousProject: Project, extractedProject: Project): Project {
  const merged: Project = { ...previousProject };

  for (const field of Object.keys(fieldLabels) as Array<keyof Project>) {
    const incoming = extractedProject[field];
    if (hasUsefulValue(incoming)) {
      merged[field] = incoming as never;
    }
  }

  return merged;
}

function mergeProjectFromAnswers(project: Project, answers: AnswerBook): Project {
  const initial = answers.initial_diagnosis ?? {};
  const validation = answers.need_validation ?? {};
  const review = answers.fake_need_review ?? {};
  const mvp = answers.mvp_scope ?? {};
  const prompt = answers.prompt_generation ?? {};
  return {
    ...project,
    idea: usefulAnswer(initial.idea) || project.idea,
    targetUser: usefulAnswer(initial.targetUser) || project.targetUser,
    scenario: usefulAnswer(initial.scenario) || project.scenario,
    problem: usefulAnswer(initial.problem) || project.problem,
    frequency: usefulAnswer(validation.frequency) || project.frequency,
    currentAlternative: usefulAnswer(validation.currentAlternative) || project.currentAlternative,
    whyAlternativeNotEnough: usefulAnswer(validation.whyAlternativeNotEnough) || project.whyAlternativeNotEnough,
    consequence: usefulAnswer(validation.consequence) || project.consequence,
    externalEvidence: usefulAnswer(validation.externalEvidence) || project.externalEvidence,
    validationPlan: usefulAnswer(validation.validationPlan) || project.validationPlan,
    whyOpenTool: usefulAnswer(review.whyOpenTool) || project.whyOpenTool,
    replacementRisk: usefulAnswer(review.replacementRisk) || project.replacementRisk,
    mustHave: usefulAnswer(review.mustHave) || project.mustHave,
    coreMvp: usefulAnswer(mvp.coreMvp) || project.coreMvp,
    finalOutput: usefulAnswer(mvp.finalOutput) || project.finalOutput,
    platform: usefulAnswer(prompt.platform) || project.platform,
    constraints: usefulAnswer(prompt.constraints) || project.constraints,
    cutFeatures: usefulAnswer(mvp.cutFeatures)
      ? splitList(mvp.cutFeatures)
      : project.cutFeatures,
  };
}

function getStageState(stage: Stage, project: Project): StageState {
  const requiredFields = stageRequiredFields[stage];
  const missingFields = requiredFields.filter((field) => !hasUsefulValue(project[field]));
  const answeredFields = requiredFields.filter((field) => hasUsefulValue(project[field]));
  return {
    complete: missingFields.length === 0,
    answeredFields: answeredFields.map((field) => fieldLabels[field]),
    missingFields: missingFields.map((field) => fieldLabels[field]),
    nextStage: nextStageByStage[stage] ?? null,
    externalEvidenceReady: hasExternalEvidence(project.externalEvidence),
  };
}

function hasExternalEvidence(value?: string) {
  const evidence = value?.trim() ?? "";
  if (evidence.length < 12 || isUnknownLike(evidence) || /(暂无|没有|尚无|还没|未访谈|未验证)/.test(evidence)) return false;
  return /(访谈|用户|客户|订单|付费|预约|报名|点击|回复|留言|使用|转化|数据|问卷|社群|咨询)/.test(evidence);
}

function uniqueItems(items: string[]) {
  return [...new Set(items)].filter(Boolean).slice(0, 3);
}

function hasUsefulValue(value: Project[keyof Project]) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length >= 4 && !isUnknownLike(value);
}

function usefulAnswer(value?: string) {
  return hasUsefulValue(value) ? value?.trim() : undefined;
}

function isUnknownLike(value?: string) {
  const text = value?.trim() ?? "";
  if (!text) return false;
  return /(不知道|不清楚|没想好|還不知道|還不清楚|不确定|不確定|没有想法|沒有想法|还没有拿到|還沒有拿到|没有拿到|沒有拿到|不会验证|不會驗證|不懂)/.test(text);
}

function filterRepeatedMissingInfo(items: string[], project: Project) {
  const answeredFields = (Object.keys(fieldLabels) as Array<keyof Project>)
    .filter((field) => hasUsefulValue(project[field]))
    .map((field) => fieldLabels[field]);

  return [...new Set(items.map(replaceFieldNames))]
    .filter((item) => !answeredFields.some((field) => item.includes(field)))
    .slice(0, 3);
}

function chooseNextQuestion(
  modelQuestion: string,
  currentStage: Stage,
  safeStage: Stage,
  verdict: Verdict,
  stageState: StageState,
  project: Project,
) {
  if (currentStage === "need_validation" && !stageState.externalEvidenceReady) {
    return "请补充一条已发生、可核验的潜在用户证据：对象、行为或原话，以及你如何获得它。";
  }
  if (stageState.complete && safeStage !== currentStage) {
    return nextStageOpeningQuestion(safeStage);
  }
  if (currentStage === "fake_need_review" && ["revise", "reject"].includes(verdict)) {
    return "请把不可替代能力改得更具体：它和通用 AI、表格或现有 App 的差异到底是什么？";
  }
  if (!modelQuestion || repeatsAnsweredField(modelQuestion, project)) {
    return stageState.missingFields[0]
      ? `请补充${stageState.missingFields[0]}的具体事实。`
      : "请补充一个能证明这个判断成立的具体例子。";
  }
  return modelQuestion;
}

function chooseAssistantMessage(
  modelMessage: string,
  safeStage: Stage,
  currentStage: Stage,
  nextQuestion: string,
  verdict: Verdict,
  stageState: StageState,
  project: Project,
) {
  if (currentStage === "need_validation" && !stageState.externalEvidenceReady) {
    return `目前还不能把自述当作真实需求。${nextQuestion}`;
  }
  if (stageState.complete && safeStage !== currentStage) {
    return `本阶段基础信息已经齐全。你可以先查看判断，再自行决定是否进入${stageLabel(safeStage)}。`;
  }
  if (currentStage === "fake_need_review" && ["revise", "reject"].includes(verdict)) {
    return `${removeQuestions(modelMessage) || "当前想法仍有伪需求风险。"} ${nextQuestion}`;
  }
  const statement = removeQuestions(modelMessage);
  if (!statement || repeatsAnsweredField(statement, project)) return nextQuestion;
  return `${statement} ${nextQuestion}`.trim();
}

function repeatsAnsweredField(text: string, project: Project) {
  return (Object.keys(fieldLabels) as Array<keyof Project>)
    .filter((field) => hasUsefulValue(project[field]))
    .some((field) => text.includes(fieldLabels[field]) || text.includes(field));
}

function replaceFieldNames(text: string) {
  return (Object.keys(fieldLabels) as Array<keyof Project>).reduce(
    (result, field) => result.replaceAll(field, fieldLabels[field]),
    text,
  );
}

function removeQuestions(text: string) {
  return text
    .split(/(?<=[。！？!?])/)
    .filter((sentence) => !/[？?]/.test(sentence))
    .join("")
    .trim();
}

function nextStageOpeningQuestion(stage: Stage) {
  const openings: Record<Stage, string> = {
    initial_diagnosis: "你想做一个什么项目？",
    need_validation: "这个问题多久会发生一次？",
    fake_need_review: "为什么用户会专门打开这个工具，而不是直接问通用 AI？",
    mvp_scope: "第一版只让用户完成哪一个核心动作？",
    prompt_generation: "你希望 AI 编程工具先开发成什么形态？",
  };
  return openings[stage];
}

function stageLabel(stage: Stage) {
  const labels: Record<Stage, string> = {
    initial_diagnosis: "项目初诊",
    need_validation: "真实需求判断",
    fake_need_review: "伪需求审查",
    mvp_scope: "MVP 收敛",
    prompt_generation: "开发提示词",
  };
  return labels[stage];
}

function splitList(value: string) {
  return value.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
