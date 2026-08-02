from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUT_DIR = Path(__file__).resolve().parents[1] / "outputs"
PDF_PATH = OUT_DIR / "IdeaPilot作品介绍文档.pdf"
FONT_NAME = "ArialUnicode"
FONT_PATH = "/Library/Fonts/Arial Unicode.ttf"


def register_fonts():
    pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontName=FONT_NAME,
            fontSize=24,
            leading=32,
            textColor=colors.HexColor("#111827"),
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=13,
            leading=20,
            textColor=colors.HexColor("#4B5563"),
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName=FONT_NAME,
            fontSize=16,
            leading=22,
            textColor=colors.HexColor("#2E74B5"),
            spaceBefore=14,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName=FONT_NAME,
            fontSize=13,
            leading=18,
            textColor=colors.HexColor("#1F4D78"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=10.5,
            leading=16,
            textColor=colors.HexColor("#111827"),
            spaceAfter=6,
        ),
        "muted": ParagraphStyle(
            "muted",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#4B5563"),
            spaceAfter=6,
        ),
        "table": ParagraphStyle(
            "table",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#111827"),
        ),
        "table_bold": ParagraphStyle(
            "table_bold",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#111827"),
        ),
    }


def p(text, style):
    return Paragraph(text.replace("\n", "<br/>"), style)


def bullet_list(items, style):
    return ListFlowable(
        [ListItem(p(item, style), leftIndent=12) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=18,
        bulletFontName=FONT_NAME,
        bulletFontSize=8,
    )


def numbered_list(items, style):
    return ListFlowable(
        [ListItem(p(item, style), leftIndent=12) for item in items],
        bulletType="1",
        leftIndent=18,
        bulletFontName=FONT_NAME,
        bulletFontSize=10,
    )


def table(data, widths, header=True):
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#D1D5DB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        style.extend([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1F4D78")),
        ])
    t.setStyle(TableStyle(style))
    return t


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Times-Roman", 9)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(doc.leftMargin, letter[1] - 0.55 * inch, "IdeaPilot")
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.55 * inch, str(doc.page))
    canvas.restoreState()


def build():
    OUT_DIR.mkdir(exist_ok=True)
    register_fonts()
    s = styles()
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=letter,
        leftMargin=1 * inch,
        rightMargin=1 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.85 * inch,
    )

    story = []
    story.append(p("作品介绍文档", s["muted"]))
    story.append(p("IdeaPilot 想法明确工具", s["title"]))
    story.append(p("把模糊项目想法变成可执行 MVP 的 AI 引导工具", s["subtitle"]))

    meta = [
        [p("姓名", s["table_bold"]), p("王惠诚", s["table"])],
        [p("日期", s["table_bold"]), p("2026年7月17日", s["table"])],
        [p("项目状态", s["table_bold"]), p("已完成可运行 Demo，可现场演示核心流程", s["table"])],
        [p("一句话", s["table_bold"]), p("它像一个想法导航员，帮助用户从“我有个想法”走到“我知道先做什么”。", s["table"])],
    ]
    story.append(table(meta, [1.25 * inch, 5.05 * inch], header=False))
    story.append(Spacer(1, 12))
    story.append(table([[p("介绍摘要", s["table_bold"])], [p("IdeaPilot 不是通用聊天机器人，也不是项目管理软件。它专门解决项目开始前最容易混乱的一步：让用户按顺序说清楚目标用户、使用场景、真实需求、MVP 范围和开发提示词。", s["table"])]], [6.3 * inch], header=False))

    story.append(p("1. 我的作品是什么", s["h1"]))
    story.append(p("我的作品是一个帮助用户把模糊项目想法整理清楚，并生成 AI 开发提示词的工具。它的名字叫 IdeaPilot，也可以叫“想法明确工具”。", s["body"]))
    story.append(p("它面向有项目想法、懂一点开发或愿意使用 AI 编程工具，但不知道怎样把想法说清楚的人。用户在准备做 Demo、课程作业或个人项目之前，可以打开它，用一组分阶段问题把项目范围收敛下来。", s["body"]))

    story.append(p("2. 我想解决的问题", s["h1"]))
    story.append(bullet_list([
        "很多人一开始想法很多，但说不清第一版最重要的目标。",
        "有人还没有判断真实需求，就直接让 AI 写代码或做页面。",
        "功能越做越多，范围越来越乱，最后 Demo 不像一个清楚的产品。",
    ], s["body"]))
    story.append(p("所以我先做的不是“更强的开发工具”，而是一个帮人明确想法的工具。它解决的是开发前最容易被忽略的一步：先想清楚，再开始做。", s["body"]))

    story.append(p("3. 第一版我先做了什么", s["h1"]))
    story.append(p("第一版只抓住一个核心动作：把问题问清楚。用户会按五个阶段完成一次项目澄清。", s["body"]))
    stages = [
        ("项目初诊", "先判断想法、目标用户、使用场景和核心问题是否清楚。"),
        ("真实需求判断", "追问问题频率、现有做法、替代方案不足和外部证据。"),
        ("伪需求审查", "检查项目是否只是自己觉得有用，或是否可以被通用 AI、表格、备忘录等工具轻易替代。"),
        ("MVP 收敛", "确定第一版必须做什么，并明确砍掉账号、模板市场、多人协作等非核心功能。"),
        ("提示词生成", "输出一份可直接交给 Codex、Claude Code 等 AI 编程工具继续开发的提示词。"),
    ]
    story.append(table([[p("阶段", s["table_bold"]), p("作用", s["table_bold"])]] + [[p(a, s["table_bold"]), p(b, s["table"])] for a, b in stages], [1.45 * inch, 4.85 * inch]))

    story.append(p("4. AI 在作品里的作用", s["h1"]))
    story.append(p("我让 AI 帮我承担“产品教练”的角色。第一版它主要做三件事：", s["body"]))
    story.append(bullet_list([
        "提炼信息：从用户回答里抽取目标用户、场景、问题和限制。",
        "判断风险：提醒证据不足、范围过大、替代方案太强等问题。",
        "推动下一步：根据当前薄弱点提出下一题，让用户继续补齐事实。",
    ], s["body"]))
    story.append(p("后来我让它改成更严格的诊断流程，而不是普通聊天。这样它不会只顺着用户说，而是会追问、判断，并帮助收敛。", s["body"]))

    story.append(p("5. 我会怎样演示 Demo", s["h1"]))
    story.append(numbered_list([
        "输入一个模糊项目想法。",
        "回答目标用户、使用场景和核心问题。",
        "查看 AI 给出的诊断摘要和风险判断。",
        "继续回答真实需求、伪需求审查和 MVP 收敛问题。",
        "最后看到项目定位、MVP 范围、砍掉功能列表和可开发提示词。",
    ], s["body"]))
    story.append(p("大家会看到的重点不是页面点击本身，而是它怎样一步步帮我把想法变清楚。", s["body"]))

    story.append(p("6. 当前已经完成的内容", s["h1"]))
    story.append(bullet_list([
        "本地可运行的单页 Web 工具。",
        "左侧显示五个项目澄清阶段。",
        "中间逐题提问，每次只让用户回答一个核心问题。",
        "右侧显示当前诊断、风险等级、缺失信息和下一步问题。",
        "完成后可以复制或下载最终的项目澄清报告。",
    ], s["body"]))

    story.append(p("7. 下一版我最想加入什么", s["h1"]))
    story.append(p("如果继续做下一版，我最想加入“保存多个项目”和“导出文档”的能力。", s["body"]))
    story.append(bullet_list([
        "保存多个项目：用户可以回看、修改和继续推进不同想法。",
        "导出文档：把澄清结果导出成 Word、PPT 或可提交的项目说明。",
        "拆分开发任务：把最终提示词进一步拆成页面、接口和测试任务。",
    ], s["body"]))
    story.append(p("因为这样可以让一次性的想法诊断，升级成持续的项目规划助手，让用户的项目更容易从想法走向完成。", s["body"]))

    story.append(PageBreak())
    story.append(p("按图片问题填写的版本", s["h1"]))
    story.append(p("下面这部分可以直接作为“我的作品介绍稿”的答案使用。", s["body"]))
    answers = [
        ("我可以这样介绍我的作品：", "我的作品叫 IdeaPilot，是一个帮助人把模糊项目想法整理成可执行 MVP 的 AI 引导工具。"),
        ("我的作品是一个 ____。", "想法明确工具 / AI 项目澄清工具。"),
        ("我想帮 ____，解决 ____ 的问题。", "准备做项目但需求还不清楚的人；第一版到底该做什么、哪些功能应该先砍掉。"),
        ("这次我先做了 ____。", "一个能本地运行的单页 Demo，包含分阶段提问、AI 诊断、MVP 收敛和提示词输出。"),
        ("我让 AI 帮我 ____，第一版它 ____，", "判断项目想法是否清楚；会根据回答继续追问，并指出风险。"),
        ("后来我让它改成 ____。", "更严格的产品教练流程，不只是聊天，而是会判断伪需求、要求补充证据并收敛 MVP。"),
        ("现在我来演示 Demo，我会点开 ____，", "想法明确工具的本地网页。"),
        ("大家会看到 ____。", "我输入一个模糊想法后，系统一步步追问，最后生成项目定位、MVP 范围和可开发提示词。"),
        ("如果继续做下一版，我最想加入 ____，", "保存多个项目、导出文档和拆分开发任务。"),
        ("因为这样可以让 ____ 更 ____。", "一个项目想法；清楚、可推进、可继续开发。"),
    ]
    story.append(table([[p("问题", s["table_bold"]), p("可填写答案", s["table_bold"])]] + [[p(a, s["table_bold"]), p(b, s["table"])] for a, b in answers], [2.2 * inch, 4.1 * inch]))

    story.append(p("一段完整口播稿", s["h1"]))
    story.append(p("大家好，我的作品叫 IdeaPilot，也就是想法明确工具。它是一个帮助用户把模糊项目想法整理清楚，并生成 AI 开发提示词的工具。我想帮助准备做项目但需求还不清楚的人，解决“第一版到底该做什么、哪些功能应该先砍掉”的问题。", s["body"]))
    story.append(p("这次我先做了一个能本地运行的单页 Demo。它会按项目初诊、真实需求判断、伪需求审查、MVP 收敛和提示词生成这五个阶段一步步提问。我让 AI 帮我做产品教练，第一版它会根据用户回答继续追问，并指出目标用户不清楚、证据不足、范围过大等风险。后来我又让它改成更严格的诊断流程，不只是陪聊，而是会判断和收敛。", s["body"]))
    story.append(p("现在我来演示 Demo。我会点开本地网页，输入一个模糊的项目想法。大家会看到系统怎样一步步追问，最后输出项目定位、MVP 范围、砍掉功能列表和可直接交给 AI 编程工具的开发提示词。如果继续做下一版，我最想加入保存多个项目、导出文档和拆分开发任务，因为这样可以让一个项目想法更清楚、更可推进，也更容易继续开发。", s["body"]))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(PDF_PATH)


if __name__ == "__main__":
    build()
