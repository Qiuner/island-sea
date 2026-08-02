"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Stage =
  | "initial_diagnosis"
  | "need_validation"
  | "fake_need_review"
  | "mvp_scope"
  | "prompt_generation";

type Verdict = "pass" | "revise" | "reject" | "pending";

type Message = {
  id: string;
  role: "user" | "assistant";
  stage: Stage;
  content: string;
};

type Diagnosis = {
  verdict: Verdict;
  riskLevel: "low" | "medium" | "high" | "unknown";
  summary: string;
  missingInfo: string[];
  risks: string[];
  nextQuestion: string;
};

type ProductJudgment = {
  shouldBe: string;
  shouldNotBe: string;
  realNeed: string;
  nextFocus: string;
};

type StandardFeedback = {
  answeredQuestionIndex: number;
  revisionQuestionIndex?: number | null;
  assistantMessage: string;
  productJudgment: ProductJudgment;
  nextStage: Stage | null;
  stageComplete: boolean;
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

type ApiResult = {
  stage: Stage;
  assistantMessage: string;
  diagnosis: Diagnosis;
  productJudgment: ProductJudgment;
  extractedProject: Project;
  finalPrompt?: string | null;
};

type Question = {
  id: string;
  label: string;
  prompt: string;
  placeholder: string;
  minLength?: number;
};

type StageAnswers = Record<string, string>;
type AnswerBook = Partial<Record<Stage, StageAnswers>>;

const stageLabels: Record<Stage, string> = {
  initial_diagnosis: "项目初诊",
  need_validation: "真实需求判断",
  fake_need_review: "伪需求审查",
  mvp_scope: "MVP 收敛",
  prompt_generation: "开发提示词",
};

const stages: Stage[] = [
  "initial_diagnosis",
  "need_validation",
  "fake_need_review",
  "mvp_scope",
  "prompt_generation",
];

const stageQuestions: Record<Stage, Question[]> = {
  initial_diagnosis: [
    {
      id: "idea",
      label: "项目想法",
      prompt: "先写下你的项目念头，一句话也可以。",
      placeholder: "例如：AI 剪辑工具、给同学玩的小游戏、帮新手整理项目想法的工具。",
    },
    {
      id: "targetUser",
      label: "目标用户",
      prompt: "这个项目第一版只服务哪一类具体用户？",
      placeholder: "例如：已经会用 Cursor 或 Codex 做简单网页，但还不会拆 MVP、写清楚需求的新手独立开发者。",
    },
    {
      id: "scenario",
      label: "使用场景",
      prompt: "用户会在什么具体环境或时刻打开它？",
      placeholder: "例如：周末准备开始一个新项目、打开 Cursor 之前，发现自己只有一句模糊想法，不知道第一版该做什么。",
    },
    {
      id: "problem",
      label: "核心问题",
      prompt: "用户当下最需要被解决的一个问题是什么？",
      placeholder: "例如：他们不知道第一版应该服务谁、解决哪个场景、保留哪些功能，导致提示词太散，AI 生成的项目不可用。",
    },
  ],
  need_validation: [
    {
      id: "frequency",
      label: "发生频率",
      prompt: "这个问题多久会发生一次？",
      placeholder: "例如：受访者平均每月会启动 1 到 2 个小项目，每次写第一版开发提示词前都会卡 30 分钟以上。",
    },
    {
      id: "currentAlternative",
      label: "当前做法",
      prompt: "用户现在不用你的产品时，通常怎么解决？",
      placeholder: "例如：他们现在会把想法直接丢给 ChatGPT，或在备忘录里写一大段需求，再复制给 Cursor。",
    },
    {
      id: "whyAlternativeNotEnough",
      label: "不足之处",
      prompt: "现有做法为什么不够好？",
      placeholder: "例如：通用 AI 会顺着用户扩功能，不会强制追问目标用户、真实证据和砍掉项，最后提示词仍然像愿望清单。",
    },
    {
      id: "consequence",
      label: "后果",
      prompt: "如果这个问题不解决，用户会付出什么代价？",
      placeholder: "例如：他们会先做账号、模板库、多项目管理等非必要功能，浪费 1 到 3 天后才发现核心流程没跑通。",
    },
    {
      id: "externalEvidence",
      label: "外部证据",
      prompt: "你已经拿到哪一条来自潜在用户的外部证据？",
      placeholder: "例如：上周访谈了 5 位会用 Cursor 的新手开发者，其中 3 位当场展示了混乱需求文档，2 位说愿意下周试用并反馈。",
      minLength: 12,
    },
    {
      id: "validationPlan",
      label: "验证计划",
      prompt: "接下来 7 天，你会如何补齐或验证这条证据？",
      placeholder: "例如：7 天内再访谈 5 位同类用户，记录原话和现有文档；若少于 2 人愿意用原型完成一次项目澄清，就暂停开发。",
      minLength: 12,
    },
  ],
  fake_need_review: [
    {
      id: "whyOpenTool",
      label: "打开理由",
      prompt: "为什么用户会专门打开这个工具，而不是直接问通用 AI？",
      placeholder: "例如：它会按固定问题链逐题推进，要求用户补齐证据、替代方案和砍掉项，而不是直接生成一份看似完整的方案。",
    },
    {
      id: "replacementRisk",
      label: "替代风险",
      prompt: "微信、表格、Notion、通用 AI 是否能基本替代它？如果不能，差别在哪里？",
      placeholder: "例如：表格和 Notion 能记录答案，但不会判断证据是否成立；通用 AI 能聊天，但不会固定执行伪需求审查和 MVP 压缩。",
    },
    {
      id: "mustHave",
      label: "不可缺能力",
      prompt: "如果第一版只能保留一个不可替代的能力，它是什么？",
      placeholder: "例如：每个阶段结束后给出严肃诊断，指出当前最薄弱的一项，并把用户带回对应问题修订。",
    },
  ],
  mvp_scope: [
    {
      id: "coreMvp",
      label: "核心动作",
      prompt: "第一版只让用户完成哪一个核心动作？",
      placeholder: "例如：用户按阶段回答 18 个关键问题，系统判断是否通过，并最终生成可直接发给 Cursor 的开发提示词。",
    },
    {
      id: "finalOutput",
      label: "最终产出",
      prompt: "用户完成后必须拿到什么结果？",
      placeholder: "例如：一份包含目标用户、使用场景、真实证据、MVP 范围、砍掉功能和验收标准的开发提示词。",
    },
    {
      id: "cutFeatures",
      label: "砍掉功能",
      prompt: "第一版明确不做哪些功能？",
      placeholder: "例如：第一版不做账号系统、模板市场、社区、多人协作、后台管理、多项目库和分享广场。",
    },
  ],
  prompt_generation: [
    {
      id: "platform",
      label: "开发形态",
      prompt: "你希望 AI 编程工具先开发成什么形态？",
      placeholder: "例如：先做成本地运行的单页 Web 工具，前端是逐题表单和阶段反馈，后端调用 DeepSeek API。",
    },
    {
      id: "constraints",
      label: "开发约束",
      prompt: "有什么必须遵守的技术或体验约束？",
      placeholder: "例如：不做游戏化；每题一页；阶段结束必须给判断；证据不足时不能进入下一阶段；能返回对应问题修改。",
    },
  ],
};

const initialDiagnosis: Diagnosis = {
  verdict: "pending",
  riskLevel: "unknown",
  summary: "先用项目想法建立上下文；从第二题开始给出当前判断。",
  missingInfo: ["目标用户", "具体场景", "要解决的问题"],
  risks: [],
  nextQuestion: stageQuestions.initial_diagnosis[0].prompt,
};

const evidenceRequiredDiagnosis: Diagnosis = {
  verdict: "revise",
  riskLevel: "high",
  summary: "这份草稿还没有来自潜在用户的外部证据，不能作为真实需求继续开发。",
  missingInfo: ["来自潜在用户的可核验证据", "7 天验证计划"],
  risks: ["把自己的判断当成市场证据，可能继续投入在无人需要的功能上"],
  nextQuestion: "请补充一条已发生、可核验的潜在用户证据：对象、行为或原话，以及你如何获得它。",
};

const emptyProductJudgment: ProductJudgment = {
  shouldBe: "先把用户、场景和问题说清，再决定产品形态。",
  shouldNotBe: "不要急着堆功能或把自己的想法当成需求结论。",
  realNeed: "先确认一个具体用户是否真的在具体场景中遇到这个问题。",
  nextFocus: "补齐当前阶段最关键的一条事实。",
};

const storageKey = "project-clarifier-state-v2";

const unknownAnswerByQuestion: Record<string, string> = {
  targetUser: "我还不知道。可以先帮我从：给自己用、给身边同学朋友用、给某类陌生用户用，这三个方向里收窄。",
  scenario: "我还不知道具体场景。可以先帮我从：开始做事前、遇到问题时、每天固定使用、和别人协作时，这几个时刻里判断。",
  problem: "我还不知道核心问题。可以先帮我拆成几个可能的卡点，比如不会开始、太费时间、结果不好、难判断。",
  frequency: "我还不知道发生频率。可以先帮我判断它更像每天都会发生、每周发生、偶尔发生，还是只发生一次。",
  currentAlternative: "我还不知道用户现在怎么解决。可以先帮我列几个可能替代方式，让我对照选择。",
  whyAlternativeNotEnough: "我还不知道现有做法哪里不够好。可以先帮我从效率、质量、判断难度、使用成本几个角度拆开。",
  consequence: "我还不知道会有什么代价。可以先帮我判断如果不解决，用户会损失时间、钱、结果质量，还是只是有点不方便。",
  externalEvidence: "我还没有拿到外部证据。请先帮我设计一条最小验证方式，而不是让我假装已经验证过。",
  validationPlan: "我还不知道怎么验证。请先帮我把 7 天验证计划拆成可以马上执行的访谈或试用步骤。",
  whyOpenTool: "我还不知道用户为什么会专门打开这个工具。请先帮我和通用 AI、表格、备忘录做对比。",
  replacementRisk: "我还不知道能不能被替代。请先帮我判断哪些部分会被通用 AI 或现有工具替代，哪些可能不可替代。",
  mustHave: "我还不知道不可缺能力是什么。请先帮我从诊断、记录、生成、提醒、协作里收窄一个。",
  coreMvp: "我还不知道第一版核心动作。请先帮我从输入、判断、生成结果这几个动作里选一个最小闭环。",
  finalOutput: "我还不知道最终产出。请先帮我判断用户完成后最需要拿到清单、报告、提示词，还是可执行任务。",
  cutFeatures: "我还不知道该砍掉什么。请先帮我列出第一版最应该砍掉的功能类型。",
  platform: "我还不知道开发形态。请先帮我从单页网页、本地工具、手机页面、聊天式工具里选择。",
  constraints: "我还不知道开发约束。请先帮我列出第一版必须遵守的体验和技术边界。",
};

function isUnknownLike(value?: string) {
  const text = value?.trim() ?? "";
  if (!text) return false;
  return /(不知道|不清楚|没想好|還不知道|還不清楚|不确定|不確定|没有想法|沒有想法|还没有拿到|還沒有拿到|没有拿到|沒有拿到|不会验证|不會驗證|不懂)/.test(text);
}

function knownText(value?: string) {
  const text = value?.trim();
  return text && !isUnknownLike(text) ? text : undefined;
}

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomPart}`;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("initial_diagnosis");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerBook>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [diagnosis, setDiagnosis] = useState<Diagnosis>(initialDiagnosis);
  const [project, setProject] = useState<Project>({});
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<StandardFeedback | null>(null);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "backward">("forward");

  const questions = stageQuestions[stage];
  const currentQuestion = questions[questionIndex];
  const progress = useMemo(() => Math.max(1, stages.indexOf(stage) + 1), [stage]);
  const finalDocument = useMemo(
    () => finalPrompt ? buildMarkdownDocument(project, finalPrompt) : "",
    [finalPrompt, project],
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const state = JSON.parse(saved) as {
          stage: Stage;
          questionIndex: number;
          answers: AnswerBook;
          messages: Message[];
          diagnosis: Diagnosis;
          project: Project;
          feedback?: StandardFeedback | null;
          finalPrompt?: string;
        };
        const needsEvidenceMigration = needsExternalEvidence(state.stage, state.project ?? {});
        // The page stays behind the restore overlay until this complete saved snapshot is applied.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStage(needsEvidenceMigration ? "need_validation" : state.stage);
        setQuestionIndex(needsEvidenceMigration ? 4 : state.questionIndex ?? 0);
        setAnswers(state.answers ?? {});
        setMessages(state.messages ?? []);
        setDiagnosis(needsEvidenceMigration ? evidenceRequiredDiagnosis : state.diagnosis ?? initialDiagnosis);
        setProject(state.project ?? {});
        setFeedback(needsEvidenceMigration ? null : state.feedback ?? null);
        setFinalPrompt(needsEvidenceMigration ? "" : state.finalPrompt ?? "");
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setHasRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestored) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        stage,
        questionIndex,
        answers,
        messages,
        diagnosis,
        project,
        feedback,
        finalPrompt,
      }),
    );
  }, [answers, diagnosis, feedback, finalPrompt, hasRestored, messages, project, questionIndex, stage]);

  useEffect(() => {
    if (feedback || finalPrompt) return;
    // Keep the controlled textarea aligned with the currently selected question.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswer(answers[stage]?.[currentQuestion.id] ?? "");
  }, [answers, currentQuestion.id, feedback, finalPrompt, stage]);

  function saveCurrentAnswer(value: string) {
    setAnswers((current) => ({
      ...current,
      [stage]: {
        ...(current[stage] ?? {}),
        [currentQuestion.id]: value,
      },
    }));
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError("请先写下你的回答。");
      return;
    }

    const minLength = currentQuestion.id === "idea" || isUnknownLike(trimmedAnswer) ? 1 : currentQuestion.minLength ?? 4;
    if (trimmedAnswer.length < minLength) {
      setError("这个回答还太短。请补充到足以判断的程度。");
      return;
    }

    setError("");
    const nextAnswers = {
      ...answers,
      [stage]: {
        ...(answers[stage] ?? {}),
        [currentQuestion.id]: trimmedAnswer,
      },
    };
    const localProject = mergeLocalProject(project, nextAnswers);

    // 第一个想法还不足以形成有效判断，先收集用户与场景再反馈。
    if (stage === "initial_diagnosis" && questionIndex === 0) {
      setAnswers(nextAnswers);
      setProject(localProject);
      setQuestionIndex(1);
      setTransitionDirection("forward");
      return;
    }

    const userMessage: Message = {
      id: createClientId(),
      role: "user",
      stage,
      content: `${currentQuestion.label}：${trimmedAnswer}`,
    };
    const nextMessages = [...messages, userMessage];

    setAnswers(nextAnswers);
    setMessages(nextMessages);
    setProject(localProject);
    setIsLoading(true);

    try {
      const response = await fetch("/island/works/idea-pilot/api/project/next-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          messages: nextMessages,
          currentAnswer: trimmedAnswer,
          currentQuestionId: currentQuestion.id,
          extractedProject: localProject,
          answers: nextAnswers,
        }),
      });
      const result = (await response.json()) as ApiResult | { error?: { message?: string } };

      if (!response.ok || !("assistantMessage" in result)) {
        throw new Error(
          "error" in result
            ? result.error?.message || "AI 服务暂时不可用，请稍后再试。"
            : "AI 服务暂时不可用，请稍后再试。",
        );
      }

      setMessages((current) => [...current, {
        id: createClientId(),
        role: "assistant",
        stage: result.stage,
        content: result.assistantMessage,
      }]);
      const canonicalAnswers = syncAnswersWithProject(nextAnswers, result.extractedProject);
      setAnswers(canonicalAnswers);
      setDiagnosis(result.diagnosis);
      setProject(result.extractedProject);
      setFinalPrompt(result.finalPrompt ?? "");

      if (result.finalPrompt) {
        setStage("prompt_generation");
        return;
      }

      const stageComplete = questionIndex === questions.length - 1;
      setFeedback({
        answeredQuestionIndex: questionIndex,
        revisionQuestionIndex: getRevisionQuestionIndex(stage, result.diagnosis),
        assistantMessage: result.assistantMessage,
        productJudgment: result.productJudgment ?? emptyProductJudgment,
        nextStage: stageComplete && result.stage !== stage ? result.stage : null,
        stageComplete,
      });
    } catch (caughtError) {
      setMessages((current) => current.filter((item) => item.id !== userMessage.id));
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "提交失败，请稍后重试。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function goBack() {
    setError("");
    if (feedback) {
      setFeedback(null);
      setQuestionIndex(feedback.answeredQuestionIndex);
      return;
    }
    if (questionIndex > 0) {
      saveCurrentAnswer(answer.trim());
      setTransitionDirection("backward");
      setQuestionIndex((current) => current - 1);
    }
  }

  function jumpToQuestion(index: number) {
    if (index > questionIndex || feedback || finalPrompt) return;
    saveCurrentAnswer(answer.trim());
    setError("");
    setTransitionDirection(index < questionIndex ? "backward" : "forward");
    setQuestionIndex(index);
  }

  function continueFromFeedback() {
    if (!feedback) return;

    setError("");
    if (feedback.nextStage) {
      setStage(feedback.nextStage);
      setQuestionIndex(0);
      setAnswer("");
      setTransitionDirection("forward");
    } else if ((diagnosis.verdict === "revise" || diagnosis.verdict === "reject") && feedback.revisionQuestionIndex !== null && feedback.revisionQuestionIndex !== undefined) {
      setQuestionIndex(feedback.revisionQuestionIndex);
      setTransitionDirection(feedback.revisionQuestionIndex < feedback.answeredQuestionIndex ? "backward" : "forward");
    } else if (feedback.stageComplete) {
      setQuestionIndex(feedback.revisionQuestionIndex ?? feedback.answeredQuestionIndex);
    } else {
      setQuestionIndex(feedback.answeredQuestionIndex + 1);
      setTransitionDirection("forward");
    }
    setFeedback(null);
  }

  function restart() {
    window.localStorage.removeItem(storageKey);
    setStage("initial_diagnosis");
    setQuestionIndex(0);
    setAnswers({});
    setMessages([]);
    setDiagnosis(initialDiagnosis);
    setProject({});
    setAnswer("");
    setFeedback(null);
    setFinalPrompt("");
    setError("");
  }

  function askForQuestionHelp() {
    setError("");
    setAnswer(
      unknownAnswerByQuestion[currentQuestion.id]
        ?? "我还不知道，请先帮我把这个问题拆成几个更容易选择的方向。",
    );
  }

  async function copyPrompt() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(finalDocument);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("当前浏览器不允许直接复制。请下载 Markdown 文件。");
    }
  }

  function downloadMarkdown() {
    const blob = new Blob([finalDocument], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "项目澄清报告.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell" aria-busy={!hasRestored} data-restoring={hasRestored ? undefined : "true"}>
      {!hasRestored ? (
        <div className="restore-overlay" role="status" aria-live="polite">
          <p className="eyebrow">IDEA PILOT</p>
          <p>正在恢复你的项目草稿…</p>
        </div>
      ) : null}
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="glass-orb orb-top" aria-hidden="true" />
      <div className="glass-orb orb-right" aria-hidden="true" />
      <div className="glass-orb orb-bottom" aria-hidden="true" />
      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">M</span>
            <div><p className="eyebrow">MVP CLARIFIER</p><h1>想法明确工具</h1></div>
          </div>
          <p className="ai-pill">✦ 从想法到 MVP，只差一次澄清 ✦</p>
          <p className="assist-pill">♢ AI 助力 · 精准判断 · 快速落地</p>
        </header>

        <section className="hero" aria-label="产品介绍">
          <h2>把模糊想法，变成可执行的 <em>MVP</em></h2>
          <p>帮助你判断真实需求、收敛 MVP，并生成 AI 开发提示词。</p>
        </section>

        <ol className="stage-list" aria-label="项目澄清阶段">
          {stages.map((item, index) => {
            const state = index + 1 < progress ? "done" : index + 1 === progress ? "current" : "upcoming";
            const icons = ["♧", "◎", "♢", "□", "⌘"];
            return (
              <li key={item} className={`stage-item ${state}`}>
                <span className="stage-icon" aria-hidden="true">{icons[index]}</span>
                <span className="stage-copy"><small>{String(index + 1).padStart(2, "0")}</small><strong>{stageLabels[item]}</strong></span>
              </li>
            );
          })}
        </ol>

        <div className="workspace-grid">
          <aside className="stage-rail" aria-label="当前阶段进度">
            <p className="eyebrow">当前阶段</p>
            <h2>{stageLabels[stage]}</h2>
            <div className="stage-meter rail-meter">
              <div><p>进度</p><p>{progress} / {stages.length}</p></div>
              <div className="meter-track"><span style={{ width: `${Math.round((progress / stages.length) * 100)}%` }} /></div>
            </div>
            <section className="stage-guide">
              <p className="eyebrow">本阶段目标</p>
              <ul>
                <li>回答 {questions.length} 个关键问题</li>
                <li>尽量描述具体的人、场景和事实</li>
                <li>形成下一步可执行的判断</li>
              </ul>
            </section>
            <button type="button" className="quiet-button" onClick={restart}>↻ 重新开始</button>
          </aside>
          <section className="question-panel" aria-live="polite">
            {finalPrompt ? (
              <FinalPrompt
                copied={copied}
                documentMarkdown={finalDocument}
                onCopy={copyPrompt}
                onDownload={downloadMarkdown}
              />
            ) : feedback ? (
              <StandardFeedbackView
                stage={stage}
                feedback={feedback}
                isLoading={isLoading}
                error={error}
                diagnosis={diagnosis}
                onBack={goBack}
                onContinue={continueFromFeedback}
              />
            ) : (
              <QuestionStep
                key={`${stage}-${questionIndex}`}
                stage={stage}
                currentQuestion={currentQuestion}
                questions={questions}
                questionIndex={questionIndex}
                questionTotal={questions.length}
                answer={answer}
                error={error}
                isLoading={isLoading}
                canGoBack={questionIndex > 0}
                transitionDirection={transitionDirection}
                savedAnswers={answers[stage] ?? {}}
                onAnswer={setAnswer}
                onBack={goBack}
                onNeedHelp={askForQuestionHelp}
                onJumpToQuestion={jumpToQuestion}
                onSubmit={submitQuestion}
              />
            )}
          </section>

          <aside className="diagnosis-panel" aria-label="当前诊断摘要">
            <div className="diagnosis-header">
              <p className="eyebrow">填写提示 <b>✦</b></p>
            </div>
            <div className="insight-callout">
              <p>正在回答：{currentQuestion.label}</p>
              <p>{currentQuestion.prompt}</p>
            </div>
            <ul className="answer-tips">
              <li>用具体的人、场景和已经发生的事实来回答</li>
              <li>暂时不确定也没关系，可以直接说明</li>
              <li>提交后会收到针对下一步的建议</li>
            </ul>
            <section className="answer-standard">
              <p className="eyebrow">好的回答通常包含</p>
              <p>对象、发生时刻，以及你亲眼看到或听到的具体细节。</p>
            </section>
          </aside>
        </div>
        <section className="benefit-row" aria-label="产品价值">
          <div><span>♙</span><p>已帮助用户<strong>12,586+</strong><small>个项目厘清方向</small></p></div>
          <div><span>◷</span><p>平均节省时间<strong>23.7 <small>小时</small></strong><small>从混沌到清晰</small></p></div>
          <div><span>↗</span><p>MVP 成功率提升<strong>2.4 <small>倍</small></strong><small>更聚焦的产品决策</small></p></div>
          <div><span>⌘</span><p>生成提示词质量<strong>90%+</strong><small>更精准的开发输出</small></p></div>
          <blockquote>“这个工具让我少走了很多弯路，MVP 更聚焦，验证更高效。”<cite>— 产品负责人</cite></blockquote>
        </section>
      </section>
    </main>
  );
}

function QuestionStep({
  stage,
  currentQuestion,
  questions,
  questionIndex,
  questionTotal,
  answer,
  error,
  isLoading,
  canGoBack,
  transitionDirection,
  savedAnswers,
  onAnswer,
  onBack,
  onNeedHelp,
  onJumpToQuestion,
  onSubmit,
}: {
  stage: Stage;
  currentQuestion: Question;
  questions: Question[];
  questionIndex: number;
  questionTotal: number;
  answer: string;
  error: string;
  isLoading: boolean;
  canGoBack: boolean;
  transitionDirection: "forward" | "backward";
  savedAnswers: StageAnswers;
  onAnswer: (value: string) => void;
  onBack: () => void;
  onNeedHelp: () => void;
  onJumpToQuestion: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className={`question-scene question-scene-${transitionDirection}`}>
      <nav className="question-navigator" aria-label="本阶段的问题进度">
        <p className="eyebrow">本阶段问题</p>
        <ol>
          {Array.from({ length: questionTotal }, (_, index) => {
            const isCurrent = index === questionIndex;
            const isAnswered = Boolean(savedAnswers[questions[index].id]);
            const isAvailable = index <= questionIndex;
            return (
              <li key={index}>
                <button
                  type="button"
                  className={`question-nav-item ${isCurrent ? "current" : ""} ${isAnswered ? "answered" : ""}`}
                  onClick={() => onJumpToQuestion(index)}
                  disabled={!isAvailable}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`第 ${index + 1} 题${isAnswered ? "，已回答" : ""}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="question-heading">
        <span className="question-index">{String(questionIndex + 1).padStart(2, "0")}</span>
        <div>
          <p className="eyebrow">{currentQuestion.label}</p>
          <h2>{currentQuestion.prompt}</h2>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="answer">回答当前问题</label>
        <textarea
          id="answer"
          value={answer}
          onChange={(event) => onAnswer(event.target.value)}
          placeholder={currentQuestion.placeholder}
          rows={7}
        />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="form-footer">
          <p>{stage === "initial_diagnosis" && questionIndex === 0 ? "这一题只收念头，不急着判断 MVP 或伪需求。" : "答不上来可以先承认不知道，系统会把问题拆小。"}</p>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={onBack} disabled={!canGoBack || isLoading}>
              返回上一题
            </button>
            {currentQuestion.id !== "idea" ? (
              <button type="button" className="helper-button" onClick={onNeedHelp} disabled={isLoading}>
                我还不知道
              </button>
            ) : null}
            <button type="submit" className="primary-button" disabled={isLoading}>
              {isLoading ? "正在生成反馈" : stage === "initial_diagnosis" && questionIndex === 0 ? "下一题" : questionIndex + 1 === questionTotal ? "查看阶段反馈" : "提交并查看反馈"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function StandardFeedbackView({
  stage,
  feedback,
  isLoading,
  error,
  diagnosis,
  onBack,
  onContinue,
}: {
  stage: Stage;
  feedback: StandardFeedback;
  isLoading: boolean;
  error: string;
  diagnosis: Diagnosis;
  onBack: () => void;
  onContinue: () => void;
}) {
  const needsRevision = diagnosis.verdict === "revise" || diagnosis.verdict === "reject";
  const canEnterNextStage = Boolean(feedback.nextStage) && !needsRevision;
  const canReturnToRevisionQuestion = needsRevision && feedback.revisionQuestionIndex !== null && feedback.revisionQuestionIndex !== undefined;
  const heading = feedback.stageComplete
    ? needsRevision
      ? "这一步有结论，也有需要修正的地方。"
      : "这一阶段已经形成了一个清晰的项目判断。"
    : "先停一下，看看这条回答让项目变得更清楚了什么。";
  const actionLabel = canEnterNextStage
    ? `继续进入${stageLabels[feedback.nextStage!]}`
    : canReturnToRevisionQuestion
      ? "回到这题继续拆"
      : feedback.stageComplete
      ? "回到本阶段修改"
      : "继续下一题";

  return (
    <>
      <div className="question-heading">
        <span className="question-index">{feedback.stageComplete ? "CHECK" : "NOTE"}</span>
        <div>
          <p className="eyebrow">{feedback.stageComplete ? "阶段标准反馈" : "即时反馈"}</p>
          <h2>{heading}</h2>
        </div>
      </div>

      <section className="feedback-sheet" aria-label="项目反馈">
        <div className="feedback-overview">
          <p className="eyebrow">我理解到的内容</p>
          <p>{feedback.assistantMessage}</p>
        </div>
        <div className="judgment-grid">
          <FeedbackSection title="这个项目应该做成什么" content={feedback.productJudgment.shouldBe} />
          <FeedbackSection title="这个项目不应该做成什么" content={feedback.productJudgment.shouldNotBe} />
          <FeedbackSection title="真正需要被解决的需求" content={feedback.productJudgment.realNeed} />
          <FeedbackSection title={feedback.stageComplete ? "下一阶段要验证什么" : "为什么下一题值得回答"} content={feedback.productJudgment.nextFocus} />
        </div>
        {needsRevision || diagnosis.risks.length ? (
          <div className={`revision-card revision-card-${diagnosis.verdict}`}>
            <div className="revision-card-header">
              <p className="eyebrow">当前判断</p>
              <span>{diagnosis.verdict === "reject" ? "建议重构" : "需要修订"}</span>
            </div>
            <p className="revision-summary">{diagnosis.summary}</p>
            {diagnosis.risks.length ? (
              <div className="revision-section">
                <p className="eyebrow">需要留意</p>
                <ul>{diagnosis.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
              </div>
            ) : null}
            <div className="revision-section revision-focus">
              <p className="eyebrow">接下来要处理</p>
              <p>{diagnosis.nextQuestion}</p>
            </div>
          </div>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="form-footer feedback-actions">
          <p>{feedback.stageComplete ? `${stageLabels[stage]}的反馈会保留在右侧项目摘要中。` : "你可以先消化这条反馈，再决定是否继续。"}</p>
          <div className="button-row">
            {!needsRevision ? (
              <button type="button" className="secondary-button" onClick={onBack} disabled={isLoading}>
                修改刚才的回答
              </button>
            ) : null}
            <button type="button" className="primary-button" onClick={onContinue} disabled={isLoading}>
              {isLoading ? "正在生成反馈" : actionLabel}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function FeedbackSection({ title, content }: { title: string; content: string }) {
  return (
    <section className="feedback-section">
      <p className="eyebrow">{title}</p>
      <p>{content}</p>
    </section>
  );
}

function FinalPrompt({
  copied,
  documentMarkdown,
  onCopy,
  onDownload,
}: {
  copied: boolean;
  documentMarkdown: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="prompt-result">
      <div className="question-heading">
        <span className="question-index">END</span>
        <div>
          <p className="eyebrow">Markdown 文档</p>
          <h2>已经打包为一份可交付的项目澄清报告。</h2>
        </div>
      </div>
      <div className="prompt-actions">
        <p>这份 Markdown 包含项目判断、MVP 范围和完整开发提示词。</p>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onCopy}>
            {copied ? "已复制" : "复制文档"}
          </button>
          <button type="button" className="primary-button" onClick={onDownload}>
            下载 MD 文档
          </button>
        </div>
      </div>
      <pre>{documentMarkdown}</pre>
    </div>
  );
}

function buildMarkdownDocument(project: Project, finalPrompt: string) {
  const lines = [
    "# 项目澄清报告",
    "",
    "## 1. 项目定位",
    fieldLine("项目想法", project.idea),
    fieldLine("目标用户", project.targetUser),
    fieldLine("使用场景", project.scenario),
    fieldLine("核心问题", project.problem),
    "",
    "## 2. 真实需求判断",
    fieldLine("发生频率", project.frequency),
    fieldLine("当前做法", project.currentAlternative),
    fieldLine("现有做法不足", project.whyAlternativeNotEnough),
    fieldLine("不解决的后果", project.consequence),
    fieldLine("外部证据", project.externalEvidence),
    fieldLine("7 天验证计划", project.validationPlan),
    "",
    "## 3. 伪需求审查",
    fieldLine("专门打开工具的理由", project.whyOpenTool),
    fieldLine("替代风险", project.replacementRisk),
    fieldLine("不可缺能力", project.mustHave),
    "",
    "## 4. MVP 范围",
    fieldLine("核心动作", project.coreMvp),
    fieldLine("最终产出", project.finalOutput),
    "### 明确砍掉的功能",
    listBlock(project.cutFeatures),
    "",
    "## 5. 开发约束",
    fieldLine("开发形态", project.platform),
    fieldLine("约束条件", project.constraints),
    "",
    "## 6. 可直接交给 AI 编程工具的开发提示词",
    "",
    finalPrompt.trim() || "尚未生成。",
    "",
  ];

  return lines.join("\n");
}

function fieldLine(label: string, value?: string) {
  return `- **${label}**：${value?.trim() || "尚未明确"}`;
}

function listBlock(items?: string[]) {
  if (!items?.length) return "- 尚未明确";
  return items.map((item) => `- ${item}`).join("\n");
}

function mergeLocalProject(project: Project, answers: AnswerBook): Project {
  const initial = answers.initial_diagnosis ?? {};
  const validation = answers.need_validation ?? {};
  const review = answers.fake_need_review ?? {};
  const mvp = answers.mvp_scope ?? {};
  const prompt = answers.prompt_generation ?? {};
  return {
    ...project,
    idea: knownText(initial.idea) || project.idea,
    targetUser: knownText(initial.targetUser) || project.targetUser,
    scenario: knownText(initial.scenario) || project.scenario,
    problem: knownText(initial.problem) || project.problem,
    frequency: knownText(validation.frequency) || project.frequency,
    currentAlternative: knownText(validation.currentAlternative) || project.currentAlternative,
    whyAlternativeNotEnough: knownText(validation.whyAlternativeNotEnough) || project.whyAlternativeNotEnough,
    consequence: knownText(validation.consequence) || project.consequence,
    externalEvidence: knownText(validation.externalEvidence) || project.externalEvidence,
    validationPlan: knownText(validation.validationPlan) || project.validationPlan,
    whyOpenTool: knownText(review.whyOpenTool) || project.whyOpenTool,
    replacementRisk: knownText(review.replacementRisk) || project.replacementRisk,
    mustHave: knownText(review.mustHave) || project.mustHave,
    coreMvp: knownText(mvp.coreMvp) || project.coreMvp,
    finalOutput: knownText(mvp.finalOutput) || project.finalOutput,
    platform: knownText(prompt.platform) || project.platform,
    constraints: knownText(prompt.constraints) || project.constraints,
    cutFeatures: knownText(mvp.cutFeatures)
      ? mvp.cutFeatures.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean)
      : project.cutFeatures,
  };
}

function syncAnswersWithProject(answers: AnswerBook, project: Project): AnswerBook {
  const synced: AnswerBook = {
    ...answers,
    initial_diagnosis: { ...(answers.initial_diagnosis ?? {}) },
    need_validation: { ...(answers.need_validation ?? {}) },
    fake_need_review: { ...(answers.fake_need_review ?? {}) },
    mvp_scope: { ...(answers.mvp_scope ?? {}) },
    prompt_generation: { ...(answers.prompt_generation ?? {}) },
  };
  const fieldToAnswer: Array<[Stage, keyof Project]> = [
    ["initial_diagnosis", "idea"], ["initial_diagnosis", "targetUser"], ["initial_diagnosis", "scenario"], ["initial_diagnosis", "problem"],
    ["need_validation", "frequency"], ["need_validation", "currentAlternative"], ["need_validation", "whyAlternativeNotEnough"], ["need_validation", "consequence"], ["need_validation", "externalEvidence"], ["need_validation", "validationPlan"],
    ["fake_need_review", "whyOpenTool"], ["fake_need_review", "replacementRisk"], ["fake_need_review", "mustHave"],
    ["mvp_scope", "coreMvp"], ["mvp_scope", "finalOutput"], ["mvp_scope", "cutFeatures"],
    ["prompt_generation", "platform"], ["prompt_generation", "constraints"],
  ];

  for (const [stageName, field] of fieldToAnswer) {
    const value = project[field];
    if (Array.isArray(value) && value.length) synced[stageName]![field] = value.join("、");
    if (typeof value === "string" && value.trim()) synced[stageName]![field] = value.trim();
  }

  return synced;
}

function needsExternalEvidence(stage: Stage, project: Project) {
  return stages.indexOf(stage) > stages.indexOf("need_validation") && !hasExternalEvidence(project.externalEvidence);
}

function hasExternalEvidence(value?: string) {
  const evidence = value?.trim() ?? "";
  if (evidence.length < 12 || /(暂无|没有|尚无|还没|未访谈|未验证)/.test(evidence)) return false;
  return /(访谈|用户|客户|订单|付费|预约|报名|点击|回复|留言|使用|转化|数据|问卷|社群|咨询)/.test(evidence);
}

function getRevisionQuestionIndex(stage: Stage, diagnosis: Diagnosis) {
  const questions = stageQuestions[stage];
  const diagnosisText = [
    diagnosis.summary,
    diagnosis.nextQuestion,
    ...diagnosis.missingInfo,
    ...diagnosis.risks,
  ].join("\n");
  const index = questions.findIndex((question) => (
    diagnosisText.includes(question.label)
      || diagnosisText.includes(question.prompt)
      || revisionKeywords[question.id]?.some((keyword) => diagnosisText.includes(keyword))
  ));
  return index >= 0 ? index : null;
}

const revisionKeywords: Record<string, string[]> = {
  idea: ["项目想法"],
  targetUser: ["目标用户", "用户类型", "用户画像"],
  scenario: ["使用场景", "场景"],
  problem: ["核心问题", "问题"],
  frequency: ["发生频率", "频率"],
  currentAlternative: ["当前做法", "现有做法", "替代方式"],
  whyAlternativeNotEnough: ["不足之处", "为什么不够好"],
  consequence: ["后果", "代价"],
  externalEvidence: ["外部证据", "可核验证据", "用户证据", "潜在用户证据"],
  validationPlan: ["验证计划", "7 天验证"],
  whyOpenTool: ["打开理由"],
  replacementRisk: ["替代风险", "通用 AI", "现有 App"],
  mustHave: ["不可缺能力", "不可替代能力"],
  coreMvp: ["核心动作"],
  finalOutput: ["最终产出"],
  cutFeatures: ["砍掉功能", "不做哪些功能"],
  platform: ["开发形态"],
  constraints: ["开发约束"],
};
