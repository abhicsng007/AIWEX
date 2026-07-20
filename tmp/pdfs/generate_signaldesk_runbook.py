from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase.pdfmetrics import stringWidth
from xml.sax.saxutils import escape
import os

ROOT = r"D:\Downloads\aiwex"
OUT = os.path.join(ROOT, "output", "pdf", "signaldesk-video-workflow-runbook.pdf")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

INK = colors.HexColor("#1e293b")
MUTED = colors.HexColor("#64748b")
PURPLE = colors.HexColor("#6658d9")
LILAC = colors.HexColor("#f0eeff")
MINT = colors.HexColor("#e8f7f0")
BLUE = colors.HexColor("#eef5ff")
ORANGE = colors.HexColor("#fff3e6")
LINE = colors.HexColor("#dbe2ea")
RED = colors.HexColor("#b45344")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=PURPLE, spaceAfter=8, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=28, leading=34, textColor=INK, alignment=TA_CENTER, spaceAfter=11))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontSize=12, leading=18, textColor=MUTED, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=25, textColor=INK, spaceBefore=0, spaceAfter=9))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=PURPLE, spaceBefore=12, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontSize=9.5, leading=14, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontSize=8.3, leading=11.5, textColor=MUTED))
styles.add(ParagraphStyle(name="CodeBlock", parent=styles["Code"], fontName="Courier", fontSize=7.3, leading=10.2, textColor=INK, backColor=colors.HexColor("#f8fafc"), borderColor=LINE, borderWidth=0.5, borderPadding=7, spaceBefore=4, spaceAfter=8))
styles.add(ParagraphStyle(name="Step", parent=styles["BodyText"], fontSize=9.3, leading=13.5, textColor=INK, leftIndent=3, spaceAfter=4))
styles.add(ParagraphStyle(name="Table", parent=styles["BodyText"], fontSize=8.0, leading=10.5, textColor=INK))
styles.add(ParagraphStyle(name="TableHead", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.white))

def p(text, style="Bodyx"):
    if style == "CodeBlock":
        return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])
    return Paragraph(text, styles[style])

def bullet(text):
    return p("- " + text, "Step")

def note(title, text, shade=LILAC):
    t = Table([[p("<b>%s</b><br/>%s" % (title, text), "Bodyx")]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), shade),
        ("BOX", (0,0), (-1,-1), 0.7, colors.HexColor("#cbc7f6")),
        ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    return t

def section_title(number, title, detail):
    return [p("%s. %s" % (number, title), "H1x"), p(detail, "Bodyx")]

def table(headers, rows, widths):
    data = [[p(h, "TableHead") for h in headers]] + [[p(str(cell), "Table") for cell in row] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), PURPLE),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("GRID", (0,0), (-1,-1), 0.35, LINE),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("BACKGROUND", (0,1), (-1,-1), colors.white),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#fbfcfe")]),
    ]))
    return t

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, A4[1] - 13*mm, A4[0] - doc.rightMargin, A4[1] - 13*mm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(PURPLE)
    canvas.drawString(doc.leftMargin, A4[1] - 10*mm, "AIWEX / SIGNALDESK")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    page = "Recording runbook - page %d" % doc.page
    canvas.drawRightString(A4[0] - doc.rightMargin, 10*mm, page)
    canvas.restoreState()

story = []

# Cover
story += [Spacer(1, 42*mm), p("RECORDING RUNBOOK", "CoverKicker"), p("SignalDesk workflow - from onboarding to final report", "CoverTitle"), p("A step-by-step script for recording a short product walkthrough. Follow the actions in order; use the exact answers and wording where supplied.", "CoverSub"), Spacer(1, 13*mm)]
cover_box = Table([[p("<b>Your goal</b><br/>Create one complete simulation record: onboarding - team ceremony - verified engineering work - review - merge - task evidence - final project report. For a 3 minute video, record the complete journey and keep only the best moments in editing.", "Bodyx")]], colWidths=[165*mm])
cover_box.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), LILAC), ("BOX", (0,0), (-1,-1), 1, PURPLE), ("LEFTPADDING", (0,0), (-1,-1), 15), ("RIGHTPADDING", (0,0), (-1,-1), 15), ("TOPPADDING", (0,0), (-1,-1), 15), ("BOTTOMPADDING", (0,0), (-1,-1), 15)]))
story += [cover_box, Spacer(1, 13*mm), p("This document is a practical walkthrough, not a claim that you worked for a company. The feedback cards are simulated evidence from your actions in this app.", "Smallx"), PageBreak()]

# Setup and clip plan
story += section_title("1", "Before you record", "Set up a clean run so the video tells one continuous story.")
story += [
    bullet("Start the app, then open <b>http://localhost:3000/demo?onboarding=1</b>. This starts a new demo at the first onboarding gate without sign-in."),
    bullet("Use 90 to 100 percent browser zoom. Turn on Dark mode only if you want the darker visual style in the recording."),
    bullet("Keep the browser window wide enough to show the left navigation and the main work area."),
    bullet("Do not mark an issue Done before merge. The app intentionally blocks it and creates a follow-up because completion needs real delivery evidence."),
    bullet("After every important click, wait for a toast, a green check, a changed button label, or a new report card before moving on."),
    note("If a stand-up panel is hidden", "Refresh the page after updating the app. The current CSS fix keeps the open stand-up panel above the neighboring cards. Do not continue until the <b>Post my update</b> button is visibly clickable.", ORANGE),
    p("Suggested 3 minute edit", "H2x"),
    table(["Clip", "Keep this on screen", "Target"], [
        ("1", "Onboarding gates moving to 100/100 approval", "25 sec"),
        ("2", "Stand-up, one thoughtful team message, and the assigned issue", "20 sec"),
        ("3", "Workspace change, terminal/checks, and commit", "30 sec"),
        ("4", "PR review, written response, approval, and merge", "35 sec"),
        ("5", "Issue Done, scenario unlock, and one later-level handoff", "20 sec"),
        ("6", "Feedback cards and the final project report", "25 sec"),
    ], [18*mm, 115*mm, 25*mm]),
    PageBreak(),
]

# onboarding
story += section_title("2", "Complete onboarding - exact answers", "Work through the gates in order. This is the first visible proof that the learner is ready to enter the project.")
story += [
    bullet("Click <b>Activate onboarding record</b>, then <b>Confirm profile</b>."),
    bullet("Acknowledge all three policies: Security and acceptable use; Customer data protection; Engineering operating model."),
    bullet("Provision all five required systems: SignalDesk workspace; Scenario repository; Team spaces; Staging environment; Internal knowledge base."),
    p("Role enablement modules", "H2x"),
    table(["Module question", "Choose"], [
        ("Which outcome should guide an unclear implementation trade-off?", "B - Create a trustworthy customer decision surface"),
        ("Where should privileged service-role credentials live?", "B - Only in server-side environment and route handler code"),
        ("Where must an authorization rule for a protected action be enforced?", "B - At the server boundary that performs the action"),
        ("What must remain available for a legacy workspace with no usage threshold?", "A - An explanatory empty state"),
        ("What evidence must your readiness plan include?", "B - Permission guard, legacy behavior, validation, and communication plan"),
    ], [92*mm, 74*mm]),
    p("Manager readiness assessment", "H2x"),
    table(["Question", "Choose"], [
        ("Where should the billing-management rule be enforced?", "B - At the server route or action boundary with canManageBilling"),
        ("What should an older workspace with no usage threshold experience?", "A - A helpful explanatory empty state"),
        ("How should privileged service-role credentials be handled?", "A - Keep them only in server-side environment and route code"),
        ("Which validation set best supports this implementation?", "B - Test allowed and restricted roles plus the legacy empty state"),
        ("What is the right delivery record before merge?", "A - Open a pull request with validation evidence and any risk or handoff"),
    ], [92*mm, 74*mm]),
    bullet("Click <b>Submit assessment for manager review</b>. Show the <b>Project access approved - 100/100</b> screen for two seconds, then click <b>Enter main project</b>."),
    PageBreak(),
]

# ceremonies
story += section_title("3", "Show the real work ceremonies", "This is where the simulation becomes a workplace workflow rather than a coding-only demo.")
story += [
    bullet("On Home, leave the first level as <b>Basic</b>. It contains PROJ-184: Build the usage alerts empty state."),
    bullet("Click <b>Post update</b>, then <b>Post my update</b>. Wait until the button changes to <b>Posted</b> and Sprint readiness counts the stand-up."),
    bullet("Open <b># product-usage</b> and send one message that has a mention, a risk or validation detail, and a question. Use this exact text:"),
    p("@noah I am implementing PROJ-184 with the canManageBilling guard because restricted roles must not see the billing action. I will validate the allowed role, restricted role, and legacy empty state. Is there any API edge case beyond a missing threshold that I should cover?", "CodeBlock"),
    bullet("Wait for the teammate reply and show its notification. This proves the conversation is connected to the work."),
    bullet("Optional but useful: open Calendar, show the scheduled ceremony, or open Meetings. Do not advance simulated time merely to make the video look busy; only use it when you want to demonstrate schedule follow-up."),
    note("What a stand-up means", "A stand-up is a short daily commitment: what you are doing, where the risk is, and whether you need help. It is not a long status report.", BLUE),
    PageBreak(),
]

# Coding and PR
story += section_title("4", "Deliver one task through the merge gate", "Repeat this full cycle for every assigned task. The first Basic task is the best one to keep in the video.")
story += [
    p("Workspace", "H2x"),
    bullet("Open <b>Workspace</b>. In <b>app/components/alerts-panel.tsx</b>, replace the editor contents with the safe reference implementation below."),
    p("import { EmptyState } from './empty-state'\n\ntype UsageAlert = { id: string; currentUsage: number }\n\n/** Restrict the billing-management link by role. */\nexport function AlertsPanel({ alerts, canManageBilling }: { alerts: UsageAlert[]; canManageBilling: boolean }) {\n  if (!alerts.length) {\n    return <EmptyState\n      title=\"No usage alerts yet\"\n      description=\"We'll let you know when your workspace is close to a limit.\"\n      action={canManageBilling ? <a href=\"/settings/billing\">Review your plan</a> : undefined}\n    />\n  }\n  return <ul>{alerts.map((alert) => <li key={alert.id}>Usage is {alert.currentUsage}</li>)}</ul>\n}", "CodeBlock"),
    bullet("Click <b>Save revision</b>. Open <b>Terminal</b> if you want the terminal output visible. Then click <b>Run scenario checks</b> and wait for <b>Scenario checks passed</b>."),
    bullet("Click <b>Commit changes</b>. Wait for the committed status, then click <b>Open pull request</b>."),
    p("Pull request", "H2x"),
    bullet("In Pull requests, select PR #482 if it is not already open. Click <b>Mark as addressed</b>."),
    bullet("In Your review response, paste the following, then click <b>Send response</b>:"),
    p("I added the canManageBilling guard so restricted users do not receive the billing-management action. The empty state remains available for legacy workspaces with no threshold. I saved the revision and reran the scenario checks for allowed, restricted, and legacy behavior.", "CodeBlock"),
    bullet("Wait about one second for Noah's automatic approval. In Merge rationale, paste this text, then click <b>Merge pull request</b>:"),
    p("The role guard is enforced at the action boundary, the legacy empty state remains helpful, and the server-verified scenario checks passed before review approval. The change is safe to merge.", "CodeBlock"),
    bullet("Open <b>Issues</b>. Set the active issue to <b>Done</b>. This creates that task's immutable delivery report and starts the next assigned cycle when one exists."),
    PageBreak(),
]

# repeat levels
story += section_title("5", "Finish Basic, Intermediate, and Advanced", "The same evidence gate applies to every task. Never skip straight from code edit to Done.")
story += [
    table(["Level", "Assigned tasks", "What to do"], [
        ("Basic", "PROJ-184", "Complete the full cycle on the previous page. The Home panel should then unlock Intermediate when the score requirements are met."),
        ("Intermediate", "PROJ-191, then PROJ-189", "Select Intermediate from Home. For each task: stand-up - context-rich message - save - checks - commit - PR - address review - response - approval - rationale - merge - Done."),
        ("Advanced", "PROJ-203, then PROJ-204, then PROJ-205", "Select Advanced only after the two Intermediate tasks are Done. Follow the same merge gate in the displayed order."),
    ], [27*mm, 42*mm, 97*mm]),
    p("Do this at the beginning of each new task", "H2x"),
    bullet("On Home, confirm the active issue ID in <b>Your focus</b>. If a new cycle started, post the stand-up before making the next change."),
    bullet("Send a fresh teammate message that contains @noah or @maya, a concrete risk or validation plan, and a question. This keeps the collaboration evidence strong."),
    bullet("Use the same implementation and PR wording as a recording-safe template when the workspace scenario remains the usage-alerts task. If the issue has different acceptance criteria, describe that issue truthfully in the message and rationale."),
    bullet("After each merge, use Issues to set only the active task to Done. The app will prevent you from completing a later task first."),
    note("Why all six reports matter", "Each Done action after a verified merge creates one collapsible task report. After PROJ-205 is completed, the app also creates the final project report. The report is a snapshot of recorded events, not a manually written resume claim.", MINT),
    p("If Intermediate does not unlock", "H2x"),
    bullet("Open Feedback and read the unmet requirement. Usually the missing evidence is a context-rich team message, a successful check, a commit, or a closed merge gate."),
    bullet("Do not change the scenario level before the current level's task count and score requirements are marked complete."),
    PageBreak(),
]

# report and checklist
story += section_title("6", "Capture the reports and end the video", "Feedback is the best final screen because it turns the entire journey into readable, recruiter-relevant evidence.")
story += [
    bullet("Open <b>Feedback</b>, then click <b>Refresh evidence</b>. Wait until the loading state is gone."),
    bullet("Show Work readiness plus the four supporting dimensions: Technical execution, Collaboration, Ownership and reliability, and Process fit."),
    bullet("In Delivery evidence history, expand one task report. Show the recruiter-relevant evidence and recorded delivery trail - this is the strongest proof that the activity was not silent or disconnected."),
    bullet("After all six tasks are Done, expand the <b>FINAL PROJECT REPORT</b>. It should state that all six delivery tasks across Basic, Intermediate, and Advanced were completed."),
    bullet("For the final video shot, keep the Feedback report on screen for 3 to 5 seconds. This makes a clean ending after the PR merge clips."),
    p("Final recording checklist", "H2x"),
    table(["Evidence", "Visible confirmation to capture"], [
        ("Onboarding", "Project access approved - 100/100"),
        ("Ceremony", "Stand-up button says Posted; teammate message and reply are visible"),
        ("Engineering", "Scenario checks passed; commit shown"),
        ("Collaboration", "PR review response, approval, and merge rationale"),
        ("Delivery", "Issue set to Done after merge; task report appears"),
        ("Completion", "Final Project Report in Feedback after all 6 tasks"),
    ], [42*mm, 124*mm]),
    note("Honest narration line", "I am showing a simulated workplace workflow. The report records the actions I completed inside the app so I can practise explaining evidence, review, risk, and delivery process.", BLUE),
    Spacer(1, 7*mm), p("End of runbook", "CoverKicker"),
]

doc = SimpleDocTemplate(OUT, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=18*mm, title="SignalDesk video workflow runbook", author="AIWEX")
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
