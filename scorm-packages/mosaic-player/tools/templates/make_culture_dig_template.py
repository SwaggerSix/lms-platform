import sys
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_BREAK
out=sys.argv[1]
doc=Document()
st=doc.styles['Normal']; st.font.name='Calibri'; st.font.size=Pt(11)
for s in doc.sections: s.left_margin=s.right_margin=Cm(2.2); s.top_margin=s.bottom_margin=Cm(2)
GREY=RGBColor(0x5f,0x61,0x6e)
def guide(t):
    p=doc.add_paragraph(); r=p.add_run(t); r.italic=True; r.font.color.rgb=GREY; r.font.size=Pt(10); return p
def h(t,l=2): return doc.add_heading(t,level=l)
def write(): doc.add_paragraph("[Write here]")
def table(cols,rows):
    t=doc.add_table(rows=1+len(rows),cols=len(cols)); t.style='Table Grid'
    for i,c in enumerate(cols):
        cell=t.rows[0].cells[i]; cell.text=''; r=cell.paragraphs[0].add_run(c); r.bold=True
    for ri,row in enumerate(rows):
        for ci,v in enumerate(row): t.rows[ri+1].cells[ci].text=v
    doc.add_paragraph()
DOMAINS=["Espoused Beliefs and Values","HR Management Systems and Processes","Organizational Artifacts","Organizational History","Organizational Stories","Rituals and Rites of Passage","Stakeholder Relations"]

doc.add_heading("Capstone Task 2: Culture Dig plan and synthesis memo",0)
guide("MOS-230 template. Fill in both parts, delete the grey guidance, and hand in this one document (Word or PDF) on the capstone page as Task 2. "
      "Your evidence is the Northwind dig file. Nothing in either part may name or point to an individual. "
      "Don't promise Taylor results for individual clinics, and don't report any site or group under 10 stories.")
doc.add_paragraph("Your name: ")

h("Part A: Clinic Network Culture Dig — Program and Fieldwork Plan",1)
guide("Length: about 3 pages, plus a one-page fieldwork plan for two domains of your choice.")
h("1. Recommendation to Alex and Taylor")
guide("Half a page. What you recommend, including anything you'd change from Taylor's request, and why. Address the request for results by clinic.")
write()
h("2. License and waves")
guide("What Northwind must buy (if anything), who can buy it, what it includes and doesn't, and how this program relates to the org-wide program's wave 2.")
write()
h("3. People and access")
guide("Cover: Program Leads (and a backup who can buy waves), your role, Taylor Brooks, Jordan Reyes, returning and new researchers.")
table(["Role","Who","Why","Account/invitation notes"],[["","","",""] for _ in range(6)])
h("4. Team staffing")
guide("Seven domains: who, how many per team, sites and levels covered, and the conflicts you avoided.")
table(["Domain","Who","How many","Sites and levels covered","Conflicts avoided"],[[d,"","","",""] for d in DOMAINS])
h("5. Timeline")
guide("Start, findings due, story window, analysis, report, readout. Adjust anything that needs adjusting, and say why.")
table(["Milestone","Date","Why this date"],[[m,"",""] for m in ["Start","Findings due","Story window opens","Story window closes","Analysis","Report","Readout"]])
h("6. Story collection")
guide("At least one example prompt for each of the seven domains, in the clinics' own language (mark any library prompts and how you adapted them). "
      "How many prompts per domain, and why. How the link reaches clinic staff. Your story target per domain, the risk that some domains won't reach 10, and what you'll do while stories arrive. How and when you'll close collection.")
table(["Domain","Example prompt(s)","Library prompt? How adapted","Story target"],[[d,"","",""] for d in DOMAINS])
doc.add_paragraph("Prompts per domain, and why: ")
doc.add_paragraph("How the link reaches clinic staff: ")
doc.add_paragraph("Risk that some domains won't reach 10, and what you'll do while stories arrive: ")
doc.add_paragraph("How and when you'll close collection: ")
h("7. Protecting people")
guide("Interviewee briefing, small-clinic risks, researcher confidentiality, and what Taylor will and won't see.")
write()
h("8. Fieldwork plan for two domains")
guide("One page; use the CD-M3 Domain Fieldwork Plan. For each: questions (start with the guide's four), who you'll interview across which clinics, artifacts, events, schedule, recording rules.")
for n in (1,2):
    h(f"Domain {n}: [name]",3)
    for f in ["Questions","Who you'll interview, across which clinics","Artifacts","Events","Schedule","Recording rules"]:
        doc.add_paragraph(f+": ")

doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
h("Part B: Synthesis Memo — Why Decisions Feel Closed",1)
guide("Two pages (about 900–1,200 words), for the executive team, which includes Jordan Reyes. Write about patterns, not people.")
h("1. Headline")
guide("One or two sentences: your answer to Alex's question.")
write()
h("2. Three findings")
for n in (1,2,3):
    h(f"Finding {n}",3)
    doc.add_paragraph("Claim: ")
    guide("One plain sentence.")
    doc.add_paragraph("Evidence: ")
    guide("From both streams: team fieldwork, story patterns (with margins, and what sits underneath), story summaries. Use the Culture Mosaic statements only where they sharpen the finding, words against words.")
    doc.add_paragraph("Where the streams agree or diverge: ")
    doc.add_paragraph("Confidence (high, medium or low) and why: ")
h("3. What it adds up to")
guide("What the culture does around decisions, and what it costs. Not whether it's good or bad.")
write()
h("4. Limits")
guide("What this evidence can't tell the executive team.")
write()
h("5. Recommendations")
guide("Three or four, each specific to this evidence and starting with a verb.")
for i in range(4): doc.add_paragraph("", style="List Number")
h("6. If you'd quote anyone")
guide("Say which story, and confirm the four quote checks. You don't have to quote.")
write()
doc.core_properties.title="Culture Dig plan and synthesis memo template"
doc.core_properties.author="gothamCulture"
doc.save(out)
