import sys
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_BREAK
GREY=RGBColor(0x5f,0x61,0x6e)
class T:
    def __init__(s,title,intro):
        s.d=Document(); st=s.d.styles['Normal']; st.font.name='Calibri'; st.font.size=Pt(11)
        for x in s.d.sections: x.left_margin=x.right_margin=Cm(2.2); x.top_margin=x.bottom_margin=Cm(2)
        s.d.add_heading(title,0); s.g(intro); s.d.core_properties.title=title; s.d.core_properties.author='gothamCulture'
    def g(s,t):
        p=s.d.add_paragraph(); r=p.add_run(t); r.italic=True; r.font.color.rgb=GREY; r.font.size=Pt(10)
    def h(s,t,l=2): s.d.add_heading(t,level=l)
    def p(s,t="[Write here]"): s.d.add_paragraph(t)
    def table(s,cols,rows):
        t=s.d.add_table(rows=1+len(rows),cols=len(cols)); t.style='Table Grid'
        for i,c in enumerate(cols):
            cell=t.rows[0].cells[i]; cell.text=''; cell.paragraphs[0].add_run(c).bold=True
        for ri,row in enumerate(rows):
            for ci,v in enumerate(row): t.rows[ri+1].cells[ci].text=v
        s.d.add_paragraph()
    def br(s): s.d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    def save(s,f): s.d.save(f)

out=sys.argv[1]
# MOS-100 Task 1
t=T("Capstone Task 1: Culture Mosaic interpretation memo",
 "MOS-100 template. No more than two pages, to Dana Okafor (CEO) and Alex Moreau (CPO). Your evidence is the Northwind file, Exhibits A to E. "
 "Draft each finding on a Finding Card first (Module 8 job aid). Delete the grey guidance before you hand it in on the capstone page as Task 1 (PDF or Word). "
 "Don't include respondent names, and don't try to work out who said anything.")
t.p("To: Dana Okafor (CEO) and Alex Moreau (CPO)"); t.p("From: "); t.p("Date: "); t.p("Subject: ")
for n in range(1,6):
    t.h(f"Finding {n}" + ("" if n<=3 else " (optional)"))
    if n==1: t.g("3 to 5 findings. Each needs a one-sentence claim, the evidence (which exhibits and numbers), your confidence (high, medium or low) and why, and the so-what for Northwind.")
    for f in ["Claim:","Evidence (exhibits and numbers):","Confidence (high, medium or low) and why:","So-what for Northwind:"]: t.p(f+" ")
t.h("What the data can't tell us yet"); t.g("At least two honest limits.")
t.d.add_paragraph("",style="List Bullet"); t.d.add_paragraph("",style="List Bullet")
t.h("Recommendations"); t.g("What Northwind should do next, and which Mosaic tool, if any, should measure it and when."); t.p()
t.h("Confidentiality note"); t.g("One or two sentences on what you will and won't show the board, and why."); t.p()
t.save(out+'/mos100-task1-memo-template.docx')

# MOS-240 Task 3
t=T("Capstone Task 3: Mosaic Signal analysis memo",
 "MOS-240 template. No more than two pages, to Alex Moreau. Your data is the Mosaic Signal case file (Exhibits S3, S3.8 and S4-final). "
 "Paraphrase stories and remove identifying details. Don't present any group under 10 stories, and don't try to work out who wrote anything. "
 "Delete the grey guidance before you hand it in on the capstone page as Task 3 (PDF or Word).")
t.p("To: Alex Moreau"); t.p("From: "); t.p("Date: ")
t.h("Patterns"); t.g("3 to 5. For each: one sentence in the storytellers' terms; where it shows (chart, region, slice); how many stories, with the total; one or two paraphrased stories; your confidence and why.")
for n in range(1,6):
    t.h(f"Pattern {n}" + ("" if n<=3 else " (optional)"),3)
    for f in ["In the storytellers' terms:","Where it shows (chart, region, slice):","How many stories (of the total):","Paraphrased stories:","Confidence and why:"]: t.p(f+" ")
t.h("Outlier stories"); t.g("2 or 3. Which stories don't fit the main patterns, why they matter, and what you'd look for next.")
t.table(["Story","Why it matters","What you'd look for next"],[["","",""] for _ in range(3)])
t.h("Cautions"); t.g("What the data can't tell Alex, and anything that could mislead a reader."); t.p()
t.h("Recommended next wave"); t.g("What to run, when, what to keep the same, and what you'd compare. Mention any other Mosaic tool you'd use alongside it."); t.p()
t.h("Confidentiality note"); t.g("One or two sentences on what you will and won't share, and why."); t.p()
t.save(out+'/mos240-task3-memo-template.docx')

# MOS-220 rationale
t=T("SurveyCraft practical: design rationale",
 "MOS-220 template. One page for the rationale, then your screenshots (they don't count toward the page). Delete the grey guidance before you hand in this one file.")
t.p("Survey's exact name in the Mosaic Practice Workspace: "); t.p("Survey link: ")
t.h("Decision and objectives"); t.g("What Northwind will decide; your 2–4 objectives."); t.p()
t.h("Question map"); t.g("Each question, its type, and the objective it serves. No more than 10 questions.")
t.table(["#","Question","Type","Objective it serves"],[[str(i),"","",""] for i in range(1,11)])
t.h("Scales and wording"); t.g("Why these scales; how you kept June's item comparable."); t.p()
t.h("Logic"); t.g("What routes where, and how you tested it."); t.p()
t.h("Confidentiality"); t.g("Anonymity setting and what it does and doesn't protect; demographic categories; minimum group size; your answer to Taylor's clinic-by-clinic request."); t.p()
t.h("Distribution and reminders"); t.g("Roster vs QR/link for each group; reminder plan; how you'll track the response rate."); t.p()
t.h("Languages"); t.g("Spanish setup and who reviews the translation."); t.p()
t.h("Reporting plan"); t.g("What Alex and the council get by September 25, what you won't report, and how results go back to staff. Give the client's September 18 close date here."); t.p()
t.br(); t.h("Screenshots",1)
for s_ in ["The test rows on the Responses page, taken before you delete them, showing the charter questions answered only by people who know the charter",
           "Preview of the logic path for someone who knows the charter","Preview of the logic path for someone who doesn't",
           "The survey's settings page: Anonymous Responses, minimum group size, close date and response limit"]:
    t.g(s_); t.p("[Paste screenshot]")
t.g("Don't screenshot Analytics charts or a Compare Two Questions table from your test run: they leave test responses out, so they'll be empty.")
t.save(out+'/mos220-design-rationale-template.docx')

# MOS-210
t=T("Coaching Studio practical: coaching Sam Whitfield",
 "MOS-210 template. One file with Part 1 and Part 2. Delete the grey guidance before you hand it in.")
t.h("Part 1: Engagement Set-up Record",1)
t.g("Set up Sam's engagement on the practice site, attach screenshots, and complete every row including Why. Where the site stops you (connecting Zoom, for example), screenshot the screen where it refuses and give your entry and reason here.")
rows=["Engagement type","Client","Coach","Coachee name, email, time zone","Sessions × minutes, cadence","Sponsor(s): name, title, email, time zone","Cancellation notice","Maximum authorized sessions","How to request additional sessions","Meeting link","Forms the coachee completes before booking","How and when Sam is invited","Goal visibility default you'll agree with Sam","AI consent status at set-up, and your next step","Who is invited to the Sponsor Dashboard, and why"]
t.table(["Field","Your entry","Why"],[[r,"",""] for r in rows])
t.g("If you're a coach without admin rights, say who you'd ask and exactly what you'd ask for."); t.p()
t.h("Screenshots",2); t.p("[Paste screenshots]")
t.br(); t.h("Part 2: First-session plan and privacy reflection",1)
t.h("A. First-session plan"); t.g("No more than one page.")
for f in ["Before the session, in the Studio (at least three specific actions):","Opening: purpose, confidentiality, and what the sponsor will and won't see:","AI: what you'll say to Sam about recording and AI summaries, and what you'll do in the Studio afterwards depending on Sam's answer:","Goals: how you'll set them, and how you'll decide each goal's visibility:","What you'll capture during and after (themes, action items, your own note, any micro-action):"]:
    t.p(f+" ")
t.h("B. Privacy reflection"); t.g("300–500 words. Answer all three.")
t.h("Dana",3); t.g("Dana Okafor would like to be \"kept in the loop\". What will you offer Dana, and through what route? What won't you share, and how will you say so?"); t.p()
t.h("Consent",3); t.g("Why doesn't Sam's comment at the chemistry call count, and what would count? If Sam later emails you agreeing, what would you do, and what would make that impossible?"); t.p()
t.h("Change",3); t.g("If you had to hand Sam's engagement to another coach in three months, what would the new coach see, and what wouldn't they? What would you write in your notes now because of that?"); t.p()
t.save(out+'/mos210-practical-template.docx')
print('ok')
