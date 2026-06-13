-- Reconcile both storefront catalogs to the real Ecwid export (products_20260613).
-- Decisions (confirmed with owner): all products are quote-only (price 0, shown
-- as "Contact us for pricing"), and the full catalog is mirrored into BOTH stores.
-- Products carry their Ecwid product_id as external_id so legacy -p<id> links 301.

-- 1) Remove the previously reconstructed/sample products (no real Ecwid id and
--    never ordered). Real catalog below is the source of truth.
DELETE FROM products
WHERE storefront_id IS NOT NULL
  AND external_id IS NULL
  AND id NOT IN (SELECT product_id FROM order_items);

-- 2) Load the real catalog into the gothamculture store.
INSERT INTO products
  (storefront_id, external_id, name, description, category, categories,
   duration_label, delivery_formats, image_url, sku, price, status)
SELECT s.id, v.external_id, v.name, v.description, v.category, v.categories,
       v.duration_label, v.delivery_formats, v.image_url, v.sku, 0, v.status
FROM storefronts s
JOIN (VALUES
('632683439','2 CFR 200: Uniform Administrative Requirements For Federal Grants','2 CFR 200: Uniform Administrative Requirements For Federal Grants
Learn to confidently navigate the Uniform Guidance (2 CFR 200) Subparts A–D. This course will help you make sense of this critical and complex grants regulation. Gain an in-depth understanding of how these requirements apply for grantors and grantees across the grant lifecycle. This is a core course in all tracks of the GMCP™.
Who Takes This Course: Anyone who needs to understand the fundamental rules governing Federal assistance will benefit from this course. Participants who completed this course prior to implementation of 2 CFR 200 would benefit from retaking this course to understand the changes. 
Course Format: Lecture, discussion, hands-on practical exercises, case studies, and final exam. 
Learning Objectives 
Describe the purpose and applicability of the Uniform GuidanceUse 2 CFR 200, Subparts A and B to locate information about general terms and requirements Use 2 Code of Federal Regulations (CFR) 200, Subpart C to identify the pre-award requirements for federal awarding agencies and describe how they affect nonfederal entities Use 2 CFR 200, Subpart D to identify the post-award requirements for federal awarding agencies and describe how they affect nonfederal entities (NFEs) Apply the administrative requirements found in the Uniform GuidanceCourse Topics 
Introduction to the Uniform Administrative Requirements 
Significance of the Uniform Administrative Requirements Understanding the Uniform GuidanceGeneral Provisions of the Uniform Guidance (2 CFR 200, Subparts A and B) 
Acronyms and Definitions in the Uniform Guidance (2 CFR 200, Subpart A) General Provisions of the Uniform Guidance (2 CFR 200, Subpart B)Pre-Federal Award Requirements and Contents of Federal Awards (2 CFR 200, Subpart C) 
Federal Award Instruments and Program Planning Notices of Federal Financial Assistance Merit Review Process Pre-Award Risk Assessment Application Forms Specific Conditions Certifications and Representations Federal Award Document Information That Becomes Public ProhibitionsPost Federal Award Requirements (2 CFR 200, Subpart D) 
General Provisions (2 CFR 200.300–309) Property Standards (2 CFR 200.310–316) Procurement Standards (2 CFR 200.317–327) Performance and Financial Monitoring and Reporting (2 CFR 200.328–330) Subrecipient Monitoring and Management (2 CFR 200.331–333) Record Retention and Access (2 CFR 200.334–338) Remedies for Noncompliance (2 CFR 200.339–343) Closeout (2 CFR 200.344–346)Course Capstone 
Navigating 2 CFR Subparts A-D Capstone','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4147233576.png','00187','active'),
('477762414','5 Strategies to Maintain Employee Engagement Through Turbulent Times','Session Description:

Now, more than ever, leaders need to develop skills to help themselves and their teams effectively cope with uncertainty. Amidst turbulent times, organizations call upon employees not just to carry on but to remain engaged and highly productive. 
This practical online workshop will allow you to reflect and compare notes on your biggest challenges as leaders – from maintaining morale and motivation in remote environments to managing impossible workloads. It will give a practical set of tools (particularly relevant in a virtual or hybrid set up) to apply with your direct reports to maintain trust and productivity under constantly changing organizational conditions. It will help you to model and facilitate productive behaviors despite environmental uncertainty and turbulence
Learning Objectives:
Remain engaged and highly productive during the turbulent timesStrategize for current or anticipated changesIdentify and manage resistanceAcquire a practical set of tools to apply with their direct reports to maintain trust and productivityMethodology:
Mini-lecture with relevant examples Interactive exercisesIndividual reflectionSmall group discussionsApplication & action planningTarget Audience:
Leaders of organizations, departments, units, volunteer teamsAnyone with direct report(s)','Leading Teams',ARRAY['Leading Teams']::text[],'4-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3143451253.jpg','LT1','active'),
('841231282','Acquisition Planning','Learn how to develop comprehensive acquisition plans that align with agency mission objectives. Covers market research methodologies, acquisition strategy development, and the planning requirements of FAR Part 7.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231282/5816036156.jpg','GGS-ACQ-PLAN','active'),
('841231318','Advanced Federal Grants Management','Builds on foundational knowledge with in-depth coverage of complex grants management issues including cost allocation, subrecipient monitoring, single audit requirements, and managing high-risk award conditions.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231318/5816039604.jpg','GGS-GMS-AFGM','active'),
('841231319','Allowability of Costs Under Federal Awards','A focused examination of the cost principles in 2 CFR Part 200, Subpart E. Participants learn to determine whether costs are allowable, allocable, and reasonable, and how to document cost decisions for audit purposes.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231319/5816039605.jpg','GGS-GMS-ACFA','active'),
('676077739','Appropriation Law Refresher Training (1-day)','Questions? Contact our training coordinator via email or phone at (202) 843.5447.

Course DescriptionThe Appropriation Law Refresher training is designed for acquisition professionals to reinforce their understanding of federal appropriation laws and their application in the procurement process. Aligned with the FAC-C continuous learning requirements, the course will cover key principles, recent updates, and best practices to ensure compliance with legal and regulatory standards. Participants will engage in interactive lectures, discussions, and practical exercises to refresh their knowledge and enhance their ability to apply appropriation law effectively in their roles.
Course Objectives
 Understand the foundational principles of federal appropriation law.Stay updated on recent changes and developments in appropriation law.Ensure compliance with appropriation laws in the procurement process.Identify and address common appropriation law issues and challenges.Apply appropriation law principles through practical exercises and case studies.
This training course will ensure that acquisition professionals are well-versed in the principles of federal appropriation law, equipped to handle appropriation issues effectively, and committed to maintaining compliance with legal standards in their procurement activities.

 
 Schedule a class or get more information! Contact Joy Stone at jstone@gothamgovernment.com or Sherelle Abernathy at sabernathy@gothamgovernment.com for more information or to schedule this or any of GGS’s other Professional Acquisition and Contracting Training Series courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],NULL,'00198','active'),
('648611517','Appropriations Law Refresher Training','Appropriations Law Refresher Training
April 26, 2024 – 9:30 AM – 5:30 PM ET | $395 per person | Course Length: 1 day
This is an 8-hour refresher course on important topics covering appropriation law. 
 
Course Objectives

Provide students with increased awareness of how appropriation decisions are developed Provide students with improved ability to research appropriation questions as neededThe materials:

GGS text GAO “Red Book” Online Department of the Treasury FAST Book','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4271376683','00194','inactive'),
('479750614','Are We Being Strategic?','Description:

Quick, name your company’s strategic objectives for this year! Struggling? Can you get close? Being strategic takes more than just a few meetings. It’s an ongoing conversation and mindset, a gear we switch into when business demands require it.

This course will illuminate how to identify areas of your team’s work that require strategic thinking and give you conversation tools to pull people out of the weeds.

Learning Objectives:

 Raising Awareness: How to tell if you’re being strategic
 Strategic activities in teams
 Individual strategic activities
 How to inspire strategic thought and action
Methodology:

 Lecture
 Discussion
Target Audience:

 Mid- to Senior-level leaders','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3152894174.jpg','LT2','active'),
('491773929','Art of Networking in Virtual World','Session Description
/ˈnetwərkiNG/ n
- The action or process of interacting
with others to exchange information and develop professional or social
contacts.
The act of networking is
something that is both a science and an art. This session will provide research
on the impact of networking and dive into specific tools. Participants will learn tips to navigate this
task at conference and when it is the last item on their to-do list.
Participants will explore their
own perspectives on networking, create a networking plan and leave with tools
to help them reach their networking goals. 

Note: This can be customized for
an all-female audience like a Women’s Employee Resource Group. This session
would include research and discussion on specific aspects that impact women in
the workplace.
Learning Objectives
Explore individual perspective on networkingDive into the reasons why networking is importantLearn techniques to make networking easier and a more consistent part of your career pathMethodology
LectureDiscussionParticipants will engage in individual and group activities, such as self-reflection and table group discussionsTarget Audience
Leaders at all levelsHigh-potential individual contributors Project/Program managers','Communication',ARRAY['Communication']::text[],'2-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146237877.jpg','00067','active'),
('491975570','Basic Coaching for Leaders','Session Description
The International Coaching
Federation defines coaching as “Partnering with the learner/coachee
in a thought-provoking and creative process that inspires her/him to maximize
his/her personal and/or professional potential.” Leaders who do not coach are
not necessarily bad managers, but they can be more successful if they use their
position to develop talent. This session provides information and practice to
managers on how to become and stay effective coaches to their peers and
subordinates. 
Participants will build their
understanding of basic theories behind coaching, learn a basic coaching
framework, and increase their awareness of personal strengths that will help
them coach. Participants will apply this learning to multiple rounds of coaching
practice with their fellow participants. A facilitator will provide real-time
corrections and feedback as participants are practicing, to ensure quick
learning and good habit formation. 
Learning Objectives
Define coachingUnderstand the importance of coaching in the context of leadership and organizational strategy Utilize a practical framework to have coaching conversations with their direct reports and/or peers Identify specific skills that need to be developed in order to have productive coaching conversationsDevelop an action plan to begin applying and building their basic coaching skills 
Methodology
Small group exercises PowerPoint and workbooks are used to provide a guiding framework for participants Self-reflectionTable group discussionsRole playsCase studies or other structured exercisesTarget Audience
Leaders at all levelsHigh-potential individual contributors Project/Program managers','Communication',ARRAY['Communication']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146251296.jpg','00068','active'),
('841231317','Basics of Federal Grants Management','Introduces the federal grants management lifecycle from pre-award through closeout. Covers Uniform Guidance (2 CFR Part 200), key roles and responsibilities, and the fundamental obligations of federal grant recipients.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231317/5816039598.jpg','GGS-GMS-BFGM','active'),
('841231283','Best Value Tradeoff Source Selection','This course provides in-depth training on the best value tradeoff source selection process, including evaluation factor development, technical evaluation procedures, and documentation standards consistent with FAR Part 15.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231283/5816036162.jpg','GGS-BVTS','active'),
('493021738','Brand Called You','Session Description
Defining and enhancing personal
brand. This skill becomes especially important in the virtual setting and
mostly matrix reporting environment.
Our personal brand is quite
significant for our success. Whether you are working for a company or you own
your own, it is important to recognize this fact, and be mindful about how we
are unconsciously branding ourselves. 
This course is designed to
support the individuals understand the importance of the personal brand is for
the advancement of the careers/business; how our behavior contributes to personal brand and how
they can consciously enhance it.

Learning Objectives
Understanding of what personal branding
is, what contributes to our brand, and how one can consciously develop and
enhance their personal brand. 
 
 
 
 
 
 
 
 
Methodology
LectureSelf-reflection and awarenessIndividual and group exercises to develop and start expressing one’s own authentic brand.Post session survey for participants to utilize as they continue to build their brand. 
 
Target Audience
Leaders at all levels','Presence',ARRAY['Presence']::text[],'1-Day',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146237748.jpg','00099','active'),
('711500801','Budgeting and Accounting: Making the Connection','Budgeting and Accounting: Making the Connection
Gain a deep understanding and insight into why federal budgeting and accounting is challenging for accountants and budgeteers alike. Eliminate your insecurities about the requirements of federal budgeting and accounting with an introduction to these functions, as well as their integration into the federal financial management process. Through a discussion-based class where you will share experiences with others in similar roles, you will learn about these concepts to improve your approach to financial management.
Learning Objectives
Make the connection between budgeting and accountingApply budget and accounting terminology appropriatelyTrack budgetary and proprietary accounting transactions through the budget execution processDescribe the use of the U.S. Standard General Ledger account structureRelate budget obligations to agency assets, liabilities, and expensesDetermine unfunded budget requirements from accounting reportsImprove budget estimating with accounting informationFederal Budget Process
What Is a Budget?Why Is a Budget Necessary?Legal Foundations in the Federal GovernmentWays the Agency Budget Is DisplayedPhases of the Federal Budget ProcessAgency Funds and ResourcesIntroduction to Federal Accounting
What Is Accounting?Accounting CycleAccounting in the Federal GovernmentBudgetary and Proprietary Accounting
Budgetary Accounting ProcessSteps in the Budgetary Accounting ProcessTracking Reimbursable AuthorityWhy Proprietary Accounting?Basic Proprietary Accounting Equation for the Federal GovernmentExpanded Proprietary Accounting EquationNormal BalancesAccrual Basis of AccountingIntegrating Budgetary and Proprietary AccountingExercise: Proprietary AccountingExercise: Budgetary and Proprietary Accounting RelationshipsFederal Financial Reporting
Objectives of Federal Financial ReportingExpanded Financial ReportingContent of Agency Financial StatementsFinancial StatementsUsing Financial ReportsGovernment Performance and Results Act Modernization Act of 2010Making Improvements in GovernmentMaking the Connection
Making the ConnectionOptional Exercise: Overview of Budgeting and Accounting','Federal Management & Budgetary Strategies',ARRAY['Federal Management & Budgetary Strategies']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4657980983.jpg','00203','active'),
('491980087','Build a Coaching Culture','Session Description
While
all managers should develop a coaching skillset, anyone can learn to be a coach
and apply coaching principles in any direction. This course will provide
fundamental concepts that will help build an organization of coaches regardless
of title, using coaching strategies to deepen thinking and promote personal and
professional growth.
Learning Objectives
Understand the behavioral differences between managing and coaching.Learn to recognize when coaching, managing or both are appropriate responses to a situation.Use job descriptions as foundations for analyzing what to coach and what to manage.Explore basic mentoring concepts.Learn basic coaching skills and how to use them.Learn basic accountability strategies. 
 
Methodology
LectureDiscussionReflective Group Activities and Action PlanningTarget Audience
Leaders at all levels','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146249053.jpg','00069','active'),
('841231296','Building and Sustaining High Performance Teams','Explores the dynamics of high-performing teams in government contexts. Covers team development stages, psychological safety, trust-building strategies, and techniques for sustaining performance through organizational change.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231296/5816036222.jpg','GGS-LMT-BHPT','active'),
('479745371','Building Cohesive Teams (MBTI or DISC)','Session Description:

Teams are more productive when everyone is pulling in the same direction. Productivity is increased when people understand the contribution they make to the overall goal & have a stake in the team’s success. 
This session will enable teams to explore in detail what it is they do & why, and how they can work together most productively. 
Participants will learn how to create a shared vision & values for their team, and how to harness the contributions and strengths of individual team members for maximum impact. The session will draw on insights from the Myers-Briggs Personality Type model to enhance team working & cohesion.

Learning Objectives:

Explore individual & shared values to create a shared Team purpose & missionIdentify strengths & contributions of all team membersUnderstand how to work together most effectively as a Team Methodology:

For use with existing teamsMyers Briggs Type Indicator self-assessment Facilitated discussions & learningGroup work & practical exercisesAction planning for accountability & sustainable changeTarget Audience:

Leaders at all levelsHigh-potential individual contributorsStaff at all levels','Leading Teams',ARRAY['Leading Teams']::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3152946137.jpg','LT4','active'),
('490664408','Building Effective Relationships at Work','Session Description:

“If you want to go fast, go
alone. If you want to go far, go together” – African proverb
It’s rare at work that we can
achieve everything we want to on our own. Working with other people and
building effective relationships at work is the key to success – ours and our
team’s. 
In this session, we will explore
what makes some relationships work better than others, how trust can be built
quickly and effectively, strategies for identifying and investing in our most
important relationships as well as some tips for what to do when it all goes
wrong!
Learning Objectives:
Identifying the relationships at work that are most important to usLearning techniques to create rapport and build trustExploring how to defuse common tensions and resolve misunderstandings earlyUnderstanding what to do to make authentic investments in the relationships that really countMethodology:
Highly interactiveSharing strategies, tips, and
toolsFacilitated group discussionsIncludes introduction to DiSC behavioral styles modelAction planning for
accountability and sustainable changeTarget Audience:

Leaders at all levelsHigh-potential individual contributorsStaff at all levels','Leading Teams',ARRAY['Leading Teams']::text[],'4-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3152946137.jpg','00047','active'),
('490713532','Building High Performing Teams','Session Description:

Often companies utilize
measurement tools to profile their employees, and nothing comes further out of
that. Teams are built by the accomplishments of the individuals not necessarily
based on their strengths to create strong and well-dispersed team. Furthermore,
group or department leaders assign individuals to the deliverables based on
their titles not necessarily what they are good at. 

This revolutionary approach
supports the leaders to create strength based deliverable assignment to their
teams and organizations. It is recommended that the leader of the organization
has also a few strategy design coaching sessions to get the best outcome out of
this training prior to the course day. 
Learning Objectives:
Increase awareness of the significance of
effective collaborative environment and utilizing the authentic strengths of
the team members for the success of the team/departmentUnderstanding and appreciating the
strengths of the self and othersSeeking to create diversified teams for
successMethodology:
Using MRG IDI Teams or Gallup Strengthsfinder to create a team’s strength profileDiscuss the highlights of the measurement
tool with the team in a lecture style and explore one examplePartner up the participants to study each
other’s profile and then share in a group settingHave a group learning and insight
discussionCreate a strategy to walk away from the
session on how to utilize team’s strengths moving forwardTarget Audience:

Leaders at all levelsHigh-potential individual contributorsProject Program Managers','Leading Teams',ARRAY['Leading Teams']::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146254452.jpg','00048','active'),
('490382357','Business Writing & Email Etiquette','Up to 30 participants
Choose preferred start date at checkout.
Course Description
TBD
Course ObjectivesTBD
Course OverviewTBD
Contact Joy Smith Stone, Training Coordinator at jstone@gothamgovernment.com or (828) 750-5994 for more information or to schedule this or any of GGS’s other writing courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],NULL,'00036','inactive'),
('491980835','Clarifying Your Team’s Purpose and Strategy','Session Description
Truly effective leaders can focus
their teams on a clear purpose and help individuals on their teams understand
how their work connects to the organizations mission and strategy. The problem
in many organizations, is that workers know the tasks that make up their job
descriptions, but they don’t often know how their work contributes to the
objectives of the organization.
In this full day workshop,
participants gain a clear understanding of their own purpose and how their team
fits into the organization’s strategy and mission. Participants then learn how
to create a crystal-clear strategy for achieving team goals as they relate to
the organization’s mission and success.
Learning Objectives
Communicate the link between the work of your team to the organizations mission and objectivesCreate an understanding for your team of their jobs and how they link to the organization’s key goalsApply a Resource generator model based on the drivers of your organizationCreate a Team Purpose Statement that will motivate and inspire your team 
 
 
Methodology
Self and team assessmentLectureDiscussionIndividual reflection, paired and group exercises 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Communication',ARRAY['Communication']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146254442.jpg','00070','active'),
('841231342','Closeout of Federal Awards','This course covers the procedures and requirements for closing out federal grants and cooperative agreements. Participants will learn the steps involved in the closeout process, including final reporting requirements, disposition of property, and resolution of outstanding issues.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231342/5816040071.jpg','GGS-GMS-009','active'),
('477769020','Coaching for Development & Career Success (Individual)','Session Description:

Executive coaching has been known to provide employees with several key growth benefits such as heightened self-awareness, increased motivation, and more productive working relationships. This unique offering pairs 8 employees, individually, with a coach for in-person career advisement and a coaching session, on the topics of most relevant and urgent to the client/employee.
Prior to meeting with their coach, employees will need to fill out a brief informational form that will only be shared with their coach and kept confidential.
Contact us to inquire about other formats of individual coaching at learn@gothamculture.com.

Learning Objectives:

Gain perspective on your working style and your impactDevelop an action plan to navigate professional obstacles Better understand how to leverage your strengthsMethodology:
1-1 executive coaching session, 90-minutes eachSessions will be scheduled sequentially over the course of one day, and participants will select from an available time slot for their sessionTarget Audience:

Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Coaching',ARRAY['Coaching']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3143431730.jpg','CL1','inactive'),
('841231297','Coaching for Performance','Equips managers and supervisors with practical coaching skills to support employee development and performance improvement. Topics include coaching models, active listening, feedback delivery, and creating accountability.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231297/5816036228.jpg','GGS-LMT-CFP','active'),
('496280989','Coaching for Top Performance','Coaching is a vehicle for moving people from where they are now to where they need and want to be. Coaching is central to performance management, while developing the climate, environment, and process that empowers individuals and teams to create results. Coaching allows managers to help employees remove barriers to higher levels of performance and job satisfaction, using development opportunities at work.

This workshop covers a step-by-step coaching process, which includes assessing coaching opportunities, documenting performance issues, preparing for and conducting the coaching session, and coaching pitfalls to avoid. The focus is on how to improve employee performance.

Who Should Attend
Mangers, supervisors, and aspiring supervisors, including those looking to assess and improve current coaching skills.

You Will Learn
After this workshop, participants will be able to:

 Identify why managers typically avoid coaching
 Identify the benefits of coaching
 Recognize the characteristics of effective coaches
 Analyze what is influencing unsatisfactory performance
 Assess possible coaching situations to decide whether coaching is worth your time and effort
 Document an employee’s performance and assess the data
 Develop a performance improvement implementation plan
 Get your employee to commit to the improvement plan
 Prepare for and conduct a coaching session
 Use coaching as a method of maintaining employee growth
 Avoid common coaching pitfalls
Course Outline:
Coaching Introductions

 How coaching differs from traditional management
 Benefits and goals of coaching
 Effective coaching characteristics
Coaching Opportunity Assessments

 When to and when not to coach
 Symptoms of performance problems
 Where and how to document performance
 Assessing documented data to identify performance problem’s root causes

Creating a Performance Improvement Plan

 Defining the performance issue
 Identifying desired performance
 Uncovering mutual coach/coachee expectations
 Creating an improvement action plan
 Involving the coachee in the planning process
 Getting coachee buy-in

Up to 30 students

 Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.
 Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.
 A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301036691.jpg','00141','active'),
('479903252','Coaching High-Performers & High-Potentials','Session Description:

High-performers and high-potentials. Every organization has them, but does leadership know who they are, how to identify them, and what their individual development needs are? In this leadership development workshop, participants will consider what competencies exist and are needed among employees who may be ready for increased responsibility or promotion.

Participants will then identify the development experiences and assignments that will enable those employees to stretch and grow. Coaching is key to this process so session participants will develop the lens necessary to coach the high-performers and high-potentials they manage.

Learning Objectives:
Distinguish between high-potential and high-performing talentDiscuss the talent on teams (including capabilities and aspirations)Set the tone and (preliminary) expectations for talent development and movementExpand your coaching skill set to include how to conduct critical career conversationsPractice four types of coaching conversationsMethodology:
Individual ReflectionLecture; Small-Group ExercisesSmall- & Large-Group Discussion
Target Audience:

Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Coaching',ARRAY['Coaching']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3152964773.jpg','CL2','inactive'),
('479761198','Coaching Skills for Leaders','Session Description:

Some individuals are leadership coaches; they are the noun. Others in leadership need to understand how to use coaching skills; they need the verb. This session provides key insights into how leaders can add coaching methodologies to their toolkit to create better employee engagement and performance improvement.
As leaders learn new ways to coach and adopt frameworks to create awareness with those they are leading, they will also personally develop in their leadership approach. 
Learning Objectives:

Understanding the distinctions between leading, coaching, advising, consulting, and mentoringLearning key coaching moves that include questions, assessments, and listeningIdentifying how different stages of adult development require different leader interactionsMethodology:

LectureIndividual activitiesQuestion and answer
Target Audience:

Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'2-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3152888412.jpg','CL3','active'),
('496324398','Collaboration and Connection for Remote Teams','Did you have a cohesive team of talented people before starting to work remotely? If so, how have you sustained those connections? Your team’s connection may be at risk right now. Studies are beginning to reveal that one of the most significant impacts of people working full-time from home involves diminished organizational connections and, therefore, a reduction in social capital. People consistently report feeling disconnected and isolated. Businesses are becoming more siloed than they were pre-pandemic. Because both spontaneous and planned connections happen less frequently when people work remotely, a deliberate strategy can help sustain and enhance team collaboration. Connections to others on their teams, to their organization, and to a bigger purpose must be intentional. Participants in this session will be able to . . .

Define and then develop a connection strategy for their remote teamsExplain the purpose and impact of a team connection strategyPromote collaboration across a remote team or workforceCreate quick wins to jumpstart an employee connection strategy

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300947733.jpg','00134','active'),
('841231298','Communicating with Impact','Develops participants'' ability to communicate clearly and persuasively across organizational levels. Covers verbal and written communication, presentations, difficult conversations, and adapting communication styles.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231298/5816036234.jpg','GGS-LMT-CWI','active'),
('496384772','Communication Essentials','Communication is the transfer of information from one person to another, so that both parties understand each other. The goal is to provide each other with information that enables them to effectively perform their jobs. As both a sender and receiver of information, people communicate critical information, while making fundamental mistakes within each role. This workshop is designed to help participants more effectively and efficiently relay their messages to others and receive messages from others.

Who Should AttendAnyone whose success at work relies on their ability to effectively communicate with others both inside and outside their organizations.
You Will LearnAfter this workshop, participants will be able to:Accept personal responsibility for clarifying assumptions made during conversationsCreate clear communication as both the sender and receiver of a messageUnderstand the typical blocks to effective communicationMake communications supportive, rather than defensiveActively listen to a sender’s message, to more fully understand its meaningSpeak in a way that encourages others to actively listenUse effective communication skills that display and enhance mutual trust and respectCourse Outline:The Communication Process & StylesOverview of the process used to transfer information between two or more peopleUnderstanding your and other’s communication stylesUnderstanding the strengths and weaknesses of each, individual styleHow to communicate with each styleHow to increase your and others’ willingness to adapt to styles different from your ownAssessing communication climatesAssessing nonverbal behaviorsDesigning Clear, Concise MessagesHow to make a conscious effort to design clear messagesHow to communicate with others so that they actively seek to understand your messageEncouraging others to listen with the intent to understandUnderstanding and overcoming communication barriers caused by the sender and by the receiverHow to effectively deal with typical problems within communications, such as people who jump to conclusions, who hear what they want to hear, who respond emotionally, etc.Receiving MessagesHow to actively seek to understand others’ messages, through active listeningHow to minimize defensive communication and maximize supportive communicationHow to take personal responsibility for clarifying assumptions when communicating

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301055789.jpg','00142','active'),
('485676128','CON 091 Contract Fundamentals','Questions? Contact our training coordinator via email or phone at (202) 843.5447.
Course DescriptionGiven an acquisition scenario, the student will determine the contract formation and management principles, as well as the acquisition regulations, applicable to the DoD.

Course ConceptThe first module of the course will be focused on familiarizing the student with using the FAR; Defense Federal Acquisition Regulation Supplement (DFARS); DFARS Procedures, Guidance, and Information (PGI); and DoD Class Deviations, and developing critical skills necessary to locate, interpret, and apply rules. Subsequent modules will focus on the fundamentals of contract formation and management principles, to include the practical application of the FAR/DFARS/DFARS PGI/DoD class deviations to real-world scenarios.

Evaluation (How performance will be assessed)1. Students will be evaluated on the basis of their performance on exams and graded exercises. Students must achieve a final grade of 80% to pass. A breakdown of the evaluation scheme is provided below:

 Assignment
 
 
 Points
 
 

 Exam 1
 
 
 100
 
 

 Exam 2
 
 
 100
 
 

 Exam 3
 
 
 60
 
 

 Options Exercise
 
 
 22
 
 

 Module 5 Capstone
 
 
 98
 
 

 Group Briefing
 
 
 20
 
 

 TOTAL
 
 
 400
 
 

 

 

 
 
 
 
 M
 
 
 
 T
 
 
 
 W
 
 
 
 Th
 
 
 
 F
 
 
 
 
 
 
 
 DAU Classroom Brief
 
 
 
 Deviations from the FAR/DFARS
 
 
 
 Putting it all Together
 
 
 
 Morning:
EXAM #1
 
 
 
 
 
 Intro to CON 091
 
 
 
 Interpreting the FAR
 
 
 
 Practice Exercises
 
 
 
 Afternoon:
Begin Module 2
 
 
 
 
 
 FAR, DFARS, & DFARS PGI Basics, Org. & Arrangement
 
 
 
 Applicability of Rules
 
 
 
 Contract Formation Principles
 
 
 
 
 
 M
 
 
 
 T
 
 
 
 W
 
 
 
 TH
 
 
 
 F
 
 
 
 
 
 Uniform Contract Format Sections A-G
 
 
 
 Morning Scavenger Hunt
 
 
 
 Scavenger Hunt
 
 
 
 Morning:
EXAM #2
 
 
 
 Contract Admin Overview
 
 
 
 
 
 Contract Types
 
 
 
 Afternoon:
Begin Module 4
 
 
 
 Government Property
 
 
 
 
 
 Uniform Contract Format Sections H-M
 
 
 
 Selecting a Contract Type
 
 
 
 Contract Initiation
 
 
 
 Indefinite-Delivery Contracts
 
 
 
 
 
 Small Business Subcontracting Limitations
 
 
 
 Agreements
 
 
 
 
 
 SAP
 
 
 
 Contractor Performance Info
 
 
 
 
 
 M
 
 
 
 T
 
 
 
 W
 
 
 
 TH
 
 
 
 F
 
 
 
 
 
 EXAM #3
 
 
 
 Scavenger Hunt
 
 
 
 Contract Closeout
 
 
 
 Performance Issue Group Briefings (Graded Exercise)
 
 
 
 
 
 
 
 Late Morning:
Begin Module 5
 
 
 
 Contract Changes (cont.)
 
 
 
 Module 5 Capstone (Graded Exercise)
 
 
 
 
 
 Modifications
 
 
 
 Options (Graded Exercise)
 
 
 
 
 
 Contract Changes
 
 
 
 Contract Termination
 
 
 
 Contract Performance Issues
 
 
 
 
 

 Course Length: 13 Class Days
CLPs: 104 hours
 
 Cost: Call
 

 
 
 
 
 
 COURSE OBJECTIVES
 
 
 Module 1:Terminal Learning Objective (TLO):
 

 Determine the applicability of policies and procedures in the FAR, DFARS, DFARS PGI, and DoD CDs.
To achieve this learning objective, students must demonstrate the ability to:
 

 
 
 
 Identify basic background information pertaining to the FAR, DFARS, and DFARS PGI.
 Recognize the organization and arrangement of the FAR, DFARS, and DFARS PGI.
 Given a DoD acquisition scenario, apply information contained in the FAR/DFARS/DFARS PGI/CDs.
 Recall the general policy for authorizing deviation from the FAR and DFARS.
 Apply the conventions for interpreting the FAR.
 Provide a citation to the part, subpart, section, subsection, or paragraph level in the FAR/DFARS/DFARS PGI/CDs to support a position.
 
 
 Module 2:Terminal Learning Objectives:
 
 
 
 Apply the principles of contract formation.
 Given a DoD acquisition scenario, choose the information that would be included in a solicitation or contract.
 
 
 Module 3:Terminal Learning Objectives:
 
 
 
 Differentiate between the types of contracts, and apply the policies and procedures for use in DoD acquisitions.
 Given a DoD acquisition scenario, determine the applicability of the policies and procedures for small business subcontracting.
 Apply the policies and procedures for using simplified acquisition procedures.
 
 
 Module 4: Terminal Learning Objectives:
 
 
 
 Determine the applicability of the policies and procedures for contract administration.
 Differentiate between the types of indefinite-delivery contracts, and determine when they may be used in DoD acquisitions.
 Differentiate between the types of agreements, and determine when they may be used in DoD acquisitions.
 To achieve this learning objective, students must demonstrate the ability to:
 Identify the policies and procedures for the postaward orientation of contractors.
 Recognize the policies and procedures for assigning and performing contract administration.
 Apply the policies and procedures for contractors’ management and use of Government property.
 Interpret the policies and responsibilities for recording and maintaining contractor performance information.
 Identify the characteristics of the three types of indefinite-delivery contracts.
 Recognize the policies and procedures for using multiple-award and single-award IDIQ contracts.
 Recall the policies and procedures for establishing and using indefinite-delivery contracts.
 Interpret the policies and procedures for establishing and using agreements.
 Identify the characteristics of agreements.
 Provide a citation to the part, subpart, section, subsection, or paragraph level in the FAR/DFARS/DFARS PGI/CDs to support a position.
 
 
 Module 5:Terminal Learning Objectives:
 
 
 
 Given a DoD acquisition scenario, determine the applicability of the policies and procedures for preparing and processing contract modifications.
 Given a DoD acquisition scenario, determine the applicability of the policies and procedures
 for terminating DoD contracts.
 Given a DoD acquisition scenario, determine the applicability of the policies and procedures
 for closing out DoD contracts.
 Given a DoD acquisition scenario, execute the process for addressing a contract performance issue.
 
 
 
 
 
 

 
 Contact Joy Smith Stone at jstone@gothamgovernment.com for more information or to schedule this or any of GGS’s other Professional Acquisition and Contracting Training Series courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495453777.png','00002','active'),
('539706632','CON 1100: Contract Foundational Skills','8 Days
Course Description
Explore the numerous skills and competencies required for successful contracting specialist careers. In addition to understanding the acquisition process and general contracting principles, they must be adept at navigating and applying FAR regulations and guidance and developing comprehensive solicitations and contracts. In addition to technical skills, fundamental soft skills and professional skills such as ethics, team membership, communication, and documentation are critical to career development.This course is one of four courses within the Contracting Certification Training Program, based upon specific competencies within the Contracting Training Model. The main objective of this program is to enable contracting specialists to be prepared for a career in the contracting profession.CON 1100 aims to provide participants with both the government and industry perspective regarding key acquisition and contracting skills needed in the profession.Who Takes This Course: This course is designed for entry-level contracting professionals and is the first of four courses preparing participants for the Contracting Certification Exam.Course Format: Individual, small-group, and large-group exercises; lecture, discussion, case study, action planningLearning Objectives:Explain the role of CON 1100 within the DAU Contracting Certification Training programSummarize the DoD contracting processRecognize general DoD contracting conceptsNavigate the DoD contracting doctrine to arrive at an appropriate solutionRecognize the parts of a solicitation and contractDefine the ethical behavior expected of all contracting professionals and their organizations Explain how the collective acquisition team functions together to successfully accomplish the missionRecognize how communication and documentation impact overall contract management effectivenessGiven a situation with lessons learned, apply acquisition life cycle principles to the management of current and future contractsCourse Topics
Introduction
Exercise: Participant IntroductionsContracting Certification Training ProgramExercise: Professional CompetenciesThe Contracting Life Cycle
Key Stages of the Contracting Life CycleSkills and Roles of Contracting Professionals in the Contracting Life CycleBusiness Strategies that Motivate ContractorsContracting Principles
Essential Elements of a ContractExercise: Types of Authority-Discovery and ApplicationExercise Market Research-Discovery and ApplicationExercise: Competition-Discovery and ApplicationExercise: Fair and Reasonable Price-Discovery and ApplicationUnderstanding Regulations
FAR Basics, Organization, and ArrangementDFARS and DFARS PGI Basics, Organization, and ArrangementDeviations from the FAR and DFARSInterpreting the FARDetermining the Applicability of RulesPutting It All TogetherParts of a Solicitation and Contract
Overview of the Uniform Contract Format (UCF)Part I - The SchedulePart II-Contract ClausesPart III-List of Documents, Exhibits, and Other AttachmentsPart IV-Representations and InstructionsSolicitation Provisions and ClausesExercise: Lesson Review-Parts of a Solicitation and ContractGuiding Principles
Exercise: Ethics in ContractingExercise: Team DynamicsExercise: Communication and DocumentationSituational Assessment
Exercise: Situational Assessment, Part 1Exercise: Situational Assessment. Part 2Exercise: Situational Assessment, Part 3Final Assessment
Final Assessment on Student Central 

Credits, Certifications & Certificate Program
 
 CLP Credits:
 64
 CEU Credits:
 5.1
 POU Credits:
 56
 NASBA Field(s) of Study and Credits:
 Finance (64 CPEs) NASBA Level: Basic
 

Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],'8-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3513709851.png','00180','active'),
('539715099','CON 1200: Contract Pre-Award','10 Days
Course Description
Build a foundation in essential contracting skills and competencies, such as general principles related to defining requirements, market research, acquisition planning, and solicitation development. In addition to these foundational skills, you will become familiar with principles from an industry viewpoint, including business development, capture management, and the proposal development process.
This course is one of four courses within the Contracting Certification Training
Program, based upon specific competencies within the Contracting Training Model. The main objective of this program is to enable contracting specialists to be prepared for a career in the contracting profession.
CON 1200 aims to provide participants with both the government and industry perspective within the pre-award process.
Who Takes This Course: This course is designed for entry-level contracting professionals, and is the second of four courses preparing participants for the Contracting Certification Exam.
Course Format: Individual, small-group, and large-group exercises; lecture, discussion, case study, action planning
 Learning Objectives
 
 Explain the role of CON 1200 within the DAU Contracting Certification Training programSummarize the steps required to effectively shape internal customer requirementsSummarize the major elements of performing risk analysis through acquisition planningSummarize contractor strategies and motivations in the competitive processesRecognize effective teaming and joint venture arrangementsRecognize how a contractor executes a sales planSummarize the major components of formulating an acquisition strategySummarize the steps required to effectively shape internal customer requirements Describe a solicitationRecognize how a contractor executes a sales planSummarize the terms and conditions to include in a solicitationGiven a scenario, summarize offer risk mitigation techniquesSummarize the major components of formulating an acquisition strategySummarize the requirements for publicizing solicitations and contract actionsSummarize offer submission processEstimate the need for a solicitation amendmentCourse Topics
Introduction and Overview
Exercise: Participant IntroductionsContracting Certification Training ProgramExercise: Professional CompetenciesDefining, Describing, and Shaping Customer RequirementsExercise: Agency Needs and RequirementsExercise: Market ResearchTypes of Requirements DocumentsProduct and Service Codes (PSC)Understanding Markets and Suppliers
Influence of SuppliersGovernment Impact on ContractorsTeaming Agreements and Strategic AllianceIndustry Considerations When Entering AgreementsAcquisition Planning
Exercise: What Is Acquisition Planning?Exercise: Building an Acquisition PlanExercise: Make-or-Buy ProgramExercise: Justifying Government PropertyExercise: Developing a Delivery ScheduleExecuting a Sales Plan: Business Development and Capture (Industry) 
Developing Market and Sales StrategiesBusiness DevelopmentThe Capture TeamEvaluating an OpportunityComponents of Acquisition Strategy
 Determining Contract TypeIdentifying the Statutory Levels of CompetitionProcurement Methods
Establishing Evaluation CriteriaShaping Internal Customer Requirements
Verifying Availability of Funds: Fiscal Law and AppropriationsMeasurable Outcomes and IncentivesEvaluating a SolicitationTeam Members and RolesExercise: Evaluation TeamSmall Business Act Contracting Requirements
Exercise: Components of Formulating an Acquisition StrategyExecuting a Sales Plan: Solicitation to ProposalSatisfying Solicitation RequirementsElements of a ProposalWriting a ProposalSubcontractorsElements of a Solicitation
Solicitation TypesSolicitation and Procurement MethodsIdentifying Solicitation ElementsExercise: Solicitation Provisions and Contract ClausesTerms and Conditions of a SolicitationSolicitation Provisions and Contract ClausesDetermining Provisions and ClausesInforming Industry: Publicizing Contract ActionsExercise: Summarizing Requirements for Publicizing Solicitations and Contract ActionsThe Proposal: Preparing the Offer
Relationships and CommunicationTypes of Pre-Offer MeetingsQuality Control and ComplianceProposal Risk FactorsOffer Pricing StrategiesColor Team ReviewsApproving an Offer for SubmissionSubmitting and Verifying an Offer Amending the SolicitationExercise: Estimating the Need for a Solicitation AmendmentCourse Capstone
Government Capstone ScenarioIndustry Capstone ScenarioCredits, Certifications & Certificate Program
 CLP Credits:
 80 CEU Credits:
 6.3 POU Credits:
 70NASBA Field(s) of Study and Credits:
Finance (80 CPEs) NASBA Level: Basic
 Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3513736775.png','00181','active'),
('539694454','CON 1300: Contract Award','8 Days
Course Description
Discover the skills and competencies that contracting specialists must acquire and apply throughout their careers. This course addresses skills and competencies most basic and fundamental to the contracting professional specific to contract award, which includes conducting cost or price analysis, planning negotiations, selecting a source, and understanding protests.
 This course is one of four courses within the Contracting Certification Training Program, based upon specific competencies within the Contracting Training
 Model. The main objective of this program is to enable contracting specialists to be prepared for a career in the contracting profession.
 CON 1300 aims to provide participants with both the government and industry perspective within the award process.
 Who Takes This Course: This course is designed for early career contracting professionals, and is the third of four courses preparing participants for the Contracting Certification Exam.
 Course Format: Individual, small-group, and large-group exercises; lecture, discussion, case study, action planning
Learning ObjectivesRecognize key offer elementsSummarize contract risk, including cost, schedule, and performance riskSummarize the proposal analysis techniquesGiven a contractor''s offer, perform price analysisSummarize cost analysis techniquesSummarize cost realism analysis techniquesDocument the proposal analysis resultsGiven the FAR, DFARS, and PGI, summarize the policies and procedures for planning contract negotiationsOutline the process for the initial screening of offersSummarize the process for evaluating offersSelect the negotiation principles applicable to government contractingRecognize actions required for the final award decisionOutline the process for requesting and preparing final offer revisionsSummarize the steps for finalizing the contract awardSummarize the steps to document the outcome of an offerSummarize the aspects of managing disagreements from seller''s perspectiveSummarize the aspects of managing disagreements from buyer''s perspectiveCourse Topics
Introduction
Exercise: Participant IntroductionsContracting Certification Training ProgramOverview of the Course Case StudyPrice or Cost Analysis
Key Offer ElementsContract RiskProposal Analysis TechniquesPrice AnalysisCost AnalysisCost Realism AnalysisResources for Proposal AnalysisDocumenting Proposal Analysis ResultsExercise: Reflection AssignmentExercise: Case Study Part 1: Initial Screening of OffersPlan Negotiations
Clarification RequestsDocument Negotiation Objectives (Buyer and Seller)Conduct NegotiationsSelect Source
Select SourceConduct and Finalize NegotiationsFinal Offer RevisionPrepare Contract Document and Finalize Contract AwardDocument Outcome of OfferExercise: Case Study Part 2: Acceptability DeterminationManage Disagreements
 Submitting Protests: Seller''s PerspectiveResponding to ProtestsCase Study
Exercise: Case Study Part 3-Price Evaluation and Award RecommendationExercise: Case Study Part 4-Postaward DebriefingsExercise: Case Study Part 5-Class BriefingsCredits, Certifications & Certificate Program

 CLP Credits:
64CEU Credits:5.1POU Credits:56 NASBA Field(s) of Study and Credits:
Finance (64 CPEs) NASBA Level: Basic
 Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3513748521.png','00182','active'),
('539706656','CON 1400: Contract Post-Award','7 Days
Course Description
Build a foundation of essential skills and competencies for managing contracts and ensuring contractor performance meets contractual requirements. This course poses challenges such as: How do you administer a contract? How do you handle a contract modification? How do you ensure quality of products and services? What kind of oversight does a subcontractor require? How do you handle disagreements with the contractor? You will examine the duties performed by contracting personnel during the postaward phase of the acquisition process and improve your knowledge and skills in managing contract performance.
 This course is one of four courses within the Contracting Certification Training Program, based upon specific competencies within the Contracting Training Model. The main objective of this program is to enable contracting specialists to be prepared for a career in the contracting profession.
 CON 1400 aims to provide participants with both the government and industry perspective on the management and administration of contracts.
 Who Takes This Course: This course is designed for entry-level contracting professionals, and is the fourth and final course in the series that prepares participants for the Contracting Certification Exam.
 Course Format: Individual, small-group, and large-group exercises; lecture, discussion, case study, action planning
Learning ObjectivesDescribe the contract administration planning and decision-making processesSummarize the characteristics of contract paymentDescribe contract communication mechanisms for contract executionRecognize the fundamental concepts that ensure quality assurance in contract performanceSummarize the aspects of managing subcontracts Summarize the requirements to maximize small business participation through subcontractingSummarize the characteristics of managing changes during contract performanceDescribe contract interpretation and disputesSummarize contract terminationOutline the key elements of managing contract close out for the buyer and sellerSummarize procedures associated with the final disposition of government property as identified in the FAR, DFARS, and Federal Management RegulationRecognize the buyer and sellers'' actions to reconcile the contract for closeoutIdentify the key elements that comprise the Contractor Performance Assessment Reporting System (CPARS) and finalize contractCourse TopicsIntroduction and Overview
 Exercise: Participant IntroductionsContracting Certification Training ProgramExercise: Professional CompetenciesDAU Contracting Subway MapContract Administration
Delegating Contract Administration FunctionsContractor Oversight: Roles and ResponsibilitiesContract Payment: Roles and ResponsibilitiesContract Files and Funds ManagementCommunications: Internal and ExternalManaging Government Property in the Possession of ContractorsExercise: Contractor Cost Information: Post-Award Submission of Cost or Pricing DataQuality Assurance for Post-Award
Exercise: Quality AssuranceSubcontract Management and Small Business Subcontracting
Exercise: Subcontract Management and Small Business SubcontractingManaging Contract Changes
Exercise: Managing ChangesInterpretations, Disputes, and Terminations
Exercise: Contract Interpretations, Disputes, and TerminationsContract Closeout
Exercise: Contract CloseoutCredits, Certifications & Certificate Program
 
 CLP Credits:
 56 CEU Credits:
 4.4 POU Credits:
 49 
 
 NASBA Field(s) of Study and Credits:
 Finance (56 CPEs) NASBA Level: Basic

 Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3513747193.png','00183','active'),
('485584176','CON170 Fundamentals of Cost & Price Analysis','Course DescriptionFundamentals of Cost and Price Analysis (CON 170) is a resident Defense Acquisition Workforce Improvement Act (DAWIA) Level I contracting course for newly hired GS-1102 contracting personnel. This course provides foundational knowledge of contract cost and price analysis. Specifically, the course provides training in applying quantitative tools to accomplish cost and price analysis in accordance with Federal Acquisition Regulations, Defense Federal Acquisition Regulation Supplement (DFARS), the DFARS Procedures, Guidance and Information (PGI), and the Contract Pricing Reference Guide (CPRG).
The course begins with an in-depth review of the Market Research process, and provides instruction to help students understand and analyze contractor pricing strategies. Students will learn to accomplish Cost-Volume-Profit analysis, calculate contribution margin estimates, and develop cost estimating relationships in order to accomplish an effective price analysis pursuant to FAR Subpart 15.4. The course provides an overview regarding the regulations and processes regarding the use of cost analysis, and for requiring certified cost and pricing data. Finally, after learning the basic elements of price and cost analysis, students will build and defend a pre-negotiation objective, including a minimum and maximum pricing objective with a Weighted Guidelines assessment. Students are also provided in-depth instruction on contract financing techniques, including the development and administration of progress payments based on cost and performance based payments. Students will become proficient with the use of the PBP Analysis Tool.
 Course Length: 8 Class Days
CLPs: 76 hoursCost: CallCOURSE OBJECTIVESStudents who successfully complete this AMCI equivalent course will be able to:Demonstrate ability to execute quantitative pricing skills.Given an acquisition situation, successfully distinguish various seller pricing strategies.Describe the Truth in Negotiations Act, including its purpose in mitigating government cost risk.Identify the policies and procedures for applying the Cost Accounting Standards Board (CASB) rules and regulations to negotiated contracts and subcontracts. (FAR Part 30, DFARS Part 230 and 48 CFR 9903.3).Identify the contract cost principles and procedures. (FAR Part 31 and DFARS Part 231).Given a contracting requirement and market research tools, recognize the essential elements of a market research report.Given acquisition situations, determine an appropriate contracting strategy, including the contract type and other incentives.Given a contracting scenario, differentiate among financing arrangements, their order of preference, and the situations for use.Accurately differentiate between price and cost analysis.Pursuant to FAR 15.4, accurately differentiate the price analysis techniques.Given a contracting scenario examine price-related factors.Pursuant to FAR 15.4, accurately perform proposal analysis.Assuming an advisory role in evaluating acquisition proposals, successfully summarize the contractor business systems that must be found compliant for the award and payment of government contracts.Given an acquisition situation, successfully differentiate between direct and indirect costs.Assuming an advisory role in evaluating acquisition proposals, successfully summarize the evaluation of direct material and subcontract costs.Assuming an advisory role in evaluating acquisition proposals, successfully summarize the evaluation of indirect costs.Given a proposal evaluation scenario, demonstrate ability to calculate Facilities Capital Cost of Money (FCCOM).Given a proposal evaluation scenario, demonstrate ability to employ the Weighted Guidelines (WGL) for calculating negotiation profit objectives.Given a scenario, demonstrate ability to complete a Settlement Action relating to Defective Pricing.Use professional negotiation tactics to successfully execute face to face negotiations.Target AudienceNew hires to the Contracting Career Field (Civilian OCC Series 1102).
Required: CON 090, Federal Acquisition Regulation (FAR) Fundamentals (Only required if assigned to the Contracting Career Field); CON 127, Contract Management; CLC 057, Performance Based Payments and Value of Cash Flow CLC 058, Introduction to Contract PricingRecommended: CLC 024,Basic Math Refresher Pre-course Assignments:
The course “welcome message” will provide students with a “math refresher” book and self-assessment test. The purpose of these materials is to enable students to refresh their basic math skills and take a self-test before attending the course. The welcome message will encourage students to take the self-assessment, and consider deferring their attendance in the course if they have difficulty with the math refresher material.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495455025.png','00003','active'),
('485660485','CON 270 Intermediate Cost and Price Analysis','Course DescriptionIntermediate Cost and Price Analysis continues to build upon the fundamental contract pricing principles covered in the Level I Contracting curriculum, Contract Pricing Reference Guide, and DOD Policy. The course is divided into three segments addressing contract pricing issues from a Pre-Award, Negotiation Preparation-Award, and Post-Award perspective. In the course, the students will be introduced to quantitative techniques and tools used to quantify and facilitate decision making in determining a fair and reasonable price. Students will apply various cost analysis techniques and quantitative tools to analyze a contractor’s cost proposal and to develop a government negotiation range and objective. The course is designed to prepare students for follow on DAWIA Level II certification courses, serve as a gateway into more advanced targeted contract pricing courses, and give the students some practical tools in pricing government contracts. The ultimate objective of the course is to help students become better business advisors in developing contract arrangements that are in the best interest of the government.
 Course Length: 10 Class Days
CLPs: 80 hoursCost: CallCOURSE OBJECTIVESStudents who successfully complete this AMCI equivalent course will be able to:Given a contractor’s proposal information, develop an Excel spreadsheet to model a proposalGiven market research and proposed information from offeror(s), using sampling data, select the appropriate statistical information to use in facilitating the decision-making process.Assuming an advisory role in evaluating acquisition proposals, successfully summarize the development, assumptions, application and risk of Cost Estimating Relationships (CERs).Given market research and proposed information from offeror(s), using historical data and regression analysis, select the appropriate statistical information to use in facilitating the decision making-process.Given market research and proposed information from offeror(s), using historical data and estimating factors, select the appropriate statistical information to use in facilitating the decision making-process.Given market research and proposed information from offeror(s), using historical data and improvement curve analysis, select the appropriate statistical information to use in facilitating the decision-making process.Given market research and proposed information from offeror(s), using historical data determine the impact of Variations in QuantityGiven a Point Estimate (contract cost, ceiling price) analyze associated cost risk.Give an acquisition requirement, identify the appropriate incentive contract type arrangement to meet the customer’s needs and that will motivate the contractor to perform in the best interest of the government.Given a contract type in a competitive environment, explain the issues and factors to be considered when performing a cost realism analysis.Given a proposed contract change identify issues and factors to be considered in developing the government’s negotiation objective for a contract equitable adjustmentGiven a contract termination, identify issues and factors to be considered in pricing a termination settlement.Target AudienceContracting series GS1102 and military equivalents with authority to award or administer contracts above the Simplified Acquisition Threshold
Prerequisites
CON 170, Fundamentals of Cost and Price Analysis; CLC 056, Analyzing Contract Costs Introduction to Contract Pricing. CLC 024, Basic Math Tutorial and a basic proficiency in Excel are recommended.Pre-course Assignments
Excel, and applications incorporating Excel functions, will be used extensively in CON270. As a self-assessment of your Excel skills, you will be asked to open the Proposal Modeling Practice document and create a spreadsheet with the problem solution. Afterwards, you will be asked to compare your spreadsheet to the Excel file that demonstrates one approach to the problem.If you are new to Excel, or if you are unfamiliar with the formatting, cell references, and formulas used in the enclosed solution, then you will be asked to select the following hyperlink to access a Microsoft Excel tutorial on creating workbooks. There is an additional link within the tutorial to access separate training on cell references and formulas. There will be graded assessments in the course requiring the use of Excel.http://office.microsoft.com/en-us/excel-help/get-to-know-excel-2007-create-your- first-workbook-RZ010076674.aspx
The exercise (Pre-Course Proposal Modeling Practice.docx) will hopefully encourage you to develop at least a basic level of Excel familiarity and thereby reduce some of the burden on instructors having to remediate students in the classroom.Details will be provided 30 days prior to the class start date.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495453642.png','00004','active'),
('485645659','CON 280 Source Selection and Administration of Service Contracts','Course DescriptionThis course builds on the foundation established through the Level I curriculum and the course prerequisites. The primary focus is on the acquisition of services under FAR Part 15 procedures, with an emphasis on performance-based acquisitions (PBA) for services, contract types, contract incentives, source selection, and contract administration. Students will learn the fundamentals of a performance based service acquisition — from acquisition planning to contract closeout through a realistic case study. The course takes students through the solicitation process using the mandatory DoD Source Selection Procedures. Students will prepare contractual documents, and develop and deliver high-level source selection briefings with recommendations for contract award.
 Course Length: 10 Class Days
CLPs: 97 hoursCost: CallCOURSE OBJECTIVESStudents who successfully complete this AMCI equivalent course will be able to:Given a complex services requirement, identify the appropriate source selection team roles and responsibilities, to include government and non-government advisors.Using the results of market research, assess the industry’s environment and determine availability of sourcesUtilizing the DAU Performance Requirements Roadmap and results of a comprehensive market research generate PBA metrics mirroring best commercial practicesGiven a complex services requirement, determine appropriates methods of communication employed by the acquisition teamGiven a complex services requirement and market research results, decide the appropriate acquisition strategy that maximizes small business participation at the prime and subcontracting levelsUsing the results of an analysis of a given requirement, determine an appropriate performance-based approach that meets the customer’s mission requirementGiven a complex services requirement and using the results of an in-depth market research report, construct relevant elements of an acquisition plan IAW FAR and DFARSGiven a complex services requirements package, examine appropriate sections of a solicitation in accordance with application laws, regulations, policies, acquisition plan and source selection planGiven a complex services requirement, construct a source selection plan that meets all public law, regulations, policy, and other guidelinesGiven a contract requirement, accurately assess the financial implications of various types of contract and incentive arrangementsGiven a complex services requirement, evaluate incentive arrangements, for adherence to regulation, policy and guidanceGiven a complex services acquisition situation, appropriately apply the necessary Government funding provisionsIn a competitive negotiated contracting environment, determine the competitive range based on FAR and other guidanceGiven a complex services acquisition situation evaluate several contractor proposals to determine contract awardAfter establishment of a competitive range, prepare for negotiations/discussions in accordance with FAR and DFARSUsing the standards for contractor responsibility in FAR Part 9.1, discuss the contractor responsibility process prior to contract awardIn a competitive contracting environment and using the DoD source selection procedures, recommend the best value proposal to meet mission requirementBased on the results of the SSEB & SSAC evaluation reports and the SSDD, determine what information to include in debriefings and differentiate between protest processesAfter contract award, determine the appropriate forum to address customer and contractor’s responsibilities for successful performance of the contractAfter contract award, develop contract administration requirements in accordance with FAR and DFARSAfter contract award, perform contract administrative functions in accordance with FAR and DFARSDetermine the need for contract modifications in accordance with contract terms and conditions and FAR and DFARSAfter contract performance is complete, determine contract close-out procedures as they relate to services and the case studyGiven a complex services acquisition, appropriately examine the provisions of the allowable cost and payments provisionGiven a complex services acquisition, appropriately evaluate the provisions of the incentive fee provisionsGiven a complex Contracting issue, develop, on an individual basis, a written research paper to be presented orally to the classTarget AudienceThis course is designed for Level I certified contracting personnel with at least 2 years of contracting experience in the Contracting Career Field (Civilian OCC Series 1102) seeking Level II certification.
Prerequisites
ACQ 101, Fundamentals of Systems Acquisition Management CLC 051, Managing Government Property in the Possession of Contractors CLC 056, Analyzing Contract Costs CLC 057, Performance Based Payments and Value of Cash Flow CON 200, Business Decisions for Contracting CON 216,Legal Considerations in Contracting CON 270, Intermediate Cost and Price Analysis HBS 428, Negotiating
Pre-course Assignments
Students must complete all electronic assignments prior to attending this course. These assignments represent 18 percent of the student’s grade. Details will be provided 30 days prior to the class start date.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495454107.png','00005','active'),
('485660488','CON 290 Contract Administration and Negotiation Techniques in a Supply Environment','Course DescriptionIn this case-based course, students apply Contracting concepts and techniques learned in prerequisite courses to meet customer supply requirements and resolve complex Contracting issues. Special emphasis is placed on applying legal concepts from CON 216, intermediate pricing concepts from CON 270, and negotiation techniques from HBS 428. Students experience the full spectrum of Contracting processes and issues by following a supply requirement through all phases of the acquisition life cycle, from acquisition planning through contract close-out. Research, analysis, and communication skills are honed through development and presentation of a critical thinking project requiring in-depth focus on one area of Contracting. Negotiation skills are sharpened through active student participation in two simulated contract negotiations.
 Course Length: 10 Class Days
CLPs: 96 hoursCost: CallCOURSE OBJECTIVESStudents who successfully complete this AMCI equivalent course will be able to:Given a complex fiscal law issue, and working in a team environment, complete the necessary steps to successfully resolve the issue.Given an agency’s contract requirement and market research data, make an accurate commerciality determination.For a given fact pattern, determine whether to contract without providing for full and open competition.For a given agency requirement and supporting market research data, evaluate a given Justification & Approval (J&A) for FAR Subpart 6.3 compliance.Given an agency requirement, determine whether an undefinitized contract action (UCA) should be used to mitigate contract schedule risk.Given an agency requirement and supporting market research data, select an appropriate contracting method.Given an agency requirement and supporting market research data, select a contract type & incentive structure that motivates contractor performance while mitigating contract risks.Given an agency requirement and contract type, select appropriate type of financing.9 Given an agency requirement and contract type, determine whether contract options should be included in a contract.Identify the major elements and components of a given solicitation.Given a fact pattern, select the appropriate DFARS data rights license.For a given scenario, use cost analysis to evaluate the reasonableness of a contractor’s proposal.Identify basic negotiation techniques recommended for negotiating Government contracts.For a given contractor CPFF completion proposal and related Government audit and technical evaluation documentation, establish a Government pre-negotiation objective.For a given negotiation, conduct fact-finding necessary to prepare for the negotiation scenario.For a given previously developed pre-negotiation objective, orally present the objective to a business clearance official to obtain approval to start negotiations.With a given support team, conduct face-to-face contract negotiations based on an approved pre-negotiation objective.Calculate the point of total assumption (PTA) for a given fixed-price incentive firm (FPIF) contract.For a given fact scenario, determine whether a contractor’s request for performance-based payments should be made.For a given fact scenario, evaluate potential bases for, and Government defenses to, a contractor protest.For a given contract, develop a contract administration plan.For a given contract, conduct a post-award orientation.For a given fact scenario, evaluate available Government remedies for nonconforming goods.For a given fact scenario, determine whether fraud has potentially occurred.For a given fact scenario, determine whether a contemplated contract change can be made using the contract’s Changes Clause.For a given fact scenario, determine what alternatives are available to make a contemplated contract change if the change is not within the scope of the contract.For a given fact scenario, evaluate whether a given contractor request for equitable adjustment proposal is reasonable.For a given scenario, calculate the amount of a contractor’s lost efficiency resulting from a contract change.For a given contractor request for equitable adjustment, conduct face-to-face negotiations to determine the equitable adjustment terms.Given a fact scenario, identify applicable the rules and steps for submitting and processing a contractor claim under the Contract Disputes Act.For a given fact scenario, determine whether defective pricing has occurred.For a given scenario, evaluate the Government termination options and associated settlement methods and procedures available to the Government.Given a set of contract performance facts and Government comments, evaluate contractor performance after contract completion.Given the FPIF elements and relevant cost data, calculate the final price and final profit under an FPIF contract.For a given fact scenario, determine whether all requirements have been met to close out a Government contract.Research new issues and initiatives in DoD contracting,Target AudienceThis course is designed for Intermediate-level contracting personnel who are Level I certified in Contracting and have a minimum of 2 years of contracting experience.
Prerequisites:
ACQ 101, Fundamentals of Systems Acquisition Management CLC 051, Managing Government Property in the Possession of Contractors CLC 056, Analyzing Contract Costs CLC 057, Performance Based Payments and Value of Cash Flow CON 200, Business Decisions for Contracting CON 216,Legal Considerations in Contracting CON 270, Intermediate Cost and Price Analysis HBS 428, Negotiating.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495453657.png','00006','active'),
('485686607','CON 360 Contracting for Decision Makers','Course DescriptionThis course provides the contracting professional the training necessary for the Level III Contracting certification course. Through realistic scenario-based learning, students work individually and in teams to practice developing sound business solutions as a valued strategic and expert business advisor. Students will learn to analyze complex contracting situations with emphasis on critical thinking, problem solving, research, and risk reduction. Student course work is designed to contribute to real solutions on real acquisition problems to senior leadership and local supervisors.
 Course Length: 8 Class Days
CLPs: 85 hoursCost: CallCOURSE OBJECTIVESStudents who successfully complete this AMCI equivalent course will be able to:apply critical thinking skills to a contracting-related problemapply problem solving methods to use in a contracting-related problemapply risk mitigation techniques to use in a contracting-related problemmake a decision on a contracting dilemma that complies with rules of ethics in contractingapply leadership skills to use in a complex contracting issuecontribute in a collaborative environment by providing timely written and verbal feedback to team members and the classsuccessfully identify various methods of motivating and alleviating employee stress for individuals who are dealing with constant change in the contracting work environment.apply an industry and senior Government contracting leader perspective to an assigned contracting policy issuemanage information and knowledge for currency in acquisition and contracting in order to prepare and deliver presentations on current issues in contractingCOURSE OUTLINEWelcome/Introduction to CON 360Team BuildingThe BriefingCritical ThinkingProblem SolvingRisk ManagementLeadershipManaging Change & TransitionHot TopicsCustomer FocusConflict ManagementSenior leadership presentation (SLP) Peer ReviewsEthicsPresentations & Course Wrap UpMethodology:Lecture; Guest speaker presentations; Team discussions and facilitation; Group presentations; Exercises
Target AudienceThis course is designed for Intermediate-level contracting personnel who are Level I certified in Contracting and have a minimum of 2 years of contracting experience.
Prerequisites:
ACQ 101, Fundamentals of Systems Acquisition Management CLC 051, Managing Government Property in the Possession of Contractors CLC 056, Analyzing Contract Costs CLC 057, Performance Based Payments and Value of Cash Flow CON 200, Business Decisions for Contracting CON 216,Legal Considerations in Contracting CON 270, Intermediate Cost and Price Analysis HBS 428, Negotiating.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495457252.png','00007','active'),
('491980836','Conflict Mediation','Session Description
Being able to diffuse conflict is
a vital skill for all professional. For managers, this skill can be taken to
the next level as managers may be called to intervene in conflicts on their
teams.

This course will provide a
step-by-step approach for how to set up and execute a conflict mediation,
leaving managers with the tools they need to move their team out of conflict
and toward productivity and harmony.

Learning Objectives
Setting the stageImpartial supportFive phases of mediation 
 
 
 
Methodology
LectureDiscussion 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managersFront-line staff','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146259319.jpg','00071','active'),
('841231299','Conflict Resolution Skills','Provides government leaders with frameworks and tools for identifying, analyzing, and resolving workplace conflicts constructively. Includes negotiation techniques, mediation principles, and de-escalation strategies.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231299/5816036240.jpg','GGS-LMT-CRS','active'),
('491970146','Confronting Conflict: How to Be Assertive at Work While Saving Relationships','Session Description
Let’s face it, telling someone to
change a behavior isn’t easy, but sometimes we can’t go on
working together the way we have. Being assertive, standing up for yourself and
your needs, we all know it’s important.
This class will provide some
essential skills to express yourself in ways that will deepen relationships
rather than stress them.
Learning Objectives
Understanding the definition of assertive communicationUnderstand the appropriate uses of assertive communicationUnderstanding what gets in the wayEffectively plan conflict conversations 
 
 
 
Methodology
LectureDiscussionTarget Audience
Supervisory to mid-level leadersHigh-potential individual contributorsProject/Program managersFrontline staff','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146256983.jpg','00076','active'),
('496385354','Constructive Conflict Resolution','What’s worse than conflict in the workplace? Ignoring conflict in the workplace. Conflicts are inevitable . . .anger, holding grudges, hurt, and blame are not. Conflict resolution can be a growth opportunity. With the right tools and frame of mind, you often can resolve conflicts in a way that benefits everyone involved. Once people understand conflict and how to more effectively manage it, fear and avoidance can disappear, while personal growth and productivity expand.

This workshop covers more productive conflict resolution techniques, starting with how to identify your own conflict reaction style through creating conflict solutions that all parties can support. The approach calls for conflict to be viewed as a unique problem-solving opportunity, in which a variety of tools can help maintain that focus.
Who Should AttendAnyone interested in self-assessment and improvements in their conflict resolution skills; managers, supervisors, and human resource managers who need to be able to both model and facilitate conflict resolution between others.
You Will LearnAfter this workshop, participants will be able to:Identify what causes interpersonal conflictMake conflict constructive, rather than destructiveUnderstand different conflict reaction stylesExplain when to use each unique conflict styleIdentify when conflict goals are cooperative, rather than competingSearch for a collaborative outcome when in conflictUse an 8-step approach to constructively resolve conflictsDisagree with people who possess more power than youSet conflict resolution ground rulesUse effective communication skills that display and enhance mutual trust and respectGive constructive feedback and respond constructively to others’ feedbackReduce defensiveness and break the defensiveness chainEliminate negative attitudes during conflictsUse your learnings to resolve your own conflicts and to mediate others’ conflictsCourse OutlineConflict AssessmentsWhat causes conflictParticipants self-assess their typical conflict reaction styles and then compare them to the assessments other participants makeHow to identify collaborative outcomes in response to conflictConflict Resolution Communication SkillsHow to actively listen to understandHow to give constructive feedbackConflict Resolution ModelHow to invite someone to discuss what is in conflict between youHow to better understand what each wants and why each wants itHow to identify a mutually beneficial goal, based on identified common groundHow to generate and select among alternatives that might meet the goalTools to Facilitate Problem Solving During ConflictHow to overcome negativity and defensivenessHow to set appropriate ground rules for conflict resolution meetings

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301060154.jpg','00143','active'),
('493014461','Continued Innovation','Session Description
Innovation occurs through culture
and structure. To stay competitive companies need both. This course will
explore methods used by the most innovative companies to drive innovation and
collaboration across organizations.

You will understand how hierarchy
is the enemy of creativity, but structures that foster collaboration can lead
to breakthroughs and new insights.

Learning Objectives
Understanding how innovation works and what hinders itUnderstanding how to foster innovation in your teamsImplementing fail fast strategy to boost learning and growthBuilding an innovation plan 
 
 
 
 
 
 
Methodology
LectureDiscussion 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/program managers Frontline staff','Innovation',ARRAY['Innovation']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146256373.jpg','00098','active'),
('841231284','Contracting Basics for Administrative Professionals','Designed for administrative staff who support the contracting function, this course introduces key federal contracting concepts, terminology, documentation requirements, and ethical obligations.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231284/5816036163.jpg','GGS-CBAP','active'),
('841231285','Contracting for Results','Focuses on performance-based contracting techniques that drive measurable outcomes. Learn how to structure contracts, develop performance work statements, and establish metrics that hold contractors accountable.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231285/5816036174.jpg','GGS-CFR','active'),
('841231286','Contracting for Technical Representatives','Tailored for technical experts who serve as advisors in the contracting process. Topics include supporting source selection evaluations, technical review of deliverables, and communication best practices with contracting officers.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231286/5816036180.jpg','GGS-CTR','active'),
('676076418','Contracting Officer’s Representative (COR) Refresher (3-days)','Questions? Contact our training coordinator via email or phone at (202) 843.5447.

Course DescriptionThe Contracting Officer’s Representative (COR) Refresher training is designed to enhance the knowledge and skills of CORs at Level I, II, and III in accordance with the FAC-COR requirements. This comprehensive course will cover essential topics related to the roles and responsibilities of CORs, emphasizing practical application, compliance, and best practices. Participants will engage in interactive sessions, case studies, and group exercises to refresh their understanding and improve their effectiveness in contract management and oversight.
Course ObjectivesReinforce the fundamental roles and responsibilities of CORs.Update CORs on current regulations, policies, and best practices.Enhance skills in contract management, oversight, and performance monitoring.Improve ability to handle complex contract issues and resolve disputes.Strengthen communication and collaboration with contracting officers and stakeholders.Ensure compliance with ethical standards and procurement regulations.
This training course ensures that CORs at all levels are well-equipped with the latest knowledge and skills to effectively manage and oversee contracts, enhancing their ability to contribute to successful contract outcomes and compliance with federal regulations.

 
 Schedule a class or get more information! Contact Joy Stone at jstone@gothamgovernment.com or Sherelle Abernathy at sabernathy@gothamgovernment.com for more information or to schedule this or any of GGS’s other Professional Acquisition and Contracting Training Series courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],NULL,'00196','active'),
('485703835','COR 222 Contracting Officer''s Representative Course','Course DescriptionThis certified DAU-equivalent course is specifically designed for Contracting Officer’s Representatives (CORs) who are responsible for assuring that contractors are performing the technical portion of their job. COR 222 will provide CORs the breadth of knowledge required to perform their role, including knowledge related to COR roles and responsibilities, as well as fundamentals of contracting regulations, types, phases, and other elements; awareness of ethical, legal, and cultural factors that impact COR responsibilities; and information necessary to effectively evaluate situations, apply knowledge gained, and make correct decisions to carry out COR responsibilities and scenarios found in the contract planning, contract formation and contract administration phases.
 Course Length: 5 Class Days
CLPs: 40 hoursCost: CallCOURSE OBJECTIVESStudents who successfully complete this AMCI equivalent course will be able to:Recognize the duties, limitations and authority of the COR.Identify key laws and regulations that address fraud, waste and abuse and ethical considerations in federal contractingRecognize COR responsibilities in acquisition mission support planningRecognize the COR responsibilities in the contract award processRecognize the COR’s role in tracking contract expendituresRecognize the COR’s role in tracking the contract scheduleEvaluate proposed changes under the contract so that the best interests of the government are protectedRecognize the importance of the COR as a representative of the Contracting Officer during performance of the contractReview technical submittals to ensure compliance with statement of work and contract objectivesDescribe the COR’s responsibilities in inspecting and accepting goods and services.Given a contract action, identify the delegated technical functions for which the COR is responsible.Describe the administrative duties of the COR as outlined in the delegation letter.Identify the unique characteristics of a construction contract.Identify the unique characteristics of contracts in major systems and R&D acquisitions.Methodology:Limited lecture/facilitated discussion; Research FAR and web sources; Reading assignments; Interactive activities; Case studies; Exercises; Homework** assignments
**The method of instruction used in FCN 190 is based on the Thayer method. The Thayer method is unique in that it requires students to teach themselves the material prior to class (as homework) and the instructor’s role is to explain the material in class if there are any questions. Further, students are held accountable for their learning by being assessed on a daily basis.
Target AudienceThis course is designed for anyone currently serving as or training to become a Contracting Officer’s Representative.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495449974.png','00008','active'),
('632683455','COR 222: Contracting Officer''s Representative Course','Contracting Officer''s Representative Course (COR 222)
No. of days: 5/CLPs: 36 hours 
This certified DAU-equivalent course is specifically designed for Contracting Officer''s Representatives (CORs) who are responsible for assuring that contractors are performing the technical portion of their job. COR 222 will provide CORs the breadth of knowledge required to perform their role, including knowledge related to COR roles and responsibilities, as well as fundamentals of contracting regulations, types, phases, and other elements; awareness of ethical, legal, and cultural factors that impact COR responsibilities; and information necessary to effectively evaluate situations, apply knowledge gained, and make correct decisions to carry out COR responsibilities. 
Learning Objectives: 
1.Recognize the duties, limitations and authority of the COR.
2.Identify key laws and regulations that address fraud, waste and abuse and ethical considerations infederal contracting
3.Recognize COR responsibilities in acquisition mission support planning
4.Recognize the COR responsibilities in the contract award process
5.Recognize the COR’s role in tracking contract expenditures
6.Recognize the COR’s role in tracking the contract schedule
7.Evaluate proposed changes under the contract so that the best interests of the government areprotected
8.Recognize the importance of the COR as a representative of the Contracting Officer duringperformance of the contract
9.Review technical submittals to ensure compliance with statement of work and contract objectives
10.Describe the COR’s responsibilities in inspecting and accepting goods and services.
11.Given a contract action, identify the delegated technical functions for which the COR is responsible.
12.Describe the administrative duties of the COR as outlined in the delegation letter.
13.Identify the unique characteristics of a construction contract.
14.Identify the unique characteristics of contracts in major systems and R&D acquisitions.
2 
Course Outline: DAY 1 
•Course Overview & Introductions
•Lesson 1. What is a COR?
Who Has the Authority?
•Lesson 2. What Do I Need to Know about Ethics and Integrity?
Ethical Case Studies
•Lesson 3. How Do I contribute to Planning the Acquisition?
Loose Lips Sink Ships Case
DAY 2 
•Lesson 4. How Am I Involved in Awarding the Contract?
Finding Base Support Case
•Lesson 5. What’s In My Contract?
Uniform Contract Format Knowledge Check
•Lesson 6. What If I Need to Modify the Contract?
Taking the Plunge
DAY 3 
•Lesson 7. What If the Contract is Changed by Mistake?
Money for Wafers
It’s a Calamity
•Lesson 8. What Can I Say and What Should I Document?
Is It Knight or Day? Case
•Lesson 9. How Do I Monitor Performance?
The Grass Isn’t Greener Case
DAY 4 
•Lesson 10. How Do I Handle Issues with a Contractor?
Terminations Knowledge Check
•Lesson 11. Are There Special Considerations for Service Contracts?
Smoothing Over the Situation Case
•Lesson 12. Are There Special Considerations for Construction Contracts?
Galley
•Test Review
DAY 5 
•Lesson 13. Are There Special Considerations for R&D Contracts?
Test Assessment
Course Evaluation','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4147235006.png','00192','inactive'),
('841231279','COR Level I','This course covers the fundamental responsibilities of a Contracting Officer''s Representative (COR), including acquisition planning, market research, statement of work development, and contract administration basics. Designed for new CORs or those seeking to refresh their foundational knowledge.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231279/5816036139.jpg','GGS-COR1','active'),
('632761523','COR Level I: Contracting Officer Representative (COR) Training','Contracting Officer Representative (COR) Training
Course Length: 3 days (24 CLPs) 
Course Purpose 
This COR certification course focuses on the newest directions of government acquisition including performance-based contracts, risk management, quality assessment plans and effective contract administration for results-oriented contracts. Participants will be provided with the required information necessary for most DOD and federal civilian agency certifications. More importantly, participants will gain an understanding of the statutory and procedural requirements, the acquisition process and their role, determination of appropriate contract types, and the process for performance evaluations. Material presented is in accordance with the administrator of OFPP''s memorandum addressing the requirements for federal acquisition certification for CORs. 
Target Audience 
All members of the Integrated Acquisition Team responsible for oversight of, and reporting on, contractor’s performance. 
Course Objectives 
• Ensure that non-contracting personnel (excluding the GS-1100 series) assigned duties as Contracting Officer’s Representatives (CORs), Task Administrator, Cognizant Technical Officer (CTO), Quality Assurance Evaluator (QAE), or other contractor oversight positions are fully aware of their specific responsibilities. 
• Provide the required training on responsibilities and limitations of authority for these personnel in headquarters and field activities. 
• Inform engineering/technical personnel of the complex and challenging responsibilities of contracting personnel (GS-1100 series) in carrying out the “law of the land” as embodied in the Federal Acquisition Regulation (FAR). 
• Provide non-contracting personnel a basic understanding of the statutory and procedural requirements of the FAR. 
• Emphasize the importance of teamwork between the technical/engineering community and the contracting community in order to effectively conduct the contracting process. 
• Raise the level of awareness among non-contracting personnel regarding their value and importance in the contracting process. 
Course Outline 
Overview of the Federal Government Acquisition Process 
Legislation, Regulations and Policies 
Understanding Federal Government Contracts and Contracting 
The Contracting Officer and the COR – Legal and Ethical Roles 
Duties and Responsibilities of the COR in Prescriptive and Performance-Based Environments 
Delinquencies and Disputes 
Contract Financial Management 
Contract Close-Out','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/632761523/4147235011.png','00191','active'),
('841231280','COR Level II','Building on COR Level I, this course deepens expertise in contract oversight, performance-based acquisitions, contractor surveillance, and documentation requirements. Ideal for CORs managing complex or high-value contracts.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231280/5816036138.jpg','GGS-COR2','active'),
('841231281','COR Level III','Advanced course for experienced CORs managing large, complex acquisitions. Topics include advanced surveillance techniques, contractor performance evaluation, dispute resolution, and strategic acquisition planning.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231281/5816036140.jpg','GGS-COR3','active'),
('632706669','COR Refresher (1 Day): Contracting Officer Representative (COR) Refresher','Contracting Officer Representative
(COR) Refresher 
Course Length: 1 day 
Classroom Hours: 8 CLPs
Course Purpose 
This “refresher” course provides the most current insight for enhancing functional knowledge and technical performance for the Contracting Officer’s Representative (COR), Task Administrator, Cognizant Technical Officer (CTO), Quality Assurance Evaluator (QAE), or other contractor oversight positions. The course presents and discusses new laws and regulations, as well as recent General Accounting Office (GAO) and Inspector General (IG) cases that pertain to the federal government oversight process. In addition, this course reemphasizes procurement integrity and ethics issues as a key ingredient to effective performance. 
Background 
The course starts with a refresher “quiz” on hot topics and current contract management issues. Participants and the instructor discuss real-life scenarios and ever-changing challenges for the COR. This course encourages interactive exchanges of information to enhance knowledge by sharing experiences and forming networks for the future. 
Target Audience 
All federal government CORs, or similar professionals that desire to stay current in their contract administration function and/or must complete a refresher course every two years to maintain their current certification. 
Course Objectives 
•Refresh the COR with:New laws and regulationsEmerging initiatives in contractor oversightRecent trends in acquisition•Emphasize the importance of teamwork between the technical/engineering and the contractingcommunities for effectively conducting the contracting process•Raise the level of awareness of non-contracting personnel to their value and importance in the contractingprocess•Reinforce the different responsibilities of the Contracting Officer and the COR
Course Outline 
•Re-Examination of the Federal Government Acquisition Process
•An Update and Review of Current Legislation Regulations and Policies
•Another Look at Federal Government Contracts and Contracting
•Discussion of Performance Experiences from View of the Contracting Officer and the COR
•Identification of Current Duties and Responsibilities of the COR and Potential Changes that May ImpactPerformance
•Administration Experiences including Delinquencies and Disputes
•A Refresh of COR’s Role in Tracking Contract Funding
•Highlights for the Current Emphasis on Effective and Timely Contract Close-out','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4147226630.png','00193','active'),
('632706647','COR Refresher (5 Days): Contracting Officer Representative (COR) Refresher/Recertification','Contracting Officer Representative (COR)
Refresher/Recertification 
Course Length: 5 days Classroom Hours: 40 CLPs 
Course Purpose 
The 5-day COR Refresher/Recertification course takes a deeper dive into the challenges and changes facing the COR. While providing the most current insight for enhancing functional knowledge and technical performance for the Contracting Officer’s Representative (COR), Task Administrator, Cognizant Technical Officer (CTO), Quality Assurance Evaluator (QAE), or other contractor oversight positions, the course presents and discusses new laws and regulations in-depth, as well as recent General Accounting Office (GAO) and Inspector General (IG) cases that pertain to the federal government oversight process. Again, procurement integrity and ethics issues are a key ingredient to effective performance. 
Background 
The course starts with a refresher “quiz” on hot topics and current contract management issues. Participants and the instructor discuss real-life scenarios and ever-changing challenges for the COR. This course encourages interactive exchanges of information to enhance knowledge by sharing experiences and forming networks for the future. 
Target Audience 
All federal government CORs, or similar professionals that desire to stay current in their contract administration function and/or must complete a refresher/recertification course every two years to maintain their current certification. 
Course Objectives 
• Refresh the COR with:  New laws and regulations 
• Emerging initiatives in contractor oversight 
• Recent trends in acquisition 
• Emphasize the importance of teamwork between the technical/engineering and the contracting communities for effectively conducting the contracting process 
• Raise the level of awareness of non-contracting personnel to their value and importance in the contracting process 
• Reinforce the different responsibilities of the Contracting Officer and the COR 
Course Outline 
• Re-Examination of the Federal Government Acquisition Process 
• An Update and Review of Current Legislation Regulations and Policies 
• Another Look at Federal Government Contracts and Contracting 
• Discussion of Performance Experiences from View of the Contracting Officer and the COR 
• Identification of Current Duties and Responsibilities of the COR and Potential Changes that May Impact Performance 
• Administration Experiences including Delinquencies and Disputes 
• A Refresh of COR’s Role in Tracking Contract Funding 
• Highlights for the Current Emphasis on Effective and Timely Contract Close-out','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4147235016.png','00190','active'),
('490664416','Creating High Performing Teams','Session Description:

Teamwork is essential to
organizational success, but performance can suffer if teams aren’t aware of how
they work together and what behaviors are essential for successful
collaboration. 
Designed for teams, this 2 day
program will dig deep into where a team is on the key elements of trust,
accountability & ownership. Participants will learn strategies for better
communication, goal alignment, conflict resolution & empowerment.

The program draws on both DISC Behavioral
Styles & Lencioni’s research on team working and will build to create a
personalized action plan for the team & its members, that puts them in the
driving seat of their own success. 

Learning Objectives:
Increase awareness of the significance of
effective collaborative environment and utilizing the authentic strengths of
the team members for the success of the team/departmentUnderstanding and appreciating the
strengths of the self and othersSeeking to create diversified teams for
successMethodology:
Using MRG IDI Teams or Gallup Strengthsfinder to create a team’s strength profileDiscuss the highlights of the measurement
tool with the team in a lecture style and explore one examplePartner up the participants to study each
other’s profile and then share in a group settingHave a group learning and insight
discussionCreate a strategy to walk away from the
session on how to utilize team’s strengths moving forwardTarget Audience:

Leaders at all levelsHigh-potential individual contributorsProject Program Managers','Leading Teams',ARRAY['Leading Teams']::text[],'2-Day',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146253167.jpg','00049','active'),
('490660665','Creating Psychological Safety in the Workplace','Session Description:

This course is going to help you
manage image risks, form a different perspective to interpersonal risk and
failure and build a balance between avoiding interpersonal risks and being
overly risk-taking. Overall, the course is aimed at fostering psychological
safety through engaging in effective learning behaviors that create a working environment
conducive of taking interpersonal risks. 

There are four different drivers
of psychological safety. Drawing on the results of the survey, the driver
attitude to risk and failure had the lowest average score (5.4/7), meaning that
on average the employees somewhat agree with feeling safe when taking a risk on
their team. Since each driver of psychological safety is crucial for building
high-performing teams, it is critical that the employees build a constructive
attitude to risk and failure and find a balance between taking a
well-intentioned risk and not being overly risk-taking.

Learning Objectives:
Explain what psychological safety is and why it is crucialAsk questions or for information without being afraid of being seen ignorant or intrusiveAdmit mistakes and ask for help without feeling incompetentReflect critically on current and past performance, accept negative and/or constructive feedbackPropose new ideas without having a fear of being hurt, criticized, or embarrassed 
Methodology:
LectureInteractive discussionTarget Audience:

Leaders at all levelsHigh-potential individual contributorsProject/Program Managers','Leading Teams',ARRAY['Leading Teams']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146251491.jpg','00050','active'),
('841231300','Critical Thinking and Decision Making','Builds analytical thinking skills for government professionals facing complex decisions. Covers cognitive biases, structured decision-making frameworks, risk assessment, and strategies for leading through ambiguity.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231300/5816036246.jpg','GGS-LMT-CTDM','active'),
('502076318','Critical Thinking & Problem Solving','How often do you think about how you think? Critical thinking helps people make decisions, take action, and develop beliefs based on rigorous and skillful use of information, experiences, observations, and logic. Critical thinking provides people with a competitive advantage. The combination of critical thinking and problem-solving skills allow people to continuously improve their work processes and eliminate stumbling blocks to their performance and satisfaction at work. The tools covered in this workshop can help both teams and individuals to overcome barriers to critical thinking and creativity, visualize a process, pinpoint problems, find their causes, and determine the necessary solutions. Participants will learn how to think before they think, to be able to choose the best tools and techniques for each situation.

Course Objectives: Participants who successfully complete this course will be able to:
Define critical thinking and its workplace valueIdentify situations where critical thinking is neededStrike a balance between open-mindedness and skepticismQuestion their steps in their thinking processConsider the necessary factsTest their assumptions and avoid biased judgmentAsk meaningful and relevant questionsFollow a critical thinking processView a situation from 6 different perspectivesGenerate more creative ideasCreate and then focus a team on a specific, shared problem definitionIdentify and organize the root causes of your problemsUse information to determine the frequency and impact of your problem’s root causesIdentify creative problem solutions and action plansStrategically plan for how you will roll out your solution, planning for both helping and hindering forcesEmploy a variety of specific, hands-on techniques, designed to change your perspective and subsequently generate new ideas, solution sets, and unique insights on purposeCourse Outline:
Critical Thinking ToolsThe Ladder of Inference – overcoming or minimizing cognitive biasFour Steps for Critiquing Your ThinkingAvoiding Group ThinkThe Stepladder Technique – involving others’ input when assessing situations6 Thinking Hats – looking at a situation from 6 different perspectivesCritical Thinking MindsetHow to be open-mindedHow to be well-informedHow to not jump to conclusionsBarriers to CreativityWhat typically hinders creativityHow individuals or teams can generate and assess critical pieces of information essential to making the right decisions throughout the problem-solving processHow to balance perspectives rooted in emotions, logic, improvement opportunities, critical thinking, and creativity, when making decisionsGenerating & Prioritizing Problem StatementsHow to generate a list of potential problems to tackleHow to prioritize the problem listHow to create a problem statement that clearly defines the problem, in a manageable wayHow to be sure all team members share a common problem definitionIdentifying Root CausesHow to assess data and information to better understand why a problem existsIdentifying Solutions & Action PlansHow to create unique, on-target solutions that address the identified root causesHow to create the action plans necessary to solve the problemHow to generate recommendations for implementation of solutions using Force Field Analysis

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'3-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300948460.jpg','00174','active'),
('496384598','Cultural Intelligence: Working within or Managing a Multi-Cultural Team','“We are sun and moon, dear friend; we are sea and land. It is not our purpose to become each other; it is to recognize each other, to learn to see the other and honor him [her] for what [she] he is: each the other’s opposite and complement.” -- Hermann Hesse (1877-1962), German poet and novelist
The business world has changed drastically over the past decade. Both globalization and a more diverse workforce have had dramatic and positive effects on how much organizational and individual cultural values play a role in business success and team member engagement. Cultural Intelligence (CQ) is the capability to relate and work effectively in culturally diverse situations. While awareness is the first step, a culturally intelligent individual also can effectively work and relate with people and projects across different cultural contexts. Team and organizational diversity themselves do not lead to better business solutions. Engaging your team to develop their cultural competency can help leverage these critical individual differences to design better business solutions and more truly inclusive working environments.

Any successful organizational culture involves high-performing teams which recognize the simple fact that people want to belong. They want to feel valued and respected for who they are and be part of a team that enables them to learn and grow. Cultural intelligence provides a pragmatic strategy and skill set for how to relate and work across cultural differences at home and abroad, whether in person or online. The culturally intelligent person who understands global and domestic diversity can work more effectively with peers, coworkers, and customers with different international backgrounds and from different generations, ethnicities, functions, organizations, regions, and more.

Who Should AttendAnyone working in or managing a culturally diverse team; individuals whose organizations have an international presence or have culturally diverse customers or business partners; Human Resources professionals who serve as internal consultants or mediators of workplace conflict. This workshop equips formal and informal leaders to improve CQ in themselves and those whom they manage or with whom they work.
What You Will LearnAfter this workshop, participants will be able to:Apply strategies for working successfully within diverse teamsDevelop deeper insight into different working stylesDemonstrate and explain their drive or motivation to learn about different culturesIncrease their knowledge about how culture in general can shape behaviors, values, and beliefsDraw upon research findings to make robust, culturally sensitive plans for team interactionsEngage with others in a culturally respectful way, including being able to think on their feet in difficult situationsExplain the relevance of cultural intelligence to their personal and team successMore effectively work across domestic and international differences

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301055806.jpg','00144','inactive'),
('523104607','Culture Mosaic Introductory Package (Limited Time)','Your organization may be struggling with challenges and performance issues and no one is sure why. 
Achieving and sustaining a high level of performance is dependent on a variety of key behaviors across an organization. 
gothamCulture''s proprietary Culture Mosaic Survey is comprised of four dimensions of organizational culture and climate that impact performance: Inspire, Deliver, Enable, and Adapt. This survey can help clarify strengths and weaknesses within an organization and provide actionable data to make lasting change. 
Purchase our limited time Introductory Culture Mosaic Survey Package and receive: 
One Culture Mosaic survey link for up to 300 employees. Link will be active for two weeks from deployment date. Survey demographic data will include: Role, Gender, Ethnicity, Education, Age, and Tenure.

One sample employee communication with survey link embedded. 
One custom report detailing survey results.

1-hour leadership debrief via phone or video call.

Click here for more information about the Culture Mosaic.
Click here to view a sample Culture Mosaic report.
Is your organization looking for a more customized and comprehensive assessment? Contact us to schedule a meeting with a team member to discuss your options.',NULL,ARRAY[]::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3426522974.jpg','00179','active'),
('490653684','Culture, Motivation, and Performance 101: Investing in Your Team','Session Description:

Whether you’re building a team
from scratch or inheriting season veterans, nothing is more important than
developing a strong, collaborate culture built on trust and accountability. We
will talk about how to get your team motivated, inspired, and excited to work
together. 

Uncover your shared values and
build the group dynamics that will take your performance to the next level.

Learning Objectives:
Extrinsic and intrinsic motivation - What
levers can you pull?Create culture through shared valuesUnderstand demotivatorsCreate individual and team motivation
plansMethodology:
LectureDiscussionTarget Audience:

Leaders at all levelsHigh-potential individual contributors','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146267718.jpg','00051','active'),
('490714789','Culture, Motivation, and Performance 201: Advanced Team Performance and Culture Development','Session Description:

Any leader worth her salt knows
that team culture is the engine that drives performance. Holding team members
accountable only works if the team culture is aligned with individual values.

This course takes a deep dive
into how to co-create team culture based on shared values and team input. You
and your team will begin to see yourselves in each other and the work you
produce.

Learning Objectives:
Access and identify shared valuesCo-create group rewardsUse the soft power of influence to
motivate through challenge and build trustMethodology:
LectureDiscussionTarget Audience:

Mid- to senior-level leaders','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146268746.jpg','00052','active'),
('502068846','Customer Service – Level 1: The ROI: Relationships, Outcomes, Improvements','Day 1: A Winning Attitude

After completing this workshop module, participants will be able to:List the benefits of delivering exceptional customer service to workshop participants, to their departments, to the overall organization, and of course to the customersAssess the abilities that they must communicate a positive attitude as a customer service providerIdentify different types of attitudes, both the negative and the positiveDescribe the barriers to positive attitudes and how to minimize or remove these barriers from participants’ mindsetsList the ingredients necessary to develop and maintain a positive attitudeAdopt a customer-first mindsetExplain their individual customer service “brand” – what level of service each participant would like to offer and what they would like customers to say about themIdentify actions to make their personal brands happen (participant will turn these into learning objectives for the subsequent workshop sessions)Avoid letting personal assumptions or stereotypes get in the way of treating each customer with respect and treating each customer like an individualDay 2: A Commitment to the CustomerAfter completing this workshop module, participants will be able to:Identify the key indicators of a service cultureIdentify the characteristics of excellent servicAssess current strengths and challenges of customer service in their organizationExplain their personal customer service purposeTake personal responsibility for customer satisfactionDetermine and clarify customers’ expectationsAnticipate and understand customers’ needsIdentifying how knowing customers’ needs would help participants’ work easierBuild strong partnerships with internal and external customers with 10 Building BlocksTreat customers the way participants would want to be treatedDay 3: Exceptional Communication with CustomersAfter completing this workshop module, participants will be able to:Understand the relationship between effective communication and quality serviceDescribe the 6-step process for effective communication, what can go wrong, and how to make it go rightManage the first impressions that they create in customers’ mindsRecognize the most common verbal dangersPractice improving clarity of speechIdentify words or phrases that are commonly mispronouncedCreate a personal action plan for better grammar, enunciation, and pronunciationAssess personal communication stylesCreate a positive communication climate with customer interactionsUse effective, courteous communication to deliver excellent customer serviceSelect appropriate words and phrases when responding to customersAssess personal active listening skillsIdentify the habits of poor listenersPractice excellent listening techniques when gathering customer information and dataEffectively communicate with customers over the telephoneIdentifying telephone benefits, pitfalls, and customer annoyancesCreate telephone guidelines for superior serviceHow to handle call holds and transfers with appropriate telephone etiquetteInterpret telephone and face-to-face nonverbal communicationDemonstrate a step-by-step process for managing each service interactionDay 4: Creative Problem-Solving TechniquesAfter completing this workshop module, participants will be able to:Describe the common barriers to problem solving creativityDemonstrate greater creativity when thinking about solutions to internal and external customers’ problemsRecognize individual assumptions that limit thinkingMore clearly see problems from six thinking perspectives that easily combines and thoroughly examines logic, emotions, positive and negative information, creativity, and structureAssess personal problem-solving stylesCreate a problem statement that clearly defines the problem, in a manageable wayIdentify a problem’s root cause, to better understand why a problem existsHow to create unique, on-target solutions that address the identified root causesHow to create the action plans necessary to solve the problemDevelop a personal action plan to improve problem solvingDay 5: Confidence Through Customer CommunicationsAfter completing this workshop module, participants will be able to:Describe the differences between assertiveness and aggressivenessAssess personal assertiveness and develop a way to increase assertivenessDetermine why someone might resist their influence attempt and how to address that resistanceDesign a strategy for dealing with resistance, based on an understanding of its root causesHow to facilitate openness and understanding of the customerTailor their communication skills to the customer’s preferences (to be able to “speak their language”)Use PowerTalk to demonstrate clear, confident, assertive messages to customersDeliver constructive feedback to customers, in response to both positive and negative situationsHow to openly receive feedback from customersDay 6: Constructive Conflict ResolutionAfter completing this workshop module, participants will be able to:Identify the causes of customer conflictDescribe the 5 styles of responding to conflict, as well as their personal preferred stylesTurn each style into a more productive problem-solving situationMake conflict constructive, rather than destructiveDescribe their personal “hot buttons” and how to exhibit control over personal emotions during difficult interactionsUse an 8-step approach to constructively resolve conflictsDetermine the necessary conflict resolution ground rulesReduce defensiveness and break the defensiveness chainHow to invite someone to discuss what is in conflict between youHow to better understand what each wants and why each wants itHow to identify a mutually beneficial goal, based on identified common groundHow to generate and select among alternatives that might meet the goalDay 7: Working with Upset CustomersAfter completing this workshop module, participants will be able to:Assess their personal attitudes while dealing with difficult Moments of TruthUse a step-by-step strategy for working with others’ difficult attitudesPositive self-talk and the role it can playPractice multiple non-threatening questioning techniques when working with customersUse their empathy skills to demonstrate their understanding of customers’ needs and requestsMore confidently respond to upset customersDiffuse an angry customerMore effectively handle customer complaintsEffectively communicate what they can and cannot do for the customer, while maintaining appropriate flexibilityLearning how to say “no” and “yes, but” to customersHow to facilitate Service Recovery on the spot, for customers when things have gone “wrong”Calm angry customers before they can start spreading a “bad review” through word-of-mouthWin back unhappy customers without overpromisingDay 8: Exceeding Customer Expectations & Surviving the Job Stress That Can ResultAfter completing this workshop module, participants will be able to explain how the previous 7 workshop sessions can help them to:Exceed customers’ expectationsList critical elements (knowledge, skills, abilities) necessary to provide customer service excellenceIdentify the key principles for excellent customer serviceApply these key principles/tools to various customer service case studiesApply these key principles to creating personal vision for excellent customer serviceApply these key principles to managing their personal job stress

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'8-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3320606594.jpg','00177','active'),
('502069070','Customer Service – Level 2','The following series of workshops is designed to take customer service and the people who demonstrate their commitment, to the next level….the level of customer care. These workshops build on the foundations established within Level 1 training.

Day 1: What Do My Customers Think of Me: Asking for Customers’ FeedbackAfter completing this workshop module, participants will be able to:Define the difference between customer service and customer careIdentify different ways of following up with customers after a customer interactionIdentify different ways of staying in touch with customers both before and after customer interactionsFollow through by soliciting customers’ opinionsFollow through by opening lines of communication with citizens and then keeping them OPENFollow through by checking with customers to be sure their needs were met and by soliciting their feedbackHow to convince my boss that I should time doing these customer service things – they are time consumingHelp customers to understand the value of the service that they have receivedExplain how customer care can contribute to their organization becoming a “beloved county,” that delivers what customers desireDetermine their individual personal customer care brandDescribe what level of customer service they would like to offer to take better care of their customers and what they would like customers to say about themAssess what their customers think of them, to determine where they are now and where they need to beIdentify their personal customer care gapsPlay to their strengths in taking care of customersPlan actions that they can take now to enhance their customer care, without authority from managementConsider actions or recommendations that would improve customer care performance, which require management approval or interdepartmental cooperationDescribe their personal customer care bookends – how to create a purposeful beginning and ending to moments of customer contactDay 2: Developing Your Organization’s Reputation: It’s All About Customer TrustAfter completing this workshop module, participants will be able to:Determine how they can really connect with and engage their customers and make them feel valuedDemonstrate how to make customers see participants’ gratitudeExplain the 8 trust mythsDo something about building their personal credibility in customers’ eyes, through participants’ actionsBuild 13 customer care behaviors into their daily routines to build relationship trust with customersExplain how to restore customer trust when it is lostUnderstand how organizations can manage their reputation and what role participants can play in that processUnderstand how organizations can build their word-of-mouth reputation and what role participants can play in that processExplain the 9 biggest reputation mistakesExplain how to fix bad reviews of their organization’s serviceDay 3: The Importance of Customer Loyalty: Leading LoyaltyAfter completing this workshop module, participants will be able to:Explain what customer loyalty means and why they and their organization should care about itExplain how to increase customer loyalty and what they can do to facilitate the loyaltyConnect customer loyalty with participant morale and motivation at workConnect customer loyalty to emotional intelligenceIdentify actions that participants will take to improve their own emotional intelligenceRecognize their personal gratitude towards customers and the participants’ role in customer careHelp to fix bad customer reviews of their organization’s level of customer careAvoid loyalty killersExplain the role of ethics in customer careBuild ethical principles into their daily routine for customer careDay 4: The Nature of Persuasion: Looking Out for the Customer’s Best InterestAfter completing this workshop module, participants will be able to:Help customers see that participants are responding to their requirements or needsThink of themselves as “salespeople”Take care of customer needs that customers might not realize they have or might not realize can be accomplished by participants’ organization, through employee recommendationsState the most frequent situations in which participants must persuade customers to consider recommended options and list the factors of importance to themGenerate open questions which enable customers to determine the benefits of the recommendationsMake their recommendations to their customers attractive to the customerDay 5: The Importance of Teamwork in Customer CareAfter completing this workshop module, participants will be able to:Recognize the importance of teamwork in customer careAnalyze their current team situation, in relationship to customer carePlan improvements that they wish to make to their team, to take better care of customersIdentify customer service chains and state ways in which customer care can be improved internallyRecognize systems and processes that are unfriendly to customers and identify ways of improving theseDay 6: Keeping the Pot Boiling: Making Customer Care A Way of Life in Your AreaAfter completing this workshop module, participants will be able to:Help ensure that the psychology behind customer care permeates the organizationFostering initiative from everyone they canGet others around them to implement excellent customer service practicesBuilding enthusiasm and pride in the job, the level of customer care, and the organizationSpecify what they will do to ensure that customer care becomes a way of life in the areas for which they are responsibleAppreciate the need, and their own individual responsibility, for generating 1% of organizational improvements in customer careApply the techniques of lateral thinking to their service and operations to generate customer care improvementsConnect customer care to their organization’s valuesCreate a plan for how to defend the customer care culture, through Force-Field AnalysisUp to 30 students

Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'6-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3320502420.jpg','00178','active'),
('491972682','Delegating for Improved Performance','Session Description
The competitive edge today relies
on managers realizing the full potential of each of their staff. Data collected
by the Gallup Organization reveals that only 30% of the American workforce is
fully engaged at work, 55% are “not engaged” and 19% are “actively disengaged”.
Many managers who are promoted to their position because of their outstanding
technical skills often find themselves at a loss when it comes to dealing with
the complex people issues that surface. As a result, they often do what they know
best and feel confident doing, which is the
technical part of the job. Employees suffer when these managers struggle with
communicating expectations, fail to delegate work, and are unable to manage
their performance. The organization suffers as employees are not being fully
utilized and the manager usually becomes overwhelmed by trying to do all the
work himself or herself. This program engages participants in a discussion of
these dangers and teaches the skills necessary to move beyond these behaviors
and into successful delegation. 

Learning Objectives
Understand and practice techniques to shift from doer to delegatorIdentify the top ten reasons managers fail to delegateArticulate the benefits to delegating Learn a process for effectively delegating assignmentsPractice developing SMART objectives 
 
 
 
Methodology
LecturePartner activitiesGroup discussionIndividual reflection 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Supervisory to mid-level leadersHigh-potential individual contributorsProject/Program managers','Business Planning and Project Management',ARRAY['Business Planning and Project Management']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146268201.jpg','00087','active'),
('492647181','Delegation & Collaboration at Work','Session Description
At the root of collaboration is a
need or desire to problem solve, create or discover. When an organization is
facing volatility, uncertainty, complexity or ambiguity, collaboration and
delegation become critically important. But they can feel difficult to execute.
This is especially true for organizations with siloed work cultures. 
In this fundamental training,
participants will learn to see collaboration as a creative process where every
contributor is regarded as an equal. They will examine two inseparable types of
collaboration and how best to apply them when it comes to delegating roles and
responsibilities.

Learning Objectives
Understand how collaboration differs from control, ensures buy-in, and increases ownership and accountabilityPrepare to improve the quality of collaboration to unburden employees who feel overwhelmed by the quantity and frequency of communicationsExplore ways to optimize productive relationships using collaboration tools and creating collaborative communitiesLearn three factors to help determine whether or not to delegate tasks or projects --and to whomGet five keys to improve how you delegate - and when - so employees see the big picture, feel empowered to deliver results, and learn from the assigned responsibility 
Methodology
Individual ReflectionLectureSmall-Group ExercisesSmall- & Large-Group Discussion 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Business Planning and Project Management',ARRAY['Business Planning and Project Management']::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146274757.jpg','00093','active'),
('841231301','Developing Your Leadership Presence','Focuses on the personal qualities and behaviors that establish credibility and influence as a leader. Topics include self-awareness, executive presence, storytelling, and strategies for building trust with diverse stakeholders.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231301/5816039502.jpg','GGS-LMT-DYLP','active'),
('493073309','Developing Your Personal Brand','Session Description
“Be Yourself, Everyone Else is
Already Taken.” - Oscar Wilde
There are over 160 million people
employed in the US and just as many personal brand stories to be told. Do you
know how you would describe your unique personal brand to a new boss, colleague
or potential new employer? Developing
and articulating your personal brand statement is not on your list of job
responsibilities or one that you will write up in your annual performance
review.
Focusing on developing your
personal brand (in-person and online) is a critical component of how you
enhance your internal reputation and drive your career. Does the concept of
having a personal brand make you excited or uncomfortable? This session is for
you. 
Note: This can be customized for
an all-female audience like a Women’s Employee Resource Group. This session
would include research and discussion on specific aspects that impact women in
the workplace.
Learning Objectives
.Explore & Share: Your perspective on Personal Brand and explore the role of gender playsOutline & Explain: Learn the model to develop your Personal BrandPractice & Evolve: Get feedback from your peers to evolve your statementsUpdate Your Personal Brand: LinkedIn and/or company internal portals etc. 
 
 
 
 
 
 
 
 
Methodology
Pre-work, Lecture, DiscussionParticipants should bring a laptop or device to do live personal brand updatesParticipants will engage in individual and group activities, such as self-reflection,table group discussionsLarge group individual informal sharing of personal brand statement 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsFront-line staff','Presence',ARRAY['Presence']::text[],'2-Hour',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146275548.jpg','00100','active'),
('485645662','Difficult Conversations','Course PurposeAny conversation that causes us to plan, rehearse, lose sleep, develop another plan, and so on, has the potential to be difficult. A bad situation can go to worse in no time. No matter how competent we are in our jobs, we all have conversations that cause anxiety and frustration and consume valuable time and energy. This workshop will prepare participants to be more effective in their work and personal relationships.
BackgroundWhatever your job requires, you likely have to communicate with others. Most of the time, communications between colleagues, mentors, supervisors, and customers are routine. Occasionally difficult issues come to the surface that complicate projects and departments. It is when those challenging communications arise that each employee wants to be confident in his or her own communication, conflict management and negotiation skills.
Target AudienceAll personnel.
GGS offers volume discounts and discounts to government customers. Course prices listed are for Washington DC-based course offerings. Please contact GGS for further information about our pricing or to receive a price quote for your organization’s training needs. Course Length – 1 Day
Classroom Hours: 8 hours or .8 CEUsCost: $6,000.00COURSE OBJECTIVESIdentify distinguishing features of difficult conversationsAnalyze troubling situations, exploring commonalities and patternsTeach framework for discerning timing and other circumstances that impact conversationsOutline considerations of intense feelings on all sides of the conversationsPrepare for tumult of identity issues that emerge in difficult conversationsTeach guideposts for navigating the conversationsCOURSE OUTLINEHow to recognize conflict early and mitigate damage to relationships in the workplaceAn orientation to mediation in the workplaceHow to analyze the nature of a particular conflictThings to consider in preparation for a difficult conversationProvide better understanding of how to negotiate through difficult conversationsMaintaining relationships in conflicted settingsThis course is very interactive with minimum of lecture. Emphasis on industry standards for adult learning methods.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Human Capital Management',ARRAY['Human Capital Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495364705.png','00011','active'),
('496385362','Difficult Conversations Made Easier','Having difficult conversations and being able to manage them effectively is a vital leadership skill which all good leaders should possess. Dealing with a delicate situation, like appraisals, solving a staffing or performance problem, or important customer conversations, requires sensitivity and finesse. This workshop teaches participants how to be assertive, honest and fair whether with team members or with customers. You will learn to approach challenging situations with confidence, positivity, and practicality.

What You Will LearnAfter this workshop, participants will be able to:Explain why certain conversations are so difficultShift their perspectives about difficult conversations, for those who dread or retreat from having these conversationsStrategically prepare for and initiate a difficult conversationConfidently engage in a difficult conversationMake conscious decisions about the best verbal and nonverbal ways to communicate Act with integrityDemonstrate empathySuccessfully “recover” from a difficult conversationManage their emotions during a difficult conversation
Course Outline
Identifying personally difficult conversations and their challenges

Preparing an Action ChecklistGathering the facts – doing your homeworkIdentifying the desired results/solutionsPreparing your mental state, a calm attitudeChoosing the right time and place10 questions about having difficult conversationsConquering your fears before having the conversation
Having the difficult conversationStarting the conversationUsing appropriate languageCommunicating with clarity, empathy, honesty, and genuinenessTaking a positive approachUsing constructive feedbackMastering the art of constructive negative feedback Active listening
After the difficult conversationMoving the conversation forwardFocusing on building long-term relationships

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301036718.jpg','00145','active'),
('487056889','Discover Your Signature Talents with the StrengthsFinder','Session Description
The StrengthsFinder assessment is a tool that is designed to allow individuals to discover their signature talents—natural ways of thinking, believing or feeling that are innate to each of us. We all possess talents in different degrees, and by leveraging our talents with knowledge, skill, and partnerships, we’re able to turn talents into strengths. Using our strengths in our day-to-day working life directly contributes to a more productive work experience and a better team environment. This session is designed to introduce the individual to their signature talents and how they impact their performance, learn the talents of their peers and how they can work together to drive results.Learning ObjectivesLearn personal strengthsUnderstand how to leverage your strengths in your work and with your teamDevelop an action plan to take this knowledge into your day-to-day activitiesMethodology
Self-assessment LectureDiscussionParticipants will engage in individual and group activities, such as self-reflection, table group discussionsTarget Audience
Leaders and employees at all levels','Conscious Leadership',ARRAY['Conscious Leadership']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146087531.jpg','00025','active'),
('487057953','Early-Career Retirement Planning (0-5 years of Government service)','Course Description
Federal benefits are complicated. This Early-Career Seminar for New Employees informs attendees about the complex array of benefits available to them as Federal employees and the choices they need to make to best leverage them within the context of their overall financial and retirement plan.

Course ObjectivesAfter attending this seminar, attendees will understand when they eligible to retire, what their retirement benefits are likely to be (FERS, Social Security, and TSP), the importance of the TSP toward their retirement and be equipped with sound investment strategies for best leveraging what TSP has to offer. They will understand the choices they will need to make regarding survivor benefits, their health (FEHB) and life insurance (FEGLI) coverages, and their TSP funds, and how their Federal employee benefits fit within the overall construct of a financial plan.

Course OverviewThis seminar for new and returning employees includes lessons addressing the Federal retirement and benefits programs and how these benefits fit within the overall frame work of a personal financial plan. The seminar will specifically focus on Federal retirement benefits and how they can be affected by the financial decisions attendees are making now and in the future.

Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Retirement Planning & Financial Literacy',ARRAY['Retirement Planning & Financial Literacy','Human Capital Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3480003120.png','00021','active'),
('487057952','Effective Briefing Techniques','Course Purpose

Effective presentation skills are critical to leadership. The employee who can deliver a convincing, well thought-out, cogent presentation is one who will earn the respect of his or her colleagues, superiors, and customers. This skill is key for those seeking to bring their careers to the next level. Those who speak well influence others, and that is the essence of leadership. Organizations need leaders who can make their point with clarity and brevity.Target AudienceAll personnel with public speaking responsibilities.
GGS offers volume discounts and discounts to government customers. Course prices listed are for Washington DC-based course offerings. Please contact GGS for further information about our pricing or to receive a price quote for your organization’s training needs. Course Length – 1 Day
Classroom Hours: 8 hours or .8 CEUsCost: $6,000.00COURSE OBJECTIVESIntroduce principles of public speakingAnalyze different situations for presenting reportsTeach preparation exercises for public addressFully explain and demonstrate the diamond model for construction of organized, coherent presentationsTeach techniques to be used in actual events of public speaking (use of voice, gesture, visual aids)COURSE OUTLINETechniques for overcoming presentation anxietyAnalyzing the audience and settingDefining the objective and building the messageSimple model for organizing a persuasive or informational presentationExplore impact of body, voice, and visual aids to enhance presentation skillsDo’s and Don’ts of PowerPointThis course is very interactive with minimum of lecture. Emphasis on industry standards for adult learning methods.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Human Capital Management',ARRAY['Human Capital Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495365094.png','00014','active'),
('491957416','Effective Business Writing / Effective Email Writing','Session Description
In this course, participants
learn tips and techniques to improve written communication. It provides a
process that enables participants to write organized and concise letters,
memos, documents and emails quickly and efficiently.
Participants learn editing
methods using their own writing samples and have opportunities to practice new
process. This course devotes special attention to composing and sending
professional email.
Note: With minor customization,
this course can be tailored to focus specifically on email writing.
Learning Objectives
Understand your audience''s needs as a writer Write documents that are clear and conciseFollow a format to make writing accessibleProduce documents in less timeUse email to communicate in a professional mannerFollow a process to edit for readabilityMethodology
Instruction in writing organization, writing with clarity & conciseness, tone, and professionalismReadability AssessmentOne on one coaching on documentsLarge group discussion and Q&A 
 
Target Audience
SupervisorsHigh-potential individual contributorsFront-line staff','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146273935.jpg','00072','active'),
('491972581','Effective Business Writing: Improve Grammar, Sentence Structure, and Punctuation Usage','Session Description
It can be confusing when we
either realize or are told that we need to “improve our business writing
skills.” But improving this skill can increase your on-the-job credibility and
improve communication.

Established set writing standards help increase productivity, resolve issues, avoid errors, and heighten credibility.
Learn how to write faster and with more clarityGain skills for revising and fine-tuning every kind of documentLearning Objectives
Develop quality writing standardsIdentify and overcome common word usage challengesImprove writing confidence 
Methodology
LectureDiscussionIndividual reflection, paired and group exercises 
 
 
Target Audience
SupervisorsHigh-potential individual contributorsFront-line staff','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146277829.jpg','00073','active'),
('501851257','Effective Decision Making','An individual’s ability to make good decisions impacts every level of the organization, as well as the customers whom the organization serves. Whether or not people work as managers and whether people work at the top, middle, or ground-level of an organization, business success depends on the ability of employees to make great decisions with as much consistency as possible.
This workshop examines a 7-step, systematic approach to decision making. Participants explore the objectives of each step and several tools that they can use to rigorously address each piece of the decision-making puzzle.Using group discussions, team problem solving, and role-playing practice, participants develop a pragmatic, self-confident approach to making decisions with limited information in situations involving uncertainty.
Who Should AttendAnyone who leads or participates in making decisions for themselves, for their team, for their organization, and for their customers.
You Will LearnAfter this workshop, participants will be able to:Make decisions with limited amounts of information and when there is uncertaintyDemonstrate the analytical skills necessary to make sound, well-informed, and timely decisions, or recommendations to other decision makersApply a systematic decision-making process, which includes risk assessment, communication guidelines for how to share their evaluations, and the development of action plans for how to implement these decisionsEffectively respond to decision making challenges or obstaclesCourse Outline: A systematic approach for making decisions
Personal Assessment“How Good is Your Decision Making?”Step 1: Create a Constructive EnvironmentStakeholder analysisDeciding how to decide and how much to involve other peopleThe Vroom-Yetton-Jago Decision ModelThe Kepner-Tregoe Matrix for making unbiased, risk-assessed decisionsUnderstanding the decision cycleMaking decisions under pressureAvoiding GroupThink during team decision makingStep 2: Investigate the Situation in DetailDetermining whether the stated problem is the real issue through Root Cause AnalysisHow to extract the greatest amount of information from what you knowUsing Inductive Reasoning to draw sound conclusions from the factsHow to explore a problem from multiple perspectives to make sure that you are not missing important informationStep 3: Generate A Number of Good AlternativesCreativity/idea-generation toolsOvercoming barriers to creativityReverse BrainstormingBrainwritingRound-Robin Brainstorming for teamsUsing Random Input – how to make creative leaps with little actual informationConsidering how others outside your group might influence or be affected by a decisionReframing MatrixPerceptual PositionsStep 4: Explore Your OptionsHow to evaluate feasibility, risks, and implications of each alternativeRisk AnalysisRisk Impact/Probability ChartORAPAPA or Impact Analysis for considering the potential consequences of each optionStarbursting to think about the questions you should ask to evaluate each optionCost-Benefits AnalysisStep 5: Select the Best SolutionDecision Matrix Analysis for reliably and rigorously comparing optionsDecision TreesReaching a Group Consensus for team decision makingDeciding whether to go forwardGo/No-Go DecisionsWhat-If AnalysisStep 6: Evaluate Your PlanHow to “sense check” your decisionConsidering common psychological biases in decision makingBlindspot Analysis to assess whether common decision-making problems may have undermined the processThe Ladder of Inference to avoid jumping to conclusionsDecision making under uncertaintyThe impact of ethics and values on decision makingStep 7: Communicate Your Decision & Take ActionHow to assemble information from the decision-making process into a communication strategyForce Field Analysis

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301322031.jpg','00160','active'),
('491997747','Effective Delegation','Session Description
"The best executive is the one who
has sense enough to pick good people to do what s/he wants done, and
self-restraint to keep from meddling while they do it.” – Theodore Roosevelt,
26th U.S. President
The delegator’s dilemma: shall I
do it myself or give it to someone else? In this practical course with
real-time application exercises participants will be provided with a range of
tools and templates to help them learn how to delegate
tasks and use effective delegation as a key development tool to
motivate and challenge their team. Participants will learn how to identify all
the considerations that need to taken before, during and after a task has been
delegated to ensure and sustain alignment to the overall goals. 
Learning Objectives
Recognize thoughts and feelings that prevent you from delegating, and feel confident you can overcome themFlex your delegation style depending on the person and the situationBoost your colleague’s confidence and maintain a strong working relationship while delegating 
 
 
 
 
 
Methodology
LecturePartner activities Group discussionIndividual reflection 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Supervisory to mid-level leadersHigh-potential individual contributorsProject/program managers','Business Planning and Project Management',ARRAY['Business Planning and Project Management']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146278600.jpg','00088','active'),
('487103170','Emotional Intelligence','Course Purpose
Today’s fast pace and high rate of change require different skills for survival and success. Higher stress levels require better handling abilities. Mentoring relationships are particularly essential in times like these. Expertise in a particular field plays a lesser role, while internal qualities like resilience, initiative, optimism, and adaptability are taking on new value. The purpose of this course is to acquaint the participants with the principles of emotional intelligence, help them to assess their own abilities, and guide them to heightened awareness of ways to grow in these abilities.
BackgroundThe rules are changing. Success used to be measured by what we knew, or how smart we were. But today it’s how we handle ourselves and our relationships. These are the thoughts of Daniel Goleman, Harvard researcher and author of the best-selling book, Emotional Intelligence, published by Bantam in the late 90’s. Contrasted with the traditional Intelligence Quotient (IQ) emotional intelligence is largely learned and continues to develop as we go through life, learning from our experiences.
Target AudienceAll personnel
GGS offers volume discounts and discounts to government customers. Course prices listed are for Washington DC-based course offerings. Please contact GGS for further information about our pricing or to receive a price quote for your organization’s training needs. Course Length – 1 Day
Classroom Hours: 8 hours or .8 CEUsCost: $6,000.00COURSE OBJECTIVESIntroduce principles of emotional intelligence (EI)Help students assess their own level of EITeach value of growth in management of self and relationship with others within the EI frameworkCOURSE OUTLINEIntroduction to principles of emotional intelligenceSelf managementSelf awarenessSelf regulationSelf motivationSocial managementEmpathyReading Others and Perceiving AccuratelyFocused ListeningCommunicating with flexibility and authenticityThis course is very interactive with minimum of lecture. It is based upon industry standards for adult learning methods.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Human Capital Management',ARRAY['Human Capital Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495356708.png','00017','active'),
('493343336','Emotional Intelligence 101 - The Fundamentals','Session Description
Heard a lot about emotional
intelligence and still not sure what it is? Want to catch up on the latest news
in the psychology and neuroscience of emotional intelligence? Maybe you just
want some fresh tips to develop your emotional intelligence.

Whether you’re new to the EI game
or an old pro, this course is constantly on the cutting edge of the state of EI
in the workplace and in life. Learn what EI is, how it works, and how you can
develop a practice to improve your emotional intelligence today.

Learning Objectives
Understanding the Goleman EI frameworkAssessing your emotional intelligencePracticing your empathy skillsBuilding your EI development plan 
 
 
 
 
 
 
 
 
 
 
 
 
Methodology
LectureDiscussion 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsFrontline staff','Influence',ARRAY['Influence']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146279101.jpg','00105','active'),
('493337864','Emotional Intelligence 201 - Advanced Emotional Intelligence','Session Description
You’ve got Goleman’s 4
Competencies of Emotional Intelligence down pat. Did you know that within the 4
Competencies lie 12 Elements? Grow your understanding of yourself and others
through the more advanced and complex lens of these 12 Elements.

These elements will help guide an
exploration of communication and empathy to strengthen your relationships and
advance your vision within your team and organization. 

Learning Objectives
Understanding the 12 Elements of emotional intelligenceBuilding and implementing an action planManaging conflictGetting ongoing feedback on your practice from our instructor 
 
 
 
 
 
 
 
 
 
 
 
 
 
Methodology
LectureDiscussion 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Influence',ARRAY['Influence']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146282541.jpg','00106','active'),
('501846100','Emotional Intelligence at Work','Researchers have begun to uncover the power that our emotional worlds have in determining success in all human endeavors: Emotional Intelligence (EI or EQ). Emotional intelligence involves understanding and managing your own emotions and then moving consciously towards your goals with unwavering confidence and determination. Practicing emotional intelligence at work shows colleagues that you have the inner strength and character needed for both personal and shared success. You are more aware of how others feel, understand what that critical information means, and, therefore, can manage your relationships more effectively. People with high emotional intelligence often are the ones others want on their teams. You experience a greater sense of purpose and can get things accomplished with tact and mutual respect. This course summarizes the research supporting the EI concept and explores the role of EI in the workplace, by offering practical, hands-on opportunities to expand your own EI and effective strategies for integrating EI into all work endeavors and interactions.

Who Should AttendLeaders and managers who want to explore what makes themselves and others successful at work and how to build on current strengths. Team members and individual contributors who would like to play a more central role in the positive outcomes of their teams and departments, and who would like to develop the skills necessary for personal development and success at work.
You Will LearnAfter this workshop, participants will be able to:Explain their current strengths and improvement opportunities for personal emotional intelligenceInterpret what their emotions and intuition are telling them through increased self-awareness and mindfulnessRespond to events or requests with more thoughtfulnessControl their emotions and impulsesBuild higher levels of self-confidenceThink more positively and optimisticallyExperience greater comfort with changeExplain their values and how personal actions and behaviors align with and are guided by those valuesBoost their level of motivation at workSet meaningful, long-term goals for what really mattersHold themselves accountable at workAsk for feedback and constructively respond to the feedbackBetter understand how others feel and the importance of diverse perspectives Build important relationships at work through shared trust and respectEffectively deal with conflict and other difficult situations at workCourse Outline

Setting the Stage for Understanding Emotional IntelligenceEmotional Intelligence OverviewDefining your emotional intelligenceEmotional intelligence characteristicsEmotional intelligence traits of successful peopleMeasuring your emotional intelligence7 key questions for interpreting your emotional intelligence ratingsSelf-AwarenessThe link between self-awareness and high performanceIdentifying personal strengths and weaknesses through SWOT AnalysisUnderstanding your strong emotional reactions and their root causesKnowing your “hot buttons”Asking others for feedback and how to respond to that feedbackCultivating and practicing mindfulness by focusing on the presentSelf-RegulationIdentification of personal values and how they connect to current job functionsRediscovering your purpose at workManaging emotionsCognitive Restructuring – changing the way you think about difficult situationsPracticing integrityBeing able to say “no”Personal accountabilityMotivationSelf-motivationPersonal goal settingBuilding your optimism and positive attitudeMaintaining a positive attitude in a negative environmentEmpathyDefining empathyDeveloping empathyDemonstrating empathy through active listening and personal nonverbal or body languagePerceptual positions – seeing a situation through someone else’s “eyes”Social Skills10 building blocks for successful working relationshipsBuilding trust with othersBuilding rapport with othersDemonstrating respect for diverse perspectives and opinionsConstructively responding to conflict and diffusing tense situationsBeing an authentic leaderGiving others praiseSetting and managing boundaries at work

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301322021.jpg','00161','active'),
('841231302','Emotional Intelligence for Leaders','Introduces the core domains of emotional intelligence and their application to government leadership. Participants learn to recognize and regulate their own emotions, empathize with others, and build stronger working relationships.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231302/5816039508.jpg','GGS-LMT-EIL','active'),
('493349328','Emotional Intelligence I – Foundations and The Self','Session Description
Emotional Intelligence for Inclusive Leadership Series
Session 1 of the Emotional
Intelligence series begins the conversation aligning everyone on terminology
and drawing from participants’ own experiences and wisdom. Daniel Goleman’s 4
Emotional Intelligence Competencies frame our exploration, and this course will
look closely at Self-Awareness and Self-Management. 
Participants will review the
results of a previously completed E.Q. self-assessment and explore how to
improve self-awareness and self-management. 

Learning Objectives
Learn to discuss Goleman’s 4 Emotional Intelligence Competencies in the context of culture, humility and inclusive relationship buildingExplore Self-Awareness and SocializationUnderstand the connection between Self-Awareness and Self-Management 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Methodology
LectureDiscussionReflective group activities and action planning 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Influence',ARRAY['Influence']::text[],'3-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146283277.jpg','00107','active'),
('493332687','Emotional Intelligence II - Social Awareness and Inclusive Relationship Management','Session Description
Emotional Intelligence for Inclusive Leadership Series
Session 2 continues the
discussion by exploring how empathy and communication are critical to building
effective inclusive relationships, especially at work where we are most likely
to encounter difference.

Learning Objectives
Explore Cognitive and Affective Empathy Explore Communication Techniques that build collaborative, inclusive relationshipsHow to boost relationships with empathy, compassion and vulnerability 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Methodology
LectureDiscussionReflective group activities and action planning 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Influence',ARRAY['Influence']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146283397.jpg','00108','active'),
('496469907','Employee Engagement','After participating in this workshop, participants will be able to . . .

Define “engagement” and explain how employee engagement differs from “motivation at workConduct a “purpose audit,” for themselves and with their individual team membersHelp team members understand how their core values connect with their job responsibilitiesHelp team members create a unique personal mission statement that reflects their purpose at workHelp team members define their leadership legacy statements, defined by their everyday behaviors and relationships at workExplain the seven steps involved in creating team member engagement on purposeAsk their team members key questions to identify specific steps to maintain employee engagement and increase retentionLead an ongoing “stay interview” (as opposed to an “exit interview”) strategy to better understand why employees chose to stay with their organization and create subsequent retention opportunities

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301038226.jpg','00146','active'),
('711504276','Employee Relations','Employee Relations
Promote positive federal employer–employee relations that will help support your agency''s mission, boost morale, and create a better and more productive work environment. Learn the essentials needed to manage employee performance, implement disciplinary actions, inform employees of federal employment program options, and help employees with problems or complaints.
Learning Objectives
Apply principles, laws, and regulations for effective employee relations that support the federal agency missionPromote positive employee performance culture by implementing quality performance standards, evaluating performance, and responding to both good and poor performance appropriatelyRespond to employee misconduct, implement disciplinary actions, and process employee grievances to maintain a productive and equitable working environmentSupport the agency mission by representing the agency in third-party actions and executing good employee relations principles throughout an extended employee concern situationCourse Topics
Employee Relations Principles and Guidelines
Employee Relations in the Federal GovernmentRules and RegulationsEmployee Performance
Performance Management, Culture, and PlanningEvaluating PerformanceRecognizing and Rewarding Good PerformanceResponding to Poor PerformanceEmployee Conduct and Grievances
Employee MisconductDisciplinary ActionsEmployee GrievancesResolving and Implementing Employee Relations
Third-Party ActionsCapstone: Putting it All Together','HR Strategies',ARRAY['HR Strategies']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4657982148.jpg','00199','active'),
('496471417','Empowering Delegation','This workshop is designed to help manager, supervisors, and emerging supervisors assess their current delegation practices and uncover additional strategies for more effectively empowering their team members.Every minute that managers spend doing something that someone else can do is one less minute managers have to do something only they can do. If there are tasks that you currently do that others can accomplish or that others could help you accomplish, this workshop helps uncover those tasks and plan for how to delegate them to others. Delegation can help you accomplish your goals, while advancing the abilities, confidence, and initiative of your employees. Delegation can help managers develop greater employee engagement. We explore skills that enhance the delegation process, while assessing personal inhibitors and facilitators of delegation.
Who Should AttendManagers, supervisors, and those with management potential, who want to find ways to further involve employees at work; new managers recently promoted due to their technical expertise, who need to further develop their management skills. More experienced managers looking to refresh their delegation tools and take their management skills to the next level.
You Will LearnAfter attending this workshop, participants will be able to:Move away from “doing” & more towards managing and coordinatingApply an effective step-by-step process for successful & mutually beneficial delegationChoose the right tasks to delegate & match those tasks to the right peopleUse delegation to develop a competent and motivated staffEffectively deal with people who respond negatively to delegationMake their expectations clear & understand their employees’ concernsFeel less guilt about delegatingCreate more time to accomplish those tasks that only managers can do
Course Outline
Participants’ Current Delegation PracticesAssessing the urgency of additional delegationAssessing participants’ missed delegation opportunitiesAssessing why participants do not delegate as much as possibleUncovering personal delegation obstacles & their solutions
Participants’ Future Delegation OpportunitiesAssessing participants’ job responsibilities & specific tasksHow to decide what to delegateThe Phases of Successful DelegationHow to select the right task & the right person for a good matchHow to clearly communicate the assignment, its parameters, and the level of authority delegatedHow to create & review the task’s action plans, its obstacles, proposed solutions, & mutual expectationsHow to monitor employee progress, troubleshoot arising problems, and coach team members back on track using the OSKAR coaching model

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301070530.jpg','00147','active'),
('487618977','Empowering Leadership for Diverse Workforces','Session Description
This course is for organizations
ready to look deeper at the psychological and sociological underpinnings of
oppression in society and how they show up at work. Drawing from Dr.
Leticia Nieto’s seminal work Beyond Inclusion, Beyond Empowerment: A
Developmental Strategy to Liberate Everyone. This course examines how social
identities, whether or not we choose them, play a role in every human
interaction, including at work, and how we can all respond with empathy,
compassion and respect.
Learning ObjectivesExplore
Status, Rank and Power and how they factor into our socialization.Understand social identity as
something that can be both ascribed and embraced, but not always a choice.Explore Dr.
Pamela Hays’ A.D.R.E.S.S.I.N.G. framework for understanding social identity and
oppression.Explore the different behaviors
of Dr.
Leticia Nieto’s Target and Agent model and how different identities can harm or
support each other at work and beyond.Methodology
LectureDiscussionTarget Audience
Leaders and employees at all levels','Conscious Leadership',ARRAY['Conscious Leadership']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146283427.jpg','00026','inactive'),
('491548914','Engaging Your Team Through Turbulent Times','Session Description
Current events have reinforced
for all of us that change is both pervasive and can happen at any time. In this
new reality where social, financial, political and environmental changes
present themselves to us at the speed of light, understanding how to manage
change – whether planned or unexpected – is critical for leaders at all levels
within organizations. Amidst turbulent times, when organizations call upon
employees not just to carry on, but to remain engaged and highly productive,
leaders able to proactively and skillfully
manage change are invaluable. This highly interactive online workshop will
allow you to strategize for current or anticipated changes that are top-of-mind
for you. It will give you the skills to recognize your, and others’,
reactions to change; it will enable you to identify and manage resistance. Leaders will acquire a practical set of tools
to apply with their direct reports to maintain trust and productivity under
constantly changing organizational conditions.
Learning ObjectivesUnderstand the distinction between the operational and human sides of changeGive you the skills to recognize your, and others’, reactions to change; to identify, manage and, ultimately, overcome resistance to changeBuild confidence in your personal ability to thrive in complex and volatile times Help you model and facilitate productive behaviors despite environmental uncertainty and turbulenceAcquire a practical set of tools to apply with your direct reports to maintain trust and productivity under constantly changing organizational conditionsAllow you to reflect on and strategize for current or anticipated changes that are top-of-mind for youMethodology
Mini-lectures with relevant examplesInteractive exercisesIndividual reflection, including self-reflectionSmall group discussionsPeer coachingApplication & action planning Target Audience
SupervisorsManagersTeam LeadersHigh-potential individual contributors','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146287302.jpg','00053','active'),
('491975589','Equitable Managing Relationships and Organizational Justice','Session Description
Understanding the complex
dynamics of managing people can be made more complex when employees perceive
themselves as treated unfairly by their employer and its leadership.
Understanding the concept of Organizational Justice can help managers and
leaders improve communication and decision-making practices that lead to higher
engagement, retention and a more connected, communal workplace culture.

Learning Objectives
Understand Organizational JusticeLearn to increase Organizational Justice in 1-on-1 meetings with employeesPlan how to boost organizational justice on their team and in their organization 
 
Methodology
LectureDiscussionReflective group activities and action planningTarget Audience
Leaders at all levels','Communication',ARRAY['Communication']::text[],'3-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146287387.jpg','00074','active'),
('841231303','Equity, Diversity and Inclusion in the Workplace','Provides a foundation for creating and sustaining an equitable and inclusive work environment. Covers concepts of systemic bias, cultural competence, inclusive leadership behaviors, and strategies for building a diverse team.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231303/5816039514.jpg','GGS-LMT-EDI','active'),
('501782479','Exceptional Customer Service: The Key to Building Loyalty','Whether your business is large or small, product- or service-based, this workshop will help you develop a strategy for developing and then keeping your most important asset, your customers – both internal and external customers.

Customers are more likely to become loyal customers when they have a personal relationship with people inside your organization. This workshop helps participants to understand how to develop a loyalty-driven culture, through individual attention to customer needs, as well as a savvy process for developing high customer service standards and for nurturing those relationships.
Who Should AttendAnyone who would like to take more control over how they develop and then maintain loyal customers.
What You Will Learn
After attending this workshop, participants will be able to:Identify the key indicators of a service cultureTake personal responsibility for customer satisfactionUnderstand the relationship between effective communication and quality serviceAnticipate customers’ needsBuild strong partnerships with internal and external customersClarify their customers’ expectationsDevelop and practice empathy through active listeningIdentify ways that they can go beyond customer expectationsAssess their personal attitudes while dealing with a difficult moment of truthMore effectively handle customer complaintsMore confidently respond to upset customersMore easily handle customer telephone callsHelp to create a customer service mission statementDevelop customer service performance standards for themselves and othersCourse Outline
What Exceptional Customer Service Looks LikeIdentifying personal examples of exceptional customer serviceKey Indicators of a Service CultureAssessing participants’ current organizational/departmental service culture improvement opportunitiesTaking Personal Responsibility for Customer SatisfactionHow to make a personal difference in the way that you work with customersCreating a personal definition of customer serviceAnticipating Customers’ NeedsIdentifying how to anticipate customers’ needsIdentifying how knowing customers’ needs would help participants’ work easierBuilding Strong Customer Service PartnershipsOverview of the 10 Building Blocks that represent typical internal and external customers’ needsIdentifying individual participant’s internal/external customer needs and how to better meet themCreating Building Block action plans for customersSeeking to Understand Customer Ideas, Thoughts, and Emotional Reactions to Their SituationsDefining empathyUsing Active Listening to exercise empathyBuilding empathy into participants’ communication skillsGoing Beyond Customers’ ExpectationsConsidering how to exceed internal/external customers’ expectationsIdentifying participants’ optionsKeeping Your Cool & Serving Your CustomersPersonal attitudes during difficult Moments of TruthWorking with upset customersHandling customer requests, problems, & complaints – knowing what you can and cannot do for the customer and how to communicate that, while maintaining appropriate flexibilityLearning how to you “no” and “yes, but”How to facilitate Service RecoveryEffective Use of the Telephone with Customer ServiceIdentifying telephone annoyancesTelephone pitfalls and benefitsUncovering telephone guidelinesHow to handle call holds and transfers with appropriate telephone etiquetteCreating Customer Service Mission StatementsIdentifying who and what benefits from a customer service mission statementIdentifying its desirable characteristicsPracticing a step-by-step process for how to create a customer service mission statement with participants’ teamsDeveloping Customer Service Performance StandardsIdentifying the necessary complexity of the standardsHow to check the standards to make sure that they will create their intended purposeHow to monitor the standards and make necessary changes over time

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301297477.jpg','00162','active'),
('493034392','Executive Wellness Series','Session Description
In this session participants will
learn more about mindfulness practices as well as simple chair yoga exercises,
and how to implement them to their daily routine for ensuring their self-care
throughout their workday.

Learning Objectives
Introduce participants to mindfulness concepts and simple chair yoga stretches.Give an overview of human cognition, and mindfulness techniques.Teach participants to be mindful about their posture and offer simple stretches. 
 
 
 
 
 
 
 
 
 
Methodology
PresentationGroup and individual exercisesGuided meditation experience and session handouts. 
 
 
 
Target Audience
Leaders at all levels','Presence',ARRAY['Presence']::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146286441.jpg','00101','active'),
('496301238','Expanding Your Resilience: The Art of Bouncing Back','"Maturity of mind is the capacity to endure uncertainty" (John Finely, Historian, Mathematician). Resiliency allows us to bounce back when things don''t go as planned. In response to the uncertainties and rapid, chaotic changes we are facing in our professional and personal lives, the ability to not get derailed or immobilized can serve us well. Learning to channel your mental energy into being the best of who you are involves catching yourself in the act of giving in to feelings of frustration and reminding yourself that you have better things to do with your time. Corporate uncertainty is not going away, so why not expand your ability to bounce back? Joining this session allows participants to . . .

Explain the five essential elements for personal resilienceBuild their resilience wherever they call “the workplace”Intentionally create active optimismDevelop relentless tenacityConstruct interpersonal supportHelp team members build their own resiliencyImplement personal motivation hacks

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300928475.jpg','00135','active'),
('485686599','FCN 190 Federal Acquisition Regulation (FAR) Fundamentals','Course Description
FAR Fundamentals (FCN 190) is the resident capstone FAC-C Level I contracting course for federal civilian agency contracting personnel. It is a federal civilian agency adaption of Defense Acquisition University’s CON 090 course. For FAC-C purposes, this course can be taken as an alternative to CON 090, FAR Fundamentals.
FAR Fundamentals Course provides foundational knowledge of the Federal Acquisition Regulation (FAR) System. Students will be immersed in the FAR throughout this course and emerge knowledgeable of the government contracting process; the FAR and FAR supplement structure; FAR Parts 1-53; and will be able to locate and understand FAR regulations, guidance, provisions, and clauses. Students will navigate the online FAR as they wrestle with realistic scenario-based contracting problems. This training course is designed for personnel new to federal contracting workforce who are seeking FAC-C Level I training and non-contracting personnel who play a role in the acquisition process and require this course for certification.
Course Length: 10 Class Days
CLPs: 80 hoursCost: CallCOURSE OBJECTIVESUsing web-based resources, students must demonstrate the ability to:Locate, cite, interpret, and determine the applicability of policies and procedures in the FAR.Determine the requirements of the acquisition planning process as mandated by law and implemented by regulation.Determine the policies and procedures for acquisitions from required and preferred sources of supplies and services.Identify the competition requirements for a given acquisition.Determine a permissible method of contracting for a given acquisition.Describe the types of contracts that may be used in acquisitions.Determine when the use of an option or an indefinite delivery contract is appropriate.Determine the policies and procedures for describing agency needs.Determine the policies and procedures for publicizing contract opportunities.Determine the applicability of socioeconomic programs to a given acquisition.Identify the legal principles used by courts and boards of contract appeals to determine whether the Government has entered into a relationship involving one or more enforceable promises.Determine the policies and procedures for soliciting offers.Determine the policies and procedures for evaluating bids.Determine the policies and procedures for evaluating competitive proposals and having exchanges with offerors after the receipt of proposals.Determine the policies and procedures for making contract awards.Determine the policies and procedures for protests.Determine the policies and procedures for the use of simplified acquisition procedures.Determine the policies and procedures for the initiation of work.Determine the policies and procedures for managing contractor performance.Determine the policies and procedures for payment.Determine the policies and procedures for preparing and processing contract modifications.Determine the policies and procedures for processing contract disputes and appeals.Determine the policies and procedures relating to the complete or partial termination of contracts for the convenience of the Government, or for default or cause.Determine the policies and procedures for closing out Government contracts.

Target AudienceThis course is designed for New hires to the Contracting Career Field (Civilian OCC Series 1102), active military personnel and those who seek certification in the contracting field. This course must be completed by employees in the Contracting Career Field (Civilian OCC Series 1102) within the first 24 months of employment. This does not extend or alter the requirement to meet certification requirements within 24 months of assignment to an acquisition position or change in position requirements.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495457037.png','00000','active'),
('632330676','FCN 4032: Appropriations Law Seminar','Appropriations Law Seminar 2 Days, 16 CLPs
Discover how to steward federally appointed funds correctly in order to remain compliant with appropriations law requirements and avoid serious repercussions. By exploring the Government Accountability Office (GAO) Principles of Federal Appropriations Law (the Red Book), Volume I and part of Volume II, you will learn about the availability of federally appropriated funds. You’ll delve into the three pillars—purpose, time, and amount—and will learn to apply the principles to avoid Antideficiency Act violations. 
Who Takes This Course: This course is designed for everyone who deals with money in the Federal government, including budget analysts, accountants, auditors, contracting officers, program managers, government purchase card holders and approving managers, and attorneys. 
Course Format: Lecture, group discussion, case studies, and exam. 
Learning Objectives 
• Identify and apply the basic concepts and principles of appropriations law 
• Determine the legal availability of appropriations based on purpose, applying the Purpose Law and Necessary Expense Doctrine 
• Determine the legal availability of appropriations based on time, applying the Bona Fide Needs Rule 
• Determine the legal availability of appropriations based on amount, avoiding violations of the Antideficiency Act (ADA) 
Course Topics 
Introduction and Legal Framework 
• The Constitutional Power of the Purse 
• Statutory Interpretation 
Appropriations Available as to Purpose: Red Book Chapter 3 
• The Purpose Law 
• Step 1—Logical Relationship 
• Step 2—Expenditure Must Not Be Prohibited 
• Step 3—Expenditure Not Provided for in Another Appropriation 
Appropriations Available as to Time: Red Book Chapter 5 
• Time Rules 
• Contracts and Time 
• Severable and Nonseverable Services 
• Module Capstone: Case Studies for Appropriations Available as to Time 
Appropriations Available as to Amount: Red Book Chapter 6 
• The Antideficiency Act 
• Most Prone to ADA Violations 
• Methods to Prevent Violations 
• Additional Laws 
• Module Capstone: Case Studies for Appropriations Available as to Amount','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4144971377.png','00184','active'),
('632326229','FCN 4034: Appropriations Law Seminar','Appropriations Law Seminar 4 Days, 32 CLPs
Discover how to steward federally appointed funds correctly in order to remain compliant with appropriations law requirements and avoid serious repercussions. By exploring the Government Accountability Office (GAO) Principles of Federal Appropriations Law (the Red Book), Volume I and part of Volume II, you will learn about the availability of federally appropriated funds. You’ll delve into the three pillars—purpose, time, and amount—and will learn to apply the principles to avoid Antideficiency Act violations. 
Who Takes This Course: This course is designed for everyone who deals with money in the Federal government, including budget analysts, accountants, auditors, contracting officers, program managers, government purchase card holders and approving managers, and attorneys. 
Course Format: Lecture, group discussion, case studies, and exam. 
Learning Objectives 
• Identify and apply the basic concepts and principles of appropriations law 
• Determine the correct course of action when funds need to be reprogrammed or transferred or when laws are in conflict or unclear 
• Determine the legal availability of appropriations based on purpose, applying the Purpose Law and Necessary Expense Doctrine 
• Determine the legal availability of appropriations based on time, applying the Bona Fide Needs Rule 
• Determine the legal availability of appropriations based on amount, avoiding violations of the Antideficiency Act (ADA) 
• Identify what constitutes a legal obligation and its impact on appropriations law principles 
• Describe the unique considerations for a continuing resolution 
• Identify the terms under which accountable officials may be granted relief from financial responsibility 
Course Topics 
Introduction and Legal Framework 
• The Constitutional Power of the Purse 
• Statutory Interpretation 
• Appropriations and Related Terminology 
• More Guidance from the Red Book 
• Module Capstone: Case Studies for Introduction and Legal Framework 
Appropriations Available as to Purpose: Red Book Chapter 3 
• The Purpose Law 
• Step 1—Logical Relationship 
• Step 2—Expenditure Must Not Be Prohibited 
• Step 3—Expenditure Not Provided for in Another Appropriation 
Appropriations Available as to Time: Red Book Chapter 5 
• Time Rules 
• Contracts and Time 
• Severable and Nonseverable Services 
• Module Capstone: Case Studies for Appropriations Available as to Time 
Appropriations Available as to Amount: Red Book Chapter 6 
• The Antideficiency Act 
• Most Prone to ADA Violations 
• Methods to Prevent Violations 
• Additional Laws 
• Module Capstone: Case Studies for Appropriations Available as to Amount 
Other Appropriations Law Issues 
• Contracts and Obligations 
• Use of Interagency Reimbursable Orders 
• Special Considerations for a Continuing Resolution or a Lapse in Appropriation 
• Accountable Officers 
• Module Capstone: Case Studies for Other Appropriations Law Issues','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4144968733.png','00185','active'),
('632330690','FCN 403: Appropriations Law Seminar','FCN 403 Federal Appropriations Law 
Course Length: 3 days (Continuous Learning Points: 24) 
Course Purpose: The Principles of Appropriations Law Course will familiarize participants with the basic purposes and principles of the United States federal fiscal law. The course aims to equip the participants with the knowledge of the legal concepts, rules, and practices allowed in the use of appropriated funds. Students will learn the purpose, time and amount restrictions on use of such funds; other conditions for use; as well as liabilities and relief of Accountable Officers; and responsibilities in use of appropriated funds, at both the agency and individual level of accountability.Topics addressed include the background of fiscal law; availability of appropriations as to purpose, time and amount; the necessary expense rule; the Anti-deficiency Act; Continuing Resolution Authority (CRA); and Liability and Relief of Accountable Officers. This course references the same body of case law published in GAO’s Principles of Federal Appropriations Law (commonly referred to as “The Red Book”) and augments the useful information and guidance found in this book. Participants receive a copy of the Red Book on disc. 
Course Outline: 
Nature of Appropriation Law 
Congressional Authority “Power of the Purse”General Restrictions “Power of the Purse”Most Important StatutesGAO’s Purpose and RoleThe Redbook 
Federal Appropriations Terminology 
Definitions of Appropriation TermsContinuing Resolution (CRA) - DefinitionPurpose - Rate for OperationsRelationship to other Legislations Duration of CRA & Appropriations 
Life Cycle of an Appropriation 
Types of Appropriations 
Specific Vs General AppropriationsTransfer and ReprogrammingVariations in AmountsExceeds AuthorizationLess than AuthorizationEarmarks in Authorization Act 
Availability of Appropriations 
Determining Authorized PurposesAuthority vs. AppropriationsContract AuthorityNecessary Expense DoctrineSpecific Purpose Authorities and Limitations 
Availability of Appropriations--Purpose 
Period of AvailabilityRatification by AppropriationLack of AuthorizationStatutory Implications - Plain Meaning Rule','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4144974844.png','00186','active'),
('632761513','FCR 201 COR II: Contracting Officer’s Representative Level II Course','FCR 201 COR II: Contracting Officer’s Representative Level II Course
Description: Technical personnel play a vital role in acquiring equipment, systems, and support services by contract for the Government. They prepare the work statement; evaluate proposals; recommend source selection; and, as the appointed contracting officer’s representative (COR), review, guide and direct the contractor’s performance. Program success relies upon their informed and timely input. Effective contracting requires that technical personnel possess and correctly apply technical and administrative skills. Most technical personnel become involved in acquisitions because of their technical expertise. This course looks to improving agency acquisitions and contractor performance by enhancing their knowledge and practical application of contracting principles. Learning Objectives: Students who successfully complete this course will be able to: 
• Identify their responsibilities in the acquisition process and applicable requirements from the FAR and Agency policy.• Address key elements of acquisition planning including market research, competition, source selection, contract type, use of indefinite delivery contracts, cost estimating, funding, special considerations for service contracts, logistical considerations, Government-furnished property and information, and security.• Recognize authorized limitations on full and open competition; develop a justification for other than full and open competition, and support small business set-aside goals and programs.• Prepare a performance-based work statement, source selection criteria, and technical proposal instructions.• Observe solicitation constraints including communication with prospective offerors, disclosure of information, and confidentiality.• Understand their input to the source selection process including the technical evaluation plan, evaluating proposals and reaching an agreement, cost realism and best value analysis, and source selection.• Plan for quality and schedule assurance, select the appropriate remedy for nonconforming or delinquent performance, and prepare contractor performance evaluation reports.• Support timely execution of contract modifications and avoid unauthorized changes.• Provide timely technical direction within the scope of the contract requirements.• Review payment requests and provide timely feedback.• Know and appreciate standards of procurement ethics including areas of proscribed conduct under the Procurement Integrity Act and criminal conflict of interest statutes.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4147235031.png','00189','active'),
('711504279','Federal Human Resources (HR) Functions','Federal Human Resources (HR) Functions
Build your understanding of the integrated nature of federal human resources (HR) functions and their role in the strategic management of the government''s workforce. This course emphasizes the importance of a comprehensive perspective within federal government HR, recognizing the substantial influence HR decisions have on public administration. You will explore how collaborative efforts in the areas of compensation and benefits, talent acquisition, talent development, employee performance, employee relations/employee accountability, and labor relations contribute to the operational excellence and service delivery in the federal government.
Learning Objectives
Articulate the impact of the compensation and benefits function within federal human resources (HR) as an employer of choiceIllustrate the impact of the talent acquisition function in effectively recruiting and retaining top talent within the federal workforceEvaluate the purpose of the talent development function in supporting a skilled and capable federal workforceInterpret the importance of managing and supporting the employee performance function in the federal governmentDescribe the role and responsibilities of HR in managing the employee relations/employee accountability function in the federal governmentExplain the importance of having an effective labor relations function within the federal governmentCompensation and Benefits
Compensation ManagementBenefits ManagementCompensation and Benefits ComplianceTalent Acquisition
Planning for Talent AcquisitionSourcing and RecruitingApplicant ProcessesTalent Acquisition ComplianceTalent Development
Talent Development PlanningTalent Development and TrainingLearning AdministrationEmployee Performance
Employee Performance ManagementRecognition ManagementPerformance Appraisal System Certification for Senior Executive Service (SES) and Senior-Level/Scientific and Professional (SL/ST)Employee Relations/Employee Accountability
Employee Accountability for Conduct and PerformanceAdministrative Grievances and Third-Party Proceedings in Employee RelationsReasonable AccommodationsLabor Relations
Labor Management Relations AdministrationNegotiated Grievances and Third-Party Proceedings in Labor RelationsCollective Bargaining','HR Strategies',ARRAY['HR Strategies']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4657982138.jpg','00200','active'),
('491992415','Feedback and Coaching','Session Description
Managers drive results through
the people they supervise. Feedback and coaching are essential skills to guide
people’s performance. Managers are responsible for helping people develop the
skills needed to accomplish their day-to-day responsibilities.

In this workshop, we give
managers a common understanding, framework, and a set of tools for reinforcing
critical skills and driving superior performance. Participants learn a
practical formula for providing effective feedback and a facilitative process for
coaching employees.

Learning Objectives
Demonstrate understanding of how to engage in ongoing, effective performance conversations as a way to develop people and ensure “no surprise” at year-end performance reviewsLearn and practice a formula for providing clear, descriptive feedback Practice and gain skills in a facilitative coaching model 
 
 
Methodology
LecturePartner role playIn-the-moment feedback Group discussionTarget Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146289557.jpg','00075','active'),
('841231321','Financial Management of Federal Awards','Addresses the financial management standards required of federal award recipients, including internal controls, cash management, accounting system requirements, and financial reporting under 2 CFR Part 200.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231321/5816039616.jpg','GGS-GMS-FMFA','active'),
('487099592','Financial Planning','Course DescriptionFinancial Planning is a daunting task for most people. For Federal employees, financial planning is made more challenging by the complexity of their employee benefits. The Financial Planning for Federal Employees (or Federal Financial Literacy) seminar provides employees with a basic understanding of the principles of financial and retirement planning within the context of the OPM-led Federal Financial Literacy Initiative.
Course ObjectivesAfter attending this seminar, attendees will understand the need for financial planning and how to create a financial plan. They will learn financial principles such as budgeting, saving and investing, credit and debt management, and estate and tax planning. They will understand the importance of the TSP toward their retirement and be equipped with sound investment strategies for best leveraging what TSP has to offer. Finally, they will understand how their Federal employee benefits fit within the overall construct of a financial plan.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Retirement Planning & Financial Literacy',ARRAY['Retirement Planning & Financial Literacy','Human Capital Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495357752.png','00024','active'),
('492013105','From Risk to Readiness: Scenario Planning as a Tool for Your Business','Session Description
One of the most important roles
of the public relations professional is to provide relevant counsel and a
framework for clients and employers to identify and manage risks to their
operations. This workshop is for the professional looking to strengthen their
public relations and communications strategies and crisis communications plan.
Scenario planning helps make an organization nimbler and more responsive when
the unexpected happens.
Scenario planning is an effective
way to anticipate future outcomes based on trends, assumptions, and new or
emerging risk events across the organization. Being surprised by and/or
mishandling a crisis can affect a company’s reputation, integrity, credibility
and, in severe cases, can disrupt or stop business altogether. The workshop will explore how to use this
tool to get a seat at the leadership table and ensure the organization is ready
for most uncertainties.
Learning Objectives
Learning proven frameworks for conducting scenario planning to mitigate risksLearning how to make the case for taking the lead and integrating this tool into the strategic planning process and crisis communication planUnderstanding the relationship between an organization’s effectiveness and strategic risk management, based on the latest scholarly researchExploring best practices for risk management through relevant case studies in a variety of business sectorsUnderstanding the role of communications in going beyond the SWOT analysis and Enterprise Risk Management Integrated Framework 
 
 
 
 
 
Methodology
Lecture and group discussionLeadership Style InventorySmall-group activity 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/program managers','Business Planning and Project Management',ARRAY['Business Planning and Project Management']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146289602.jpg','00089','active'),
('711504280','Getting Efficient: Optimizing HR Operations','Getting Efficient: Optimizing HR Operations
Increase HR operational efficiencies and performance through streamlining operations and optimizing processes on both a department and individual level. In this course, you will gain in-depth knowledge on benchmarking, service level agreements, and ways to evaluate and reward performance.
Learning Objectives
Discuss trends in the HR domain that influence effectiveness, efficiency, and performanceApply a four-step model to optimize HR operationsDescribe the hierarchy through which policies, procedures, and guidelines flow from creation to actionReview mission-critical policies, procedures, and guidelinesApply various methods to evaluate an HR functional unit and individual HR employeesDescribe how service level agreements and bench-marking enhance the working relationship between the HR functional unit and other agency unitsDescribe how individual development plans and performance improvement plans enhance the performance of individual HR employeesDiscuss the monitoring of agency-wide and individual optimization actionsList methods for rewarding improved performanceEffectiveness, Efficiency, and Performance
Effectiveness, Efficiency, and PerformanceOperational TrendsOptimization and HR—How Do They Relate?Evaluate, Act, Monitor, RewardExercise: Kevin and the Invoice ProcessPolicies, Procedures, and Guidelines
Familiarity Breeds OptimizationFrom Creation to ActionHR Policies, Procedures, and GuidelinesWhere Are They?Exercise: Kevin and the Training ProjectEvaluating Your HR Functional Unit
Evaluating the HR Functional UnitEvaluating the HR EmployeeReporting the ResultsTaking Action
Actions for the AgencyService Level AgreementsBenchmarkingActions for the IndividualMonitoring and Rewarding
Monitoring HR Functional Unit ActionsMonitoring Actions for IndividualsRewards!It Never EndsExercise: Kevin and the Monitoring Plan','HR Strategies',ARRAY['HR Strategies']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4657983399.jpg','00201','active'),
('841231339','Government Contract Law','This course provides a comprehensive overview of the laws and regulations governing federal government contracting. Participants will learn about the legal framework for acquisitions, contract formation requirements, and key statutory provisions that affect both government agencies and contractors.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231339/5816040059.jpg','GGS-FAC-010','active'),
('841231288','Government Property Management','Covers the policies and procedures for managing government-furnished property and contractor-acquired property. Includes FAR Part 45 requirements, property accountability systems, and disposition procedures.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231288/5816036186.jpg','GGS-GPM','active'),
('841008254','Government Property Management and Accountability','This course provides federal agency employees with a practical understanding of the policies, procedures, and oversight responsibilities associated with managing and accounting for government-owned property and assets. Participants will gain a working knowledge of the regulatory framework governing Government property management, including FAR Part 45 and FAR Clause 52.245-1, Government Property, as well as the roles and responsibilities of agency personnel involved in acquisition, program management, logistics, asset management, and contractor oversight.

The course examines the full government property lifecycle — from acquisition and receipt through utilization, inventory management, maintenance, reporting, and disposition. Participants will also explore common property management challenges in decentralized and field-based environments, including inventory discrepancies, improper utilization, loss prevention, contractor accountability, and audit findings. Through practical discussions, agency-relevant scenarios, and real-world examples, participants will strengthen their ability to support effective property oversight, maintain accurate documentation, improve compliance, and reduce organizational risk.

Upon completion, participants will be able to:

• Describe the purpose and importance of Government property accountability within agency operations
• Identify the regulatory framework governing Government property management, including FAR Part 45 and applicable federal requirements
• Distinguish between Government-furnished property (GFP) and contractor-acquired property (CAP)
• Explain the roles and responsibilities of agency personnel involved in property accountability, contractor oversight, and asset management
• Apply property management principles throughout the Government property lifecycle
• Identify internal control practices that support accountability, audit readiness, and risk mitigation
• Recognize common property management deficiencies and implement corrective actions
• Apply procedures related to loss, damage, destruction, theft, and reporting requirements
• Support accurate property documentation, inventory reconciliation, and audit preparedness','HR Strategies',ARRAY['HR Strategies']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841008254/5814647478.jpg','00206','active'),
('841231322','Grants Management for Program Staff','Designed for non-financial program staff who are involved in managing federal grants. Provides a practical overview of grants management responsibilities, compliance requirements, and effective collaboration with grants administrators.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231322/5816039622.jpg','GGS-GMS-GMPS','active'),
('491548920','Group Decision Making','Session Description
Decision making is not exclusive
to an organization board or a team of executive and senior leaders. Group
members at all levels of an organization make decisions and each one has a say
- even if they don’t realize it. In this leadership development workshop,
participants will leverage their experience and prior training to identify and
begin solving problems that undermine the effectiveness of decision making in
groups. 
As a first step, they’ll receive
simple tools to sharpen their equity and inclusion lens. Then, together,
participants will determine how the tools will be used to improve engagement
levels among leaders and contributors during decision making.

Learning ObjectivesExamine the processes that help or harm collective decision making and consider which ones may be operating within the organizationKnow the symptoms and causes of groupthink and three ways to prevent it Co-create decision-making principles and practices tailored to the organization and prepare to apply them to upcoming projects or initiatives Analyze a workable 4-step model for group decision making and make optional adaptations based on the organization’s culture and realities Methodology
Individual ReflectionLecture; Small-Group ExercisesSmall-& Large-Group DiscussionTarget Audience
Leaders at all levelsHigh-potential individual contributorsProject/program managers','Leading Teams',ARRAY['Leading Teams']::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146292345.jpg','00054','active'),
('491601548','Group Structure, Cohesion & Development','Session Description
Organizational Effectiveness
extends far beyond hiring top talent, keeping high-performers engaged, and
promoting high-potentials to leadership roles. In each scenario, the successful
organization carefully considers how groups of leaders and managers are
structured and how to create the necessary time and processes for them to
transition into and function as a cohesive team.

In this fundamental training,
participants receive the basic concepts and skills to create and foster a
leadership team that gets results -efficiently, effectively, and with mutual
respect and shared accountability.

Learning ObjectivesDefine, describe and differentiate group normsExamine the processes that generate and sustain group norms Determine what norms best support organization strategy, team alignment, and task accomplishment.Learn the nature of Leader and Group roles in the current social climate Explore how and why roles in the organization have become differentiated over time Identify sources of and antidotes to role stress, including role ambiguity, role conflict, and role fit Methodology
Individual ReflectionLecture; Small-Group ExercisesSmall-& Large-Group DiscussionTarget Audience
Leaders at all levelsHigh-potential individual contributorsProject/program managers','Leading Teams',ARRAY['Leading Teams']::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146291919.jpg','00055','active'),
('492998746','Grow Your Social & Emotional Intelligence','Session Description
The Social + Emotional
Intelligence Profile (SEIP) measures 26 competencies identified as critical in
socially and emotionally intelligent individual, team, and organizations. Using
a four-quadrant model, participants can identify areas of strength and improvement. 

This session provides detailed
descriptions of emotionally and socially intelligent behaviors
when present and when lacking, as well as extensive suggestions for development
that will improve workplace results. 

Learning Objectives
Learning the four-quadrant model and ways to frame EQ versus social intelligenceDiscovering what areas to focus on greater resultsUnderstanding specific tools to use in personal growth and development 
 
 
 
 
 
 
 
 
 
 
Methodology
Self-assessmentIndividual reflection 
 
 
 
 
Target Audience
Leaders of all levelsStaff of all levels','Presence',ARRAY['Presence']::text[],'2-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146292414.jpg','00102','active'),
('495058703','How to Avoid Procrastination','Have you ever had a task or assignment to begin or to finish but intentionally stalled your progress by creating or just starting other tasks that may have less priority and may not be the best use of your time in that moment? Why do we do that even though we know it can be counter-productive? Why do we then feel guilt or tension as a result? Procrastination often affects the procrastinator’s performance and overall well-being. It can occur in some parts of our lives but not in other areas. This session helps learners identify common areas of procrastination, the root causes for procrastination in both our professional and personal lives, and how to overcome the “need” or “desire” to delay the kind of progress that you seek and that others may expect from you. Walk away with a plan and specific ideas for how to minimize or even overcome your procrastination and experience the resulting satisfaction and relief.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3278623403.jpg','00112','active'),
('496059399','How to Be Creative on Purpose: Generating Ideas','4 ways to brainstorm by yourself or within your team.Overcoming some of the barriers to creativity and a greater field of options when decision making or solving problems.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3295077446.jpg','00113','active'),
('496100005','How to Build or Rebuild Trust','Establishing “trust accounts” with team members.13 trust-building behaviors.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3295087123.jpg','00114','active'),
('496059401','How to Build Your Empathy','Seeing things through another’s eyes using Perceptual Positions.Empathy’s 10 requirements for success and respect.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3320606745.jpg','00115','active'),
('496092388','How to Delegate','Selecting the right person for the task.Establishing shared expectations and less stress and frustration when you should delegate.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3295063221.jpg','00116','active'),
('496090839','How to Discuss an Impending Change with Team Members, 1-on-1','The 7 stages of personal transition in response to change: Why giving up on team members might be premature.The 6 steps for having a conversation with individual team members about the change.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3278636677.jpg','00117','active'),
('496092810','How to Get Your Message Understood: The 8 Cs of Effective Communication','Removing your communication breakdowns with more clear communication.Your nonverbal behaviors: Are they saying something different from what your words are saying?Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3295082416.jpg','00118','active'),
('496062386','How to Have Difficult Conversations','How do I even begin this conversation? What if I say something that damages our relationship? Some topics are tough to talk about at work, but you and your team’s ability to accomplish your goals and maintain a high level of mutual respect and trust sometimes require difficult discussions. This session helps learners get into the right frame of mind, prepare for the tough talks, and ensure that a constructive outcome remains in focus.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291317836.jpg','00119','active'),
('496059413','How to Improve Team Trust','How much trust exists within your team and what role does trust play inside your team? What would happen if you expanded your team’s trust? Even at high levels, trust requires ongoing maintenance efforts. This session helps team members understand how to build, rebuild, or expand trust with coworkers inside and outside your team.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3278609244.jpg','00120','active'),
('496059423','How to Influence Customers and Coworkers Towards Commitment and Buy-In','The 10 Languages of Influence: Tailoring your influence strategy.Communicating with confidence, not aggressiveness.PowerTalking to strengthen the impact of your message.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3278636378.jpg','00121','active'),
('496092820','How to Keep Yourself and Other Team Members Motivated','Common sources of motivation.When more money is not the answer.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291307828.jpg','00122','active'),
('496091558','How to Overcome Resistance: What, Why, and How?','The 7 Types of resistance.Root cause analysis for resistance.Responding to resistance.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291304666.jpg','00123','active'),
('496059426','How to Set Empowering Goals','Creating SMART goals for yourself and your team.Using individual and shared goals to reinforce team accountability.Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3278605231.jpg','00124','active'),
('496062389','How to Show Employee Appreciation','Most of us like to know that we make a difference while at work. Then, it is nice to know that others recognize the results of our hard work. Letting your team members know how much you appreciate their contributions can be more difficult than expected. This session helps you identify the core values of other team members and then find ways to align your appreciation efforts with the unique interests of individual coworkers.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3278643640.jpg','00125','active'),
('496090846','How to Show Respect Inside Your Team','Anything that differs between you and your other team members likely causes differences of opinion and sometimes outright conflict. Knowing that respect for these differences often allows higher performance, increased opportunities for improvements, and better decisions. This session addresses how to fully incorporate six diverse thinking styles into any problem solving or decision-making discussion within your team.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3278649535.jpg','00126','active'),
('496100021','How to Stay Positive in a Negative Environment','Trying to identify the positive in a tough situation, through Cognitive Restructuring.Working with Pessimistic Coworkers.
Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291304656.jpg','00127','active'),
('493343086','How to Strengthen Resilience','Session Description
We invite you to participate in
this special, interactive workshop focused on resilience. This year we have all
faced unexpected circumstances at work, home, and in our communities. During this action-focused session, we will
discuss what being resilient means and how you can strengthen your resilience
muscle. 

As we continue to forge ahead
working and living at home, resiliency will remain important. Join us to learn,
to celebrate, and to leave with new ideas to strengthen your resilience.

Learning Objectives
Strengthen your resilienceReflect and share 
 
 
 
 
 
 
 
 
 
 
 
Methodology
Individual reflectionDiscussion 
 
 
 
 
Target Audience
Leaders of all levels','Presence',ARRAY['Presence']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146291713.jpg','00103','active'),
('496059443','How to Understand Different Work Styles within Your Team','The 4 ways we tend to work and identify them.Planning for getting along with team members who have a different work style from yours.
Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3278636667.jpg','00128','active'),
('496091568','How to Understand Others’ Points of View','Active Listening for Understanding.Perceptual Positions: How does the situation look from their perspective?

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291304609.jpg','00129','active'),
('496100022','How to Use Cognitive Diversity in Your Team','Understanding and using all perspectives using Six Thinking Hats when problem solving or decision making in a team.Getting others to contribute during team meetings in different ways and appreciate differences of opinion.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291314816.jpg','00130','active'),
('496092842','How to Work with Purpose','Assessing your and your team members’ values.Creating personal mission statements that reflect team members’ value.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291304636.jpg','00131','active'),
('711500800','HR Analytics','HR Analytics
Increase the probability of successful HR outcomes by using the most effective tools, techniques, and best practices for preparing and communicating HR data and making data-driven decisions. Throughout this course, you will learn how to leverage HR analytics to add value to your organization and which regulations and reporting requirements are most useful and relevant to your position. By applying the Analytics Process Model and utilizing Microsoft Excel, you''ll be ready to organize, analyze, and present HR data.
Learning Objectives
Identify each phase of the HR Analytics Process Model (APM) and its purposeDescribe best practices using HR analytics to support data-driven decision makingIdentify HR benchmarks and metrics relevant to agency mission and goalsAnalyze workforce and talent data using Excel to identify trends and other actionable performance informationGive a short briefing to present analysis resultsCourse Topics
HR Analytics and the Analytics Process Model
Exercise: Decision-Making ProcessOverview of HR AnalyticsExercise: How Do We Make Decisions?The Analytics Process Model (APM) and Its PhasesHuman Resources Value PropositionHR Analytics in the Workplace and the Human Capital Framework (HCF)Exercise: Demonstrating the Analytics Process ModelExcel Quantitative Techniques
Key Systems of Record for HR DataSoftware ToolsMetrics, Benchmarks, and Other IndicatorsUsing Excel for HR AnalyticsExcel VisualizationExcel Analytic TechniquesHR Regulations and Reporting Requirements
HR Laws, Policies, Procedures, and GuidelinesKey Regulations and Reporting RequirementsConnecting Missions or Goals to HR Benchmarks and MetricsEffectively Presenting HR Data
Assessing Your AudienceCrafting the MessageExercise: Presenting Analysis Results','HR Strategies',ARRAY['HR Strategies']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4657982133.jpg','00202','active'),
('491548671','Identifying Skill Gaps','Session Description
With so many people funneling
up to you, how can you be sure they’re well-equipped to perform at their
highest level? Is it better to develop or hire? These important questions are
asked and answered in this course that will teach you to work collaboratively
to determine the current state of skills in your department and get your people
ready and capable.

Learning ObjectivesUnderstanding and implementing skill gap analysis at the appropriate scaleDetermining whether or not to develop skills internally or hire outDetermining and managing key stakeholders in skill gap analysis Methodology
LectureDiscussionTarget Audience
Supervisory to mid-level leadersHigh-potential individual contributors','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146292494.jpg','00056','active'),
('841231289','Incentive Contracting','Explore the range of incentive contract types used in federal procurement, including fixed-price incentive, cost-plus incentive fee, and award fee contracts. Learn how to structure incentives to motivate contractor performance.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231289/5816036192.jpg','GGS-IC','active'),
('493306961','Influencing, Collaborative Leadership, and Win-Win Negotiation Skills','Session Description
In the heat of the moment, best
intentions to create better outcomes dissipate and often negotiations suffer
from the individual’s fears of losing. In order to create calmer and more
strategic negotiation environment there needs to be a planning, inquiry and
understanding process take place.

This course teaches participants
to implement and execute such process.

Learning Objectives
Mindfulness exercise to understand one’s nature in the presence of fearBreaking the habits of fear-driven behaviorExercises on approaching the negotiation with strategy 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Methodology
LectureIndividual’s awareness on their negotiation styleGroup exercise on specific case scenarios on how to approach the negotiation for win-win 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Influence',ARRAY['Influence']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146294609.jpg','00109','active'),
('493343347','Influencing Without Authority','Session Description
Through participation in this
course, you will gain insight, tools and skills to become a more influential
employee in your organization – someone that others see as contributing to the
organization’s success.
Organizations are hierarchically
structured to ensure clear lines of authority and accountability. However, with the increasing complexity and
speed of change, every organization’s success now depends on its ability to tap
into the right people at the right time –“contributors” who bring valuable energy,
talent, resources, and judgment. These
contributors, while not officially in charge, exercise informal influence
because those who do have formal authority pay attention to what they say or
do.
Learning Objectives
Identify a real-world situation and potential opportunities to increase your influence on itAssess your strengths and communication style to gain insight into strategies you can use to be persuasive with different co-workers and decision-makers Practice addressing people’s values, interests, and deeper-level emotions (such as fear) in making a persuasive case for an idea or course of actionGain the skills for building alliances and resource networks within and outside the organization to increase your influence 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Methodology
Self-assessmentPresentationSmall and large group discussionCase study analysisSimulation practice and analysis 
 
 
 
 
 
 
 
 
 
Target Audience
SupervisorsHigh-potential individual contributorsFront-line staff','Influence',ARRAY['Influence']::text[],'1-Day',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146294684.jpg','00111','active'),
('496515300','Innovation in Action','Organizations that experience a continuous stream of new products and services, as well as new ways of doing business, more easily boost earnings, speed growth, ensure an advantage over competitors, and appeal to shareholders.

This workshop introduces participants to the basic concepts of creativity, innovation, and cognitive diversity. It provides participants with specific tools and techniques that they and others can use to independently and collaboratively generate critical business ideas.
Who Should AttendIndividuals and intact teams who need, want, and/or are expected to develop skills that can help them to more fully tap into their innovative talents, to create new ideas that solve problems, identify new products or services, and stimulate collaborative thinking between individuals.
You Will LearnAfter this workshop, participants will be able to:Understand how leveraging differences in the way people think can foster greater innovationEnhance collaboration with others by understanding the impact and value of the entire range of innovation styles, through the Innovation Style Inventory (ISI)Leverage the power of two people joining forces to collaborate, through innovation teams- ThinkerTeamsEmploy a variety of specific, hands-on techniques, designed to change your perspective and subsequently generate new ideas, solution sets, and unique insights on purposeMore fully consider and make decisions about these new ideas by employing a thinking process that easily combines and thoroughly examines emotions, information, logic, hope, and creativity
Course Outline
Introduction to Applied InnovationUnderstanding the innovation system within your organization, the “Innovation Wheel Model”How to use lateral or parallel thinking techniques to balance perspectives rooted in emotions, logic, improvement opportunities, critical thinking, and creativity, when making decisions about and finalizing your new ideasCognitive Diversity for InnovationInnovation Style Inventory review
Building Innovation TeamsIntroduction to teams of twoLeveraging cognitive diversity within teams of twoHow to build innovative teams of twoInnovation Tools & Techniques

Overviews and explanations for a variety of idea-generating techniques that leverage both linear thinking and intuitionPractice activities that allow participants to experiment with tools

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301057849.jpg','00148','active'),
('492011843','Introduction to Process Improvement: Fixing Your Workflows','Session Description
Bugged by inefficiencies or
processes that don’t work? Join us for this exciting workshop where you will
learn concepts and techniques that you can immediately use in your workplace to
get your teams working together to improve and innovate. Learn the basic
principles of process improvement thinking, process mapping and how to identify
waste—all immediately applicable to your work (or home) environment. 
Learning Objectives
Learn what process improvement is and isn’tLearn the basics of the Lean Six Sigma philosophy and the myths of Lean process improvementLearn what the various forms of waste are and how to identify them in your workplaceLearn the technique for basic process mapping you can immediately apply in your workplaceLearn other introductory level LSS tools that can be applied to various process improvement projects 
 
 
 
 
 
 
Methodology
LectureSmall Group Breakout SessionsDiscussionIndividual Reflection ExercisesAction Planning 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/program managers','Business Planning and Project Management',ARRAY['Business Planning and Project Management']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146299289.jpg','00090','active'),
('487671588','Leadership Development: Capacity Building','Session Description
Most leadership trainings focus
on acquisition of leadership competencies rather than an increase in actual
leadership capacity. Leadership capacity is the ability to think and act more
effectively in times of increasing VUCA (volatility, uncertainty, complexity,
ambiguity) and rapid change. See this short summary for more
details on this vital but little-understood distinction: Leadership
Development is About Capacity, Not Just Competencies (trainingindustry.com) or this longer article for a deeper dive
into this topic : Leadership
Development — It’s About Capacity, Not Just Competencies | by Clear Impact
Consulting Group | Medium.

Learning ObjectivesUnderstanding and increase
leadership capacityUnderstanding what is needed to successfully integrate new learningUnderstanding the concept of developmental stagesUnderstanding the difference between leadership competencies and capacityUnderstand, with with, and apply this particular map of Levels of Development In-ActionIdentifying each participant’s
likely current level of functioning, and some capacity-building activities and
reflections that can increase that level of functioningMethodology
Levels of Development-in-ActionCapacity-building ApproachesTarget Audience
Leaders and employees at all levels but particularly more senior/executive levels.','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'1-Day',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146299339.jpg','00027','active'),
('487678124','Leadership Development & Learning Across Generations','Session Description
Many organizations offer formal
leadership development to managers across generations. The common question: are
the development needs and preferred learning styles different between each
group? The assumption tends to be yes, leading organizations to blindly incur
high costs. In this leadership development workshop, participants will do a
deep-dive into one case study that assessed the needs of staff by generation
category and found shocking results: there is significant
alignment between generations when it comes to their development needs and
learning styles. Participants will draw on the study’s insights to consider
what leadership development programming, solutions, and topics can be applied
to internal staff right now to benefit the future direction of the
organization.

Learning ObjectivesExamine generational categories and explore the workplace myths and realities commonly associated with each one Explore how leadership development would serve each category of talent and the organization at large Learn strategies to bring out the best in each generational category of talent Understand how authentic leadership, situational leadership and emotional intelligence can be leveraged to deepen connection with employees across generations MethodologyIndividual ReflectionLectureSmall-Group ExercisesSmall- & Large-Group Discussion Target Audience
Leaders at all levelsHigh-potential individual
contributorsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146300588.jpg','00028','active'),
('502076319','Leadership Skills and Techniques','Learning Objectives

After participating in this workshop, learners will be able to:Analyze the benefits of different leadership styles and valuesUse leadership approaches that foster individual motivation and engagementExplain the different impact of team motivation and team engagement toolsPositively impact team member engagement with a step-by-step planHelp team members to identify their individual purposeAnalyze strategies for building cohesive and effective functional teamsAnalyze techniques for enhancing the performance of individuals on your teamAnalyze what is influencing unsatisfactory performanceAssess possible coaching situations to decide whether coaching is worth your time and effortPrepare for and conduct a solutions-based coaching sessionEngage team members within their own coaching sessions to commit and contribute to performance improvement plansUse coaching as a method of maintaining employee growthUse techniques to promote resilience during changing circumstancesUse team engagement to cultivate change and innovation within teamsApply conflict resolution approaches to challenging workplace situationsCourse Content
Day OneLeadership stylesPersonal and team motivation vs. engagementMotivation mythsSteps for creating lasting team engagementReframing work responsibilities in terms of individual core valuesPersonal mission statementsLeadership legacy statementsPutting purpose to work for your teamDay TwoBuilding team harmonyBuilding and rebuilding team trustIncreasing rapport within teamsDemonstrating appreciation within teamsConstructive feedback and active listening for mutual understandingA strengths-based coaching modelCoaching with confidenceThe role of leader expectations on team member performance levelsDay ThreeHow to achieve resiliencePersonal and team resilience-building techniquesThe stages of team reactions to changeBouncing back from changeDiscussing change with team membersThe benefits of conflictThe five reactions to conflict and when to use each styleHow to find common ground within conflictHow and when to identify win-win outcomes

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'3-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300952679.jpg','00175','active'),
('501793648','Leadership Through Collaboration','The best leaders aren’t formidable ones. They lead with strong purpose and direction, but their strength isn’t defined by how harsh they are, how much critical feedback they can give, or how strict they are with deadlines. Instead, their strength comes from how well they can encourage, support, and direct their team. The essence of collaboration involves bringing together the individual talents of your team members to create something, a new idea, a solution to a problem, a path towards goal achievement. Whether building or facilitating collaboration within one team or across several teams, this workshop provides the tools and practical applications to accomplish more through how you involve others.

Who Should AttendAnyone building, leading, managing or participating in either function or cross-functional teams.
You Will LearnAfter this workshop, participants will be able to:Define collaboration, the types of collaboration, and how to determine when to use which typeSet team goals aimed directly at a shared goalAssemble a team of people who meet the necessary criteria for effective collaborationCreate commitment at the team and individual levelsDevelop collaborative behaviors and methods within team processesCourse Outline
Defining collaboration
The benefits of collaborationWhat do you find?What has research identified?The different types of collaborationOpen collaborationClosed collaborationCross-functional collaborationCross-cultural collaborationHow to define your team’s purposeSetting SMART goalsCreating a team mission statementHow to choose the type of collaboration neededHow to involve the right people
Achieving buy-in within your teamCreating personal mission statementsConnecting with individual valuesEncouraging collaborative behavior within your teamLeading by exampleBuilding trustFostering a creative cultureThe pitfalls of poor collaboration
The pitfalls of too much collaboration

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301313907.jpg','00163','active'),
('496528297','Leadership Through Influence: How to Get Commitment','Learn techniques for improving influence skills, whether influencing an audience of one or one hundred, by structuring influence messages so that others will understand them and be more willing to consider them.

Influence is at the heart of most professions. Increasing others’ buy-in and commitment to ideas, suggestions, and directives are important to success at work. This workshop is designed to help participants assess how to build relationships with and how to communicate their ideas to others with credibility, confidence, and clarity. We will explore why some people are more influential than others and focus on specific how-to skill building. This helps participants with and without formal authority to create mutually beneficial outcomes.
Who Should AttendAnyone who must generate commitment in others; new managers or those with management potential, especially when working in an environment characterized by diverse needs and interests.
You Will LearnAfter this workshop, participants will be able to:Understand what people expect from formal & informal leaders, to be more influentialCreate lasting influence, rather than superficial influence where people just go through the motionsIdentify & assess situational factors that can either help or hinder your influence successChoose & tailor an influence strategy to meet the specific needs of a target audienceIdentify why someone might resist your influence attempt and how to address that resistanceLearn how to tailor your communication skills to the influence target’s preferences (to be able to “speak their language”)Develop PowerTalking skills to maximize your impact and credibilityBe a more prepared & self-confident agent of influenceDesign a personal plan for a real-world influence attempt
Course OutlineStrategic Influence PlanningHow to create an influence context that promotes buy-in (e.g., timing, location, values, relationship history, readiness), by assessing both helping and hindering forces and then planning accordinglyHow to assess the seven ways people can react to influence, including varying degrees of resistanceHow to understand why someone is resisting influence your influenceHow to design a strategy for dealing with resistance, based on an understanding of its root causesInfluential Communication TechniquesHow to speak the influence target’s language – the 10 languages of influenceHow to assess the person being influenced to use the most appropriate influence strategy optionsHow to translate the influence agent’s message into the language most likely to persuade the influence targetHow to use Power Talk, to speak with confidence & clarity, so that others take you and your messages seriously

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301060089.jpg','00149','active'),
('487686021','Leading Across Boundaries','Session Description
Top leaders know that working
outside of their function is a must. Despite understanding the value of leading
across an organization, very few leaders feel they are effective in doing so. This course will help you
understand the intricacies of leading throughout an organization in a
collaborative fashion, respecting the boundaries of your peers while connecting
with their teams and breaking down silos.

Learning ObjectivesDifferentiate vertical and horizontal boundariesIdentify boundaries that affect your ability to work collaboratively and cooperativelyBuild an action plan to break down the boundaries that limit your ability to lead MethodologyLectureDiscussion Target Audience
Leaders at all levelsHigh-potential individual
contributorsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'2-Hour',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146300638.jpg','00030','active'),
('491976593','Leading and Communicating Change','Session Description
Change is easy, leading change isn’t. As the famed philosopher Niccolo Machiavelli stated “there is nothing more difficult to carry out, nor more doubtful of success, nor more dangerous to manage, than to initiate a new order of things. For the initiator has enemies in all those who profit by the old order, and only lukewarm defenders in those who would profit the new.”

During this workshop participants
will learn how to plan for change, lead transitions, and respond to the three
most common reasons people resist change. 
Learning Objectives
Understand the types of change that you may encounter as a leader, and understand how each type can affect you and your teamEffectively communicate about what is changing (and not) in a positive, motivating way even if you are unsettled about itUnderstand why people may “resist” change (including you), what might be causing it, and what you can do to manage itFeel better prepared to have difficult conversations with team members who may be having a tough time adjusting to changeAdopt team behaviors and “norms” that will help your team(s) stay resilient through rapid change 
 
 
 
Methodology
LectureRole PlaySelf-ReflectionActivityTarget Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146300668.jpg','00077','active'),
('841231304','Leading Change','Prepares government leaders to plan, communicate, and sustain organizational change initiatives. Covers change management models, stakeholder engagement strategies, resistance management, and maintaining momentum.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231304/5816039520.png','GGS-LMT-LC','active'),
('501763734','Leading Exceptional Teams','This workshop will introduce participants to critical tools and techniques for understanding how to effectively build, lead, and participate in work teams. We will focus on the strategic tools and interpersonal team skills that can help supervisors and other team members to more effectively serve and contribute to their teams. This workshop will help equip and empower participants with tools that directly affect a team member’s ability to help move the team to higher levels of performance and satisfaction.

Learning ObjectivesAfter attending this workshop, participants will be able to:Use team characteristics and their team member roles to better contribute to team effectivenessUse the stages of team or group development to better contribute to team effectivenessGive & receive constructive feedbackUse active listening with team membersIdentify what to look for in team or group dynamics and how to respond to those that help and those that hinder team performanceDifferentiate among different “work styles,” creating a greater appreciation for diversity among team membersMinimize the potential for team members making assumptions about others on the teamSee the individual differences in the way we generate ideas for making decisions and solving problemsWho Should AttendAnyone currently or who will be responsible for building and/or leading a high-performing, highly satisfying team. In addition, team members who want to take on more of a leadership role inside existing or future teams will benefit. In-tact teams who would like to be sure that all the pieces are in place at the beginning or a new team or existing in-tact teams who would like to build on their current strengths and take their team to a higher level.Course Outline
Characteristics of effective teams and team membersWhat roles and responsibilities help make an effective team memberHow to help your organization use your valuable qualities as a team memberStages of group developmentHow to diagnose the stages within teamsHow to use this information to effectively address team problemsConstructive feedbackHow to give itPersonal practice exerciseHow to receive itActive listeningPersonal assessmentsPersonal practice exerciseTeam or group dynamicsOverview of what to look for in teamsExercise for observing/diagnosing effective and ineffective team dynamics and then how to respondDifferent work stylesPersonal assessmentIdentify preferred stylesUnderstanding others’ and own strengths and weaknesses for each styleHow to get along with someone who has a different style – how to maximize team diversity and minimize assumptions about other team membersSix Thinking HatsPersonal assessmentOverview of each of the six thinking and problem-solving stylesExercise to observe/identify each “Hat” in action

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301303596.jpg','00164','active'),
('487676925','Leading & Managing Organizations with a Diversity, Equity, & Inclusion Lens','Session Description
The role of today''s leaders and managers has expanded significantly, encompassing much more than strategy and operations. They are now expected to act as catalysts for change, fostering environments that honor their organizations'' rich histories and the realities of their diverse stakeholders. The global community looks to these leaders to bring a clear vision and a broad perspective to the social challenges they help address. In this introductory session, an Executive Coach and Facilitator will help organizations explore ways to refine their approach to leadership and cultural transformation. By adopting fundamental principles and tools, leaders can strengthen their relationships with colleagues and positively influence strategy, decision-making, and client engagement.Learning ObjectivesPrepare for leadership
development programming with Bruno Ford Consulting GroupLearn key racial and social
justice terms and conceptsUnderstand the value of
establishing and honoring workplace Community AgreementsExplore professional Cultural
Norms that can improve interpersonal dynamics with diverse people and teamsKnow how to initiate Courageous
Conversations and engage in Inclusive DialogueDiscuss ways to implement
policies and practices that incorporate a framework for and commitment to
authentic social and racial equityMethodologyIndividual ReflectionLarge-Group Discussion Target Audience
Leaders at all levelsHigh-potential individual
contributorsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'2-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146304017.jpg','00029','inactive'),
('493352018','Leading with Emotional Intelligence','Session Description
While IQ is what often comes to
mind when we think of intelligence, Emotional Intelligence (EQ) is often just
as, if not more, important to our success at work, especially as leaders. EQ
helps us respond to others appropriately in the workplace and in other parts of
our lives, though some elements of EQ can be more difficult to practice in
certain environments or with certain people.

Participants will build their understanding of the importance of EQ based on the work done by Daniel Goleman. They will work to increase their awareness of their own EQ strengths and areas of opportunity through personal work and reflection as well as group discussion and activities. Participants will apply this increased awareness and learning to practice their EQ skills individually and with their fellow participants. The day will culminate in participants creating an individual action plan for applying their EQ learning immediately upon returning to work, and they will work with a partner to insure the feasibility of the plan.
Learning Objectives
Apply their understanding of the concept of Emotional Intelligence to common situations that leaders encounter.Practice strategies for increasing self-awareness that they can quickly apply upon returning to work.Identify ways in which they can use their strengths to improve in their roles as leaders [Self-Awareness and Self-Management].Develop skills in active listening and understand strategies to adjust to others based on verbal and nonverbal feedback [Social Awareness and Relationship Management].Apply session learning to create an Emotional Intelligence action plan that they can implement upon returning to work. 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Methodology
Individual assessment and reflectionSmall and large group discussion and activitiesPartner and small group feedback 
 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Influence',ARRAY['Influence']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146300718.jpg','00110','active'),
('841231305','Leading with Innovation and Creativity','Cultivates an innovation mindset in government leaders. Topics include design thinking, creative problem solving, building a culture of experimentation, and navigating the constraints of the public sector environment.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231305/5816039526.jpg','GGS-LMT-LIC','active'),
('492028274','Lean/Six Sigma - Light Tool Package','Session Description
Lean/Six Sigma Methodologies are
comprehensive effectiveness and excellence approaches that requires in depth
training to implement fully. Often companies make mistake to separate their
projects as Lean/Six Sigma projects rather than implementing the methodology
and thinking style as part of the company culture. 

This course is designed to offer
how to take simplified tools of these comprehensive methodologies and create
effective operational efficiency culture. 
It is recommended that the
participants come to this course with a specific project in mind so that they
can start utilizing these tools in the learning environment for their projects.
Learning Objectives
Give an overview of most supportive and utilized Lean/Six Sigma ToolsUtilize built in practices to have participants understand and start using these toolsCreate a strategy on how to build an efficiency culture within the organization 
 
 
 
 
 
 
 
Methodology
LectureIndividual and group exercisesStrategic Implementation Plan 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Supervisory to mid-level leadersHigh-potential individual contributors20 participants','Business Planning and Project Management',ARRAY['Business Planning and Project Management']::text[],'3-Day',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146486303.jpg','00091','active'),
('491972604','Leverage for Leaders Management Coaching Program','Session Description
The LFL Coach Training Program is
designed to take the skills you already have, and integrate them using a
specific methodology, to support you in being able to elicit the most creative
ideas from others. Whether you are working with you team, or your clients, you
will know what to do to empower others to bring their best selves to the table. 

Participant Limits - Due to the intensive nature of this
process, participation is limited to 4 - 12 students per cohort
Learning Objectives
Eliciting the most creative solutions to challenges within your teamEmpowering others around you to step up and take initiativeIncreasing the productivity of your team and companyCommunicating in a way that inspires othersBeing a leader who is respected and admiredConnecting with others and understanding them in a powerful way 
 
 
 
 
Methodology
Myers Briggs Type Indicator – self-assessmentLectureDiscussionGroup activitiesIndividual activities 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Communication',ARRAY['Communication']::text[],'3-Day',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146305354.jpg','00078','active'),
('493306948','Making a Great First Impression That Lasts','Session Description
Seven seconds is all we have to
make a great first impression on someone we meet – in real life and online.
This session will unpack how to make those seven seconds work as hard as
possible. 

We will look at what it takes to
make a positive impact – both how we present ourselves and what we say. We will
also explore how to make those first impressions last through effective
follow-through and powerful credibility building activities.

Learning Objectives
Understanding what goes into making a great first impression in person – from 12 feet, 12 inches, and the first 12 words we sayExploring dos and don’ts of online presenceLearning how to build trust and credibility quickly and effectivelyUndertaking an Image Audit & Triage to understand where we may need to make changes 
 
 
 
 
 
 
 
 
 
 
 
Methodology
Highly interactiveFacilitated group discussionsHands-on practice sessions360-degree Image Audit 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsFrontline staff','Presence',ARRAY['Presence']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146434304.jpg','00104','active'),
('501793202','Making Change Work','Organizations have never had a greater need for people skilled at leading change. This workshop provides participants with a set of tools that they can use to help themselves and others to more effectively plan and cope with workplace change. We focus on skills to help individuals understand change and then be able to respond to change in a more adaptive way. Participants will develop a more detailed understanding of how they and others typically respond to change, which will help them to facilitate change at work.

What You Will LearnAfter attending this workshop, participants will be able to:Understand the stage or phases that people go through in response to changeEmphasize the positive aspects of transition and the help that other people can provide in difficult timesReduce instances of low self-confidence in the face of changeLessen the pain and fear of changeStrategically prepare for introducing a changeIdentify who to involve in a change effort by identifying stakeholdersCreate a vision for a change effortUnderstand how to become personally more ready for changeBecome more proactive by helping others become more adaptive to and ready for changeAssess the degree to which people wear “blinders”/areas at work within which they currently may have a narrow viewpointApply a greater understanding of how people typically react to change in the way they encourage others to changeEffectively communicate a change messageGet others to buy into a change message and create follow-throughReduce the unnecessary resistance to changeDevelop a range of techniques that can help people to identify personal strategies for change, including one-on-one conversations with those involved in a change effortWho Should AttendAnyone responsible creating implementation plans for how to get others’ buy-in regarding changes that will take place within a business environment. Managers and supervisors who need to be able to both model and facilitate successful change management practices should attend.
Course Outline
Understanding change managementWhat you can do to manage changeHow to take a proactive approach to change & self-assessment5 types of changeWhat is a Change Readiness Mindset & self-assessmentPreparing for ChangeHow to set SMART goalsStarting to create a work-related application for change management toolsUnderstanding stakeholders’ needsIdentifying the roles required for successful changeSelecting members of the change team & member criteriaHow to set up the change teamMaking the Change JourneyHow people tend to react to changeHow to manage employees’ reactions to change7 stages of change or transitionHow to diagnose your individual team members’ current stages of changeStrategies for managing the transition processCreating vision for changeKey attributes of an effective communication strategyStrategies for managing the scope and speed of the changeBuilding Change Management Skills6 key change management skills & self-assessmentHow to master the 6 key change management skillsUnderstanding the reactions that people must changeUsing active listening to understand why someone is resisting the changeTypical reasons why people resist or resent changeHow to facilitate openness and understanding of the resistorStrategies for overcoming resistance to changeHow to influence your boss about the changeInfluence strategies for other employees about the changeCreating the Change Management PlanUsing force field analysis in your planningPositive self-talk and the role it can play6 steps for how to share the change message with employees

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301320754.jpg','00165','active'),
('496542781','Making Meetings Work','Many people who attend meetings wish they could do something to help meetings start down the correct path. This workshop can help you develop the skills necessary to define and then keep meetings focused on what needs to get done for participants to leave with a greater sense of accomplishment.Most professionals spend at least part of their workday in meetings . . . for others, it may seem as if all they do is attend meetings while at work. The quality of these meetings, therefore, becomes critical. Poorly run meetings create frustration, resistance, and apathy. Good meetings produce results, enthusiasm, and a sense of time well spent. This workshop gives meeting participants practical options that can make meetings work.
Who Should AttendFormal meeting leaders and facilitators; managers, supervisors, and other individuals who lead meetings; team members looking for ways to positively impact the way others lead their meetings.You Will LearnAfter this workshop, participants will be able to:Plan and execute more effective meetings, by determining whether to meet, how to construct the agenda, who should attend, when and where the meeting should take place, and how to evaluate a meeting to identify future improvementsDevelop in yourself and in others the responsibilities of five key meeting roles: facilitator, recorder, timekeeper, minutes taker, and process observerApply adult learning principles to the way you run meetingsDevelop a team vision statement to highlight priorities and to keep meeting discussions and people on trackCreate a meeting code of conduct that reflects team valuesEffectively handle “difficult” people, including those who dominate, ramble, withdraw, arrive late or leave early, degrade others, do not participate, are uncooperative, and hold side conversations; as well as the Backseat Drivers, Broken Records, Busybodies who come and go during your meetings, Doubting Thomases and Theresas, Gossipers, Headshakers, Interrupters, Know-It-Alls, and Teacher’s PetsUnderstand and evaluate group dynamics and their impact on meeting outcomesCourse Outline

Keeping Meetings Focused on What Is ImportantHow to use adult learning principles to keep yourself focused as a meeting leaderHow to create a meeting Code of ConductHow to create a Team Vision StatementHow to leverage the 5 key meeting rolesUnderstanding & Handling What Occurs Between Meeting Participants
How to assess a group’s meeting style through its dynamicsHow to handle nineteen typical “difficult people” in meetingsMeeting PlanningHow to assess current meeting practicesHow to decide whether to have a meetingHow to decide whom to invite to a meeting, where to hold it, and what other logistics must be addressedHow to create an agendaHow to evaluate a meeting’s improvement opportunities

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301069329.jpg','00150','active'),
('496273234','Making the Transition to Supervisor or Manager','This session serves to establish a shared belief system for what constitutes supervisory responsibilities. For experienced managers, this class allows participants to identify missed opportunities in establishing their supervisory relationships, so that the more experienced supervisors can build onto what they already have accomplished. For new supervisors, this session allows participants to start their management assignments with a realistic preview of what is to come and what they need to immediately start doing as supervisors.

What You Will LearnAfter this workshop, participants will be able to:Describe the responsibilities of a supervisorMore smoothly transition from team contributor to supervisor or managerMove from “friend” or coworker to supervisorCourse OutlineThe responsibilities of a SupervisorTo managementTo your teamTo yourselfSeventeen steps for making the transition to supervisor or manager as smooth and easy as possibleSupervising former coworkers and friends

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'4-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300974906.jpg','00139','active'),
('491976697','Manager as Coach','Session Description
The demands of today’s manager
are varied and the skill sets are multiple. The manager who holds a coaching
mindset and possesses basic coaching skills is at a great advantage in terms of
developing people and maximizing individual performance.
Manager as Coach allows the
manager to use this skill at the appropriate times to engage in ongoing
development of direct reports. The approach is simple, easy to use and
guaranteed to create measurable impact.
Learning Objectives

Identify coaching opportunities in work as a supervisor/managerUnderstand the coaching process and its value to effective managementDetermine personal coaching style, strengths and opportunities to improveApply questioning techniques that motivate othersCreate opportunities for coaching to occurDevelop a coaching mindset and build inquiry skills that can facilitate future developmentPractice skills in listening, building actions, and measuring outcomesDevelop skills in challenging people to stretch and changeLearn communication and coaching skills to defuse volatile situationsLearn when to manage, when to coach 
 
 
 
 
Methodology
Small group exercises Self-reflectionRole plays 
 
Target Audience
Leaders at all levelsProject/Program managers','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146434536.jpg','00079','active'),
('491791405','Manager, Leader, or Both?','Session DescriptionTwo skills have become top priorities for learning and development organizations: management and leadership. Both are important but distinct skills and, without training, too much of one or the other can lead to serious trouble. As John Kotter points out, being over-managed and under-led stifles innovation, while the opposite leads to too much change and no execution. 
The true balance will drive
productivity and achieve strategic goals as they were intended. This course
will help you differentiate when to utilize which skill set so you can manage
and lead more effectively. 
Learning ObjectivesManagement and leadership: What’s the difference?What to manageWhen to leadBuild your management and leadership vision Methodology
LectureDiscussionTarget Audience
Supervisory to mid-level leadersHigh-potential individual contributorsProject/Program Managers','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146434176.jpg','00057','active'),
('487677100','Managing a Diverse Workforce','Session Description
Today’s organizations recognize
the demand for a diverse workforce and the benefits of inclusive approaches to
getting things done. The challenge: if diversity and inclusion (D&I) are
not understood clearly and managed effectively, unintended harm can be created.
That harm often leads to mistrust, resistance, silos, limited employee
engagement, high turnover, and other consequences that can impact the health of
an organization. In this fundamental training,
participants define diversity and inclusion and what they mean for their
organization. Then, they explore how to leverage D&I in their leadership
and management practice so that individuals and teams can bring the full range
of their capabilities and perform at higher levels.

Learning ObjectivesExamine the range of diversity that currently exists in the organization and what’s required right now to manage it wellCollect tools to facilitate open, transparent conversation Understand how to foster creativity among individuals and teams Explore ways to collect and leverage a insights to inform decision making, solicit buy-in, and ensure task ownership for new processes and initiatives MethodologyIndividual ReflectionLectureSmall-Group ExercisesSmall- & Large-Group Discussion Target Audience
Leaders at all levelsHigh-potential individual
contributorsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146434964.jpg','00031','inactive'),
('491992483','Managing Conflict in the Workplace','Session Description
This workshop is intended to help
participants get a deeper understanding of conflict and practice their
resolution skills.
Conflict can damage relationships
at work and understanding it is important. It is also important to understand
disagreements, as they are different from conflict, but equally as common. One
common cause of conflict is miscommunication between members of an
organization. Communication will be discussed in depth in this course because
clear communication is key to managing conflict. 
Learning Objectives
Increase awareness of conflict styles and resolution skillsUnderstand how to adapt conflict resolution strategies to fit the situationPractice conflict resolution skillsDiscuss the importance of communication – speaking, listening and acknowledging 
 
 
 
 
 
Methodology
Small group exercises Self-reflectionRole plays 
 
Target Audience
Leaders at all levelsProject/Program managers','Communication',ARRAY['Communication']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146439073.jpg','00080','active'),
('487678150','Managing Managers','Session Description
Some of the basic principles of
performance management apply to managers. The difference is what aspects of
their performance you are trying to measure and develop. When you were a
manager you needed to set clear goals, provide feedback, and lead team culture. Now you need to coach your
managers to do the same. Managing managers is an art. Learn the best ways to
develop and coach your managers into superstars like you.

Learning ObjectivesUnderstand and implement coaching techniquesUnderstand and plan behavior modelingUnderstand and use manager management conversationsBuild manager management plans MethodologyLectureDiscussion Target Audience
Leaders at all levelsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'2-Hour',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146438633.jpg','00032','active'),
('498529465','Managing Multiple Priorities & Your Time','This workshop is designed to help individuals to feel a greater sense of meaningful accomplishment at the end of a workday and to help organizations cut the human and financial costs associated with wasted time and efforts.

“I just don’t have enough time. I wish there were more hours in the day!” Our lives sometime leave a trail of incomplete tasks, haunting quiet moments. While extra time would relieve some of the pressures that people experience, their dilemma often involves confusion about priorities. Examining how you currently prioritize and use your time and then building simple techniques into your work schedule can help you to more effectively juggle competing demands, create more time for your truly important responsibilities, and decrease the stress, frustration, and guilt often associated with today’s workplace.
Who Should AttendAnyone who would like to take more control over how they use their time and what they do with it, managers trying to identify how to help themselves and their direct reports stay focused on priorities, intact teams looking for ways to more efficiently work together.
You Will LearnAfter this workshop, participants will be able to:Identify how they currently spend their timeIdentify and focus their energy on high-priority tasks and responsibilitiesDevelop and on-going check of their activities relative to their prioritiesNavigate multiple competing prioritiesEliminate or better manage their biggest time wastersUse their learnings to help others better manage their time and focus on prioritiesBe sure that they do not become somebody else’s time wasterParticipants are encouraged to complete a Time Audit for five consecutive workdays before the start of the workshop. While this is not mandatory, the Time Audit allows people to begin to uncover their improvement opportunities and to base discussions on actual data. Please send emailed requests for Time Audits to ptt@lynchburg.net, at least two weeks prior to the start of this workshop.
Course OutlineSetting PrioritiesInput/output analysisUsing a priority matrix to focus on priorities & eliminate distractionsIdentifying personal priorities to use as filtersHow to use energy levels to decide when to schedule activitiesHow to anticipate and accommodate uncontrollable eventsDiagnosing How You Currently Use Your TimeHow to conduct a personal Time AuditHow to analyze your Time Audit data to identify potential improvements & recommendationsCuring Time WastersSelf-generated time wasters (e.g., procrastination, perfectionism, disorganization, refusing to say “no,” unproductive travel time, lack of delegation)Environmental time wasters (e.g., drop-in visitors, the telephone, unnecessary or ineffective meetings, mail/email clutter, crises, negative attitudes)Identifying personal solutionsIndirect Goal SettingUncovering important, yet previously ignored wishesCreating goals & action plans to accomplish those missed opportunities

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301055855.jpg','00151','active'),
('841231306','Managing Organizational Performance','Covers goal-setting frameworks, performance measurement systems, and accountability mechanisms for government organizations. Includes techniques for aligning individual performance with organizational mission.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231306/5816039532.jpg','GGS-LMT-MOP','active'),
('496353059','Managing Remote and Hybrid Teams','Do you manage a team of talented individuals who now are trying to get things done from multiple locations? Even if some of your team members previously have worked a bit from home, this is different. Don’t let past flexible work arrangements lull you into a false sense of confidence. A remote team is still a team, but the changes, while subtle, are important. Participants in this session can learn how to acknowledge and capitalize on the differences. This session helps you to . . .

Demonstrate your supportCheck in regularlyEncourage your team membersBe a role model for your teamSet clear expectations and ground rules for working remotely

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'4-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300966253.jpg','00136','active'),
('487686047','Managing Up, Down, and Across','Session Description
Managers are constantly shifting
between situations that call for being in a leadership role and creating
assignments, to answering up and explaining results, all while being a
colleague that your peers can rely on. In this full day workshop participants will learn the 3 keys to making this happen successfully:
Learning ObjectivesDiscover what you need and how to get it from a boss to do your job with easeDiscover how to motivate the people who work for you to do what is neededDiscover how to effectively collaborate and partner with peers MethodologyLectureDiscussionIndividual reflection, paired and group exercises Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146439135.jpg','00033','active'),
('841231307','Managing Up: Working Effectively with Senior Leaders','Teaches practical strategies for building productive relationships with senior leaders and executives. Topics include understanding leadership priorities, communicating upward, managing expectations, and positioning ideas for success.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231307/5816039538.jpg','GGS-LMT-MU','active'),
('498558832','Mastering the Employee Performance Review Process','Performance Reviews or Appraisals offer potentially powerful conversations between managers and their team members. However, people often look at performance reviews with dread, as opportunities to tell people what they really think of them, as an annoying requirement from the HR Department, or to cut and paste old review comments to create new ones. With great planning, execution, and follow-up, performance reviews can make a difference.

How people perform is critical to organizational success. People are a business’ most important resource. Therefore, managers must pay attention to their people, how well people perform their jobs, and what managers can do to help their team members succeed. This workshop addresses necessary performance review tools and ideas to help managers take advantage of their team members’ talents, rather than taking them for granted.
What You Will Learn
After this workshop, participants will be able to:Identify and then reinforce factors leading to successful employee performanceHighlight employee successIdentify and then decrease barriers to effective employee performance and subsequent job satisfactionFocus employee performance efforts in the right direction, toward important goalsHelp team members to develop new skills and competencies
Course Outline
The purpose and benefits of performance reviews
Before the performance reviewThe role of documentationThe role of job descriptionsThe role of employee self-assessmentsAssessing employees fairly and accuratelyDuring the performance reviewCreating a supportive environmentGiving constructive positive and negative feedbackHaving difficult conversationsResponding to differences of opinion regarding employee performanceLeading performance discussionsAfter the performance reviewLeading ongoing performance coaching discussions

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301069379.jpg','00152','active'),
('498587576','Mentoring Essentials','Mentoring has existed, throughout history, as a tool for developing individuals’ talents and knowledge and as a tool to pass along critical business information from current managers to select employees, so that future managers and leaders can begin to expand their areas of expertise. Until recently, however, managers mistakenly believed that effective mentoring relationships resulted from luck or a special chemistry between Mentor and Mentee. Organizations now have realized that a well-designed, facilitated mentoring program can produce meaningful results for everyone from intelligent but inexperienced new hires to mature employees who need to broaden or redefine their skills.

Whether you serve as a Mentor or Mentee and whether you plan to coordinate a larger mentoring program or just want to know how to develop your own personal skills, this workshop will offer you the nuts and bolts for how to give the most to and how to get the most out of mentoring relationships. We will explore a mentoring model, covering how to recruit and select Mentors and Mentees, how to make the best match, how to establish clearly defined Mentor-Mentee expectations, and how to measure mentoring return on investments.
Who Should AttendMentor Program Coordinators looking to start a new or revise an existing mentoring program, current or future Mentors and Mentees.
You Will LearnAfter this workshop, participants will be able to:Differentiate between mentoring and coachingDetermine what type of mentoring relationship fits your needsAppreciate what effective Mentors and Mentees doUnderstand the payoffs of mentoring relationshipsAvoid common mentoring pitfallsDesign a facilitated mentoring program for your organizationCreate a plan for recruiting, screening, identifying, and training Mentors and MenteesMatch Mentees with appropriate MentorsCreate a development plan for Mentees and a negotiated agreement with clearly defined expectations and action plans for both partiesEffectively involve Mentees’ direct supervisors, who do not serve as Mentors, in the mentoring processMeasure whether mentoring is making a difference
Course OutlineMentoring IntroductionThe difference between mentoring and coachingThe levels of mentoringMentoring benefits to the organizations, Mentors, and MenteesWhat Mentors and Mentees actually doAn overall mentor program modelMentoring Plans
How to recruit, select, and match Mentors and MenteesHow to include Individual Development Plans when making matching and planning decisionsHow to decide how much to invest in mentoringHow to establish clear Mentor-Mentee expectations for the relationship and how to be sure that each will benefitMentoring InteractionsHow to gather, give, and assess necessary information regarding situations in which Mentees seek tailored Mentor guidanceHow Mentors confront and how Mentee’s accept Mentor confrontations of the Mentee’s actions and decisionsHow to utilize the Mentor’s experiences and wisdomHow to be sure that Mentees leave discussions with thoroughly assessed plans of action

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301055871.jpg','00153','active'),
('841231308','Mentoring in the Federal Workplace','Explores the roles, responsibilities, and best practices of effective mentoring relationships in the federal government. Covers formal mentoring programs, informal mentoring strategies, and cross-generational mentoring.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231308/5816039544.jpg','GGS-LMT-MFW','active'),
('487103171','Mid-Career Retirement Planning (5-20 years of Government service)','Course Description
The Mid-Career Retirement Planning Seminar (for Federal employees with 10-15 years of service) takes a decidedly financial planning approach to inform attendees about the complex array of benefits available to them as Federal employees and the choices they need to make to best leverage them within the context of their overall financial and retirement plan. Special attention is paid to developing good financial and retirement goals and using sound investment strategies for best leverage their TSP.

Course ObjectivesAfter attending this seminar, attendees will know how set retirement savings goals, when they are eligible to retire, which provisions of retirement law affect the computation of their retirement benefits, and how much those benefits are likely to be (FERS, Social Security, and TSP). They will have a sense of the choices they will need to make regarding survivor benefits, their health (FEHB) and life insurance (FEGLI) coverages, and their TSP funds. Finally, they will understand how their Federal employee benefits fit within the overall construct of a financial plan.

Course OverviewThe mid-career seminar for FERS employees is a fast-moving information loaded session that opens with lessons on investment and retirement planning, and the TSP. It moves from there to the history of the Federal retirement programs, what constitutes credible service for retirement purposes, eligibility for retirement, and the computation of FERS annuities and survivor benefits. It thoroughly covers Social Security, Estate Planning and concludes with an important lesson on how the best leverage Federal benefits going forward. The seminar will focus on Federal retirement benefits and how they can be affected by the financial decisions attendees are making now and in the future.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Retirement Planning & Financial Literacy',ARRAY['Retirement Planning & Financial Literacy','Human Capital Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495357015.png','00020','active'),
('498613981','Motivating Employees','Motivating employees to achieve their potential and keeping them motivated and tuned into the organization’s goals are significant challenges for businesses. Managers depend on their workers. Without motivation, there is no change, no learning, no action, and no results.

This workshop offers practical techniques, strategies, and exercises for managers to help them motivate unmotivated employees and to maintain higher levels of motivation with everyone else. This workshop allows participants to find out what really motivates themselves and others at work, how to create an atmosphere that pulls up employees rather than pushing them down, and how to identify what people really need and give rewards that meet workers’ unique needs. Once workers feel confident that their employer and their workplace are what they had desired and expected, they are ready to contribute above and beyond “the call to duty.”
Who Should AttendAnyone in management or anyone who is being prepared for management positions who is responsible for overseeing the performance of others at work.
You Will LearnAfter attending this workshop, participants will be able to:Avoid the ten commandments of motivational failureClear up common myths about how to motivate peopleGive rewards that meet people’s needsUse “the little things” that people typically take for granted to motivateUnderstand the difference between things that help workers want to do better and things that simply keep them on the jobWatch the choices workers make to better understand what motivates themAlign people’s rewards with their individual needsMotivate the motivator
Course Outline
Introduction to MotivationDefining motivationClearing up common myths about employee motivationThe 10 Basic Principles required for MotivationAssessing Motivation LevelsMotivation self-assessmentSigns & symptoms of a motivated and an unmotivated employeeSeparating symptoms from root causesWhat Impacts Motivation
Hierarchy of basic and typical employee needsUnderstanding the organization’s personalityHow to Detect What Motivates Individual EmployeesGetting inside the individual without surgeryHow to support employees to motivate themselves at work

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301069394.jpg','00154','active'),
('491768656','Motivation at Scale','Session Description
When you were a manager it was
hard enough to motivate individuals. As a senior leader you must now see
motivation at a systemic level. Is it possible to drive engagement and motivate
people at scale? It starts by assessing your organization’s current motivational
state and learning what levers you can pull to move the needle. 

The course will teach you how to
recognize burnout, disengagement, and systemic entropy, while helping you plan
ways you can right the ship and ignite passion and purpose in your people. 

Learning ObjectivesUnderstanding the symptoms of systemic demotivation and how to diagnose their root causesUnderstanding what options are available to you to reignite passion for your organizationBuilding an action plan to improve culture and revive motivation and purpose across your organization Methodology
LectureDiscussionTarget Audience
Senior Leaders','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146439210.jpg','00059','active'),
('501782482','Navigating Difficult People','Two Day Class OverviewAfter participating in this class, learners will be able to:Identify work-related situations in which they encounter difficult peopleDescribe the words and actions demonstrated by difficult peopleExplain the impact that difficult people and situations have on learners and the quality of their workDetermine the root causes for challenging behaviors and interactions and how this information can help learners respondCreate a step-by-step plan for how to respond to a difficult person or work situationMaintain more control of learner emotional reactionsConstructively respond to anger in othersEmpathize with others and develop greater understanding about the perspectives of those with whom learners experience these challengesUse constructive feedback to effectively share learners’ reactions to and perceptions of their difficult encountersDemonstrate active listening to create greater shared understandingBuild or expand rapport and trust with coworkers to help minimize interpersonal difficultiesShow respect and appreciation for coworkers and their perspectives to reduce challenging work relationshipsMap what learners can control, influence, and must accept or overcome in difficult situations involving othersIntentionally select which of five optional reaction styles fit any give difficult interpersonal conflictIdentity common ground, when it exists, and then create resolutions to interpersonal conflictsKnow when to involve a third party to help create or mediate solutionsDemonstrate tact within learners’ conversationsBetter understand the role of body language or nonverbal behaviors during difficult conversationsManage coworkers’ unwillingness to consider others’ opinions and ideas

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301317074.jpg','00166','active'),
('841231309','Navigating Organizational Politics','Equips leaders with the awareness and skills to work effectively within the political landscape of government organizations. Topics include stakeholder mapping, coalition building, influence without authority, and ethical navigation.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231309/5816039550.jpg','GGS-LMT-NOP','active'),
('501773456','Negotiating for Results','Whether you''re hammering out the details of a multimillion-dollar business deal, allocating responsibilities among your project team members, trying to reach an agreement with someone who possesses a different perspective or position on a certain topic, or just haggling over where to order takeout, you''re negotiating. And the better you do it, the more likely you and the other party will be happy with the outcome. This ½ -day session addresses the basic components of successful integrative negotiation for win-win outcomes.

What You Will LearnAfter this workshop, participants will be able to:Better prepare for negotiationsBuild relationships through negotiationsExplain how to increase their understanding others’ points of viewMaintain flexibility during negotiationsIncrease self-confidenceCourse Outline
Negotiation StylesThe Persuasion Tools ModelDeveloping Negotiation StrategiesThe Negotiation MatrixPlanning for NegotiationsIdentifying issuesEstablishing preliminary objectives5 Steps in the Negotiation ProcessThe anatomy of the negotiation sessionManaging the negotiation session

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301070612.jpg','00155','active'),
('491769652','Offering Developmental Feedback','Session Description
Feedback is an essential tool for
creating further awareness for individual, community, and organizational
effectiveness and learning. It is also
one of the significant tools of a skillful coach. 
Ongoing feedback in coaching is used to reinforce a client''s desired behaviors
and new skills, to motivate the client to pursue higher levels of performance,
as well as to highlight the discrepancies between the current state and desired
state.
In this session, we will be
discussing common feedback mechanisms and how to offer effective developmental
feedback. Whether you are interested in developing your feedback skills as a
coach or as a mentor, this session might be supportive of your learning on how
to effectively use feedback to create self-awareness towards intrinsic
motivation and change. 
Learning ObjectivesDiscuss styles of feedback and their effectivenessUnderstand how to offer developmental feedback Methodology
LectureDiscussionQ&ATarget Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Leading Teams',ARRAY['Leading Teams']::text[],'1-Day',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146441520.jpg','00058','active'),
('841231340','Organizational Conflicts of Interest','This course examines the rules and regulations surrounding organizational conflicts of interest (OCI) in federal contracting. Participants will learn how to identify, avoid, neutralize, and mitigate OCIs to ensure fair and objective contract awards.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],NULL,'GGS-FAC-013','active'),
('492002100','Organizational Reinvention: Maximizing Human Creative Potential and Contribution in Your Workplace','Session Description
Organizational Reinvention refers
to a globally emergent management model that maximizes individual contribution
and team productivity. The operational goal is to liberate the latent creative
power of human beings in the marketplace in such a way that personal,
professional and organizational development are parts of the same
self-generating continuum. 

This program is for
organizational change-agents whose vision for the future includes reinventing
their approach to management: managers,
supervisors, and executives – or any contributor wanting to maximize their leadership
impact.

Learning Objectives
Experience this phenomenon by taking a close look at 3 companies who have operationalized these ideas to consider how to develop these practices yourself. Understand 6 principles these vanguard companies employ: Ownership, Markets, Meritocracy, Community, Openness, ExperimentationApply 2-3 principles and define with precision how to begin to validate these ideas through “safe to fail”, disciplined experiments. 
 
 
 
 
 
 
 
 
Methodology
Self-assessmentLectureSmall and large group discussionReflection and planning 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Supervisory to mid-level leadersHigh-potential individual contributors','Business Planning and Project Management',ARRAY['Business Planning and Project Management']::text[],'4-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146441569.jpg','00092','active'),
('501773457','Overcoming Negativity in the Workplace','Workplace success begins with a state of mind. People typically behave in alignment with their attitudes, thoughts, beliefs, assumptions, expectations, and emotions. Therefore, keeping an eye on what people are thinking or how they are feeling about work can play a significant role in both individual and the collective accomplishments of your team.

Although negativity at first may seem just annoying, it can spread quickly through a team or organization, resulting in higher staff turnover, absenteeism, low morale, distrust, decreased productivity, and resistance to new ideas or to change. An individual’s or team’s mindset often come from “the top,” managers and other influential people inside and outside their team. Therefore, this workshop will help participants look at their own attitudes, as well as the attitudes of their teams. This workshop is not designed to cure all that gets in the way of productive and satisfied employees. This workshop offers participants a way to understand, manage, and positively impact the way they respond to their own and others’ negativity while at work.
Who Should AttendAnyone interested in stamping out negativity work, including any formal or informal leaders and all levels of management and supervision.
You Will LearnAfter this workshop, participants will be able to:Assess participants’ own degree of positive or negative thinkingBuild trust between themselves and others and within their teamsHelp people turn negatives into positivesReshape the way participants and team members perceive situationsExplain how thoughts impact the interpretation of eventsRecognize negativity “trigger points”Stay positive in a negative work environmentManage participants’ emotions at workMore effectively manage people who see work in a negative lightPositively harness pessimismCourse Outline
Self-Awareness“Attitude” self-assessmentStaying positive in a negative environmentManaging your emotionsBuilding TrustBuilding trust accounts with coworkers13 trust-building behaviorsThe Attitude VirusTypes of negativityConstructively discussing a team member’s negativity with the team memberRoot Causes of NegativityRoot cause analysisThe Betari BoxReshaping ThinkingCognitive RestructuringThought AwarenessManaging PessimistsStrategies for working with someone you don’t like

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301070622.jpg','00156','active'),
('501784647','Partnering with Your Boss: Managing Upward','How is your relationship with your boss? Do you work constructively and collaboratively together? Does your manager support and inspire you? Your direct manager likely has multiple projects pulling them in multiple directions, so this workshop helps participants take the initiative and make the effort to create, maintain, and expand an effective working relationship with their manager/s. In addition, building great relationships with other powerful, more senior people in your organization can help, especially when you need their support for your projects. This workshop is not about “sucking up” to managerial team members. It’s about learning techniques and strategies that can help you to work successfully with them: how to manage upwards.

What you will learn:After this workshop, participants will be able to:Develop and expand a good working relationship with their direct managersUse strategies to help them to effectively “manage upwards”Analyze their managers’ preferred styles of working and adapt their practices to help them create smooth working relationshipsIdentify what they and their managers have in commonIdentify any areas of friction and how to minimize the frictionKeep their managers “in the loop”Consistently anticipate their managers’ needsGain or expand the respect of their managers and be taken seriouslyBe seen by their managers and others as a valuable professional resourceIdentify and understand other powerful people or personal stakeholders with whom they work, people who can influence participants’ workEmploy strategies to make the most of these relationships with others, so they can advance their careers in the best possible way and have strong networks of alliesConstructively deal with “unreasonable” requestsBuild working relationships based on a firm foundation of trust

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301068198.jpg','00157','active'),
('841231291','Past Performance','Learn how to use past performance information effectively in source selection. Covers the collection, evaluation, and documentation of past performance data in accordance with FAR requirements and OMB guidance.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231291/5816036198.jpg','GGS-PP','active'),
('501782590','Performance Management','Performance management reflects a changing emphasis, away from command-and-control toward a facilitative model of management. Performance managers and their employees are being asked increasingly to move beyond traditional, narrowly defined job descriptions to support team objectives and goals. This workshop is designed to help participants more effectively make and reinforce this transition.

The ability to coordinate the performance of others at work is a key management task. This workshop is designed to help managers develop a process for getting colleagues to take on new or additional tasks and for constructively monitoring and adjusting their subsequent performance of those tasks.
Who Should AttendAnyone in management or anyone who is being prepared for management positions who is responsible for overseeing the performance of others at work.
You Will LearnAfter attending this workshop, participants will be able to:Define performance management and its relationship to setting performance objectives and meeting performance standardsOutline the benefits of performance managementWork collaboratively with employees to address performance issuesDiscuss job performance with employees, provide feedback on strengths and needed improvements, and create performance plansAssess what is influencing employee performanceWorkshop Outline
Performance Management OverviewCreating a collaborative approach to performancePerformance management pitfalls and benefitsPlanning PerformanceSetting standards for performance and performance objectivesHow to communicate task parameters with employeesHow managers and their direct reports create a shared understanding of work objectivesHow to involve employees in performance planningHow to identify obstacles to performanceHow to create a set of shared and supportive expectations for performanceManaging PerformanceMonitoring employee performanceWhere and how to document performanceHow to assess the dataUsing data to assess performance gaps, either exceeding or not meeting standards and expectations

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301057914.jpg','00158','active'),
('491791407','Performance Management 101','Session Description
Accountability is at the core of
performance, but we can’t get there without a strong start. Performance
management is a fine blend of art and science. We must understand the basics of
a performance management system, understand goal-setting, and how to give
feedback where and when it is needed. 
This course covers all of the
fundamentals to build or strengthen your approach to performance management. 

Learning ObjectivesUnderstand performance management systemsBuild or strengthen your existing performance management processGiving and receiving feedbackUnderstanding feedback cadences Methodology
LectureDiscussionTarget Audience
Supervisory to mid-level leadersHigh-potential individual contributors','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146439991.jpg','00060','active'),
('841231310','Personal Resilience','Builds individual resilience skills to help government employees thrive during periods of uncertainty and organizational stress. Covers stress management techniques, building a growth mindset, and recovery from setbacks.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231310/5816039551.jpg','GGS-LMT-PR','active'),
('487677118','Polarity Thinking: A Powerful Tool for Increasing Leadership Capacity','Session Description
One of the key qualities of
higher capacity in leaders is both/and, integrative thinking. This practical,
hands-on workshop will introduce you to polarity mapping, the most effective
way to actively build this capacity.
Most leadership trainings focus
on acquisition of leadership competencies rather than an increase in actual
leadership capacity. Leadership capacity is the ability to think and act more
effectively in times of increasing VUCA (volatility, uncertainty, complexity,
ambiguity) and rapid change. 
See this short summary for more
details on this vital but little-understood distinction: Leadership
Development is About Capacity, Not Just Competencies (trainingindustry.com) or
this longer article for a deeper dive into this topic: Leadership
Development — It’s About Capacity, Not Just Competencies | by Clear Impact
Consulting Group | Medium. This
training session will highlight the power of Polarity Thinking (both/and rather
than either/or) to build sustainable collective and individual capacity.

Learning ObjectivesUnderstanding the concept of leadership capacity - the ability to think and act more effectively in times of increasing volatility, uncertainty, complexity, ambiguity (VUCA) and rapid changeUnderstanding how both/and, integrative thinking is a critical component for dealing more effectively with complex leadership challengesLearning, practicing, and applying the tool of polarity mapping, first in small groups and then individuallyBuilding a reflective practice to apply back in the workplace MethodologyEngaging presentation with rich dialoguePractice at the full-group, small-group and, then, individual levelsIndividual reflection, application, and development of an action plan Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146444070.jpg','00034','active'),
('841231323','Post-Award Grants Management','Focuses on the post-award phase of the federal grants lifecycle, including progress reporting, budget modifications, prior approval requirements, and managing contractor and subrecipient relationships.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231323/5816039628.jpg','GGS-GMS-PAGM','active'),
('491957488','Power of Listening','Session Description
By becoming a good listener we
can build stronger relationships and gain new ideas and inspiration. Most people think that they are a good
listener, but what would their
colleagues, clients, family and friends say about them?
Often we think we are listening
when we are in fact only going through the motions with our attention drifting
elsewhere. 
 Yet, being a good listener is
amongst the most powerful and underrated communication skills. Used
effectively, it helps to build relationships (and fix broken ones), pre-empt
arguments, gain gravitas and persuade others round to our point of view. It’s something
we can all do, and something most of us can do a lot better.
Learning Objectives
Differentiate listening from hearingIdentify the benefits of active listening Identify poor listening habitsLearning and implement skills used for active listening Identify barriers to effective listening Practiced a number of techniques to train yourself to listen more effectively, whatever the internal and external distractions 
 
 
 
 
 
 
Methodology
LectureDiscussion 
 
Target Audience
Leaders at all levels','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146453747.jpg','00081','active'),
('841231324','Pre-Award Grants Management','Covers the pre-award phase of federal grants, including needs assessment, funding opportunity analysis, application development, budget preparation, and compliance with pre-award requirements under 2 CFR Part 200.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231324/5816039634.jpg','GGS-GMS-PRAM','active'),
('496091569','Preparing for Principled-Centered Negotiation: When You Want Both Sides to Win','Assessing the important variables before the negotiation.Digging for and uncovering any common ground for a collaborative outcome.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291319778.jpg','00132','active'),
('501763745','Presentation and Briefing Skills','Today''s quick-paced and fluid work environment can mean fast and frequently unexpected organizational changes, greater responsibilities, and new projects and initiatives. Being a confident, polished speaker is not only necessary, but well advised to communicate such matters effectively and persuasively. This workshop offers presentation tips and strategies to help you develop your presentation skills and learn how to present your ideas with conviction, control, and poise—and without fear. You’ll gain the specific presentation skills and direction you need to become comfortable with your own style. And you’ll receive expert advice on how to handle especially challenging situations.

Who Should AttendEveryone who needs to develop their presentation skills, speak in front of groups, or sell ideas to others. Anyone with little or no presentation experience, as well as more experienced presentations looking to brush-up on their skills and fine tune their presentation style.
What You Will LearnAfter this workshop, participants will be able to:Tailor presentations to their diverse audiencesUse relaxation techniques to overcome nervousnessExpertly handle difficult questions and situationsCommunicate with clarity and convictionGain confidence in their presentation skillsCourse Outline
Balancing Verbal and Nonverbal MessagesPractice nonverbal impact skills to reduce nervousness and to engage the attention of your listenersMake your content clearer and more memorableDeveloping and Organizing Presentation ContentCreate an audience profile and set presentation parametersCondense a speech outline into notes you can speak fromPreparing to Give the PresentationGet expert presentation tips on rehearsing, adhering to a time frame and speaking from notesReduce stress and speaker’s anxietyUsing Visual Aids and Support MaterialsDescribe the purpose of visual aids and support materialsIdentify tips for effective composition of visual content and speaker aidsHandling Questions from the AudienceExplain the importance of the question-and-answer sessionRespond professionally to questions from the audienceManaging the Presentation EnvironmentDescribe the advantages and disadvantages of different room setupsBe able to anticipate, avoid and handle equipment problems

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301298990.jpg','00167','active'),
('491992485','Principles of Leadership Communication','Session Description
The best leaders know that being
a skilled communicator is one of the most important skills in leading
organizations to success. And we don’t mean being a good talker! Leadership
communication is as much about listening and provoking thinking as it is sharing
your expertise.
This course will give you
communication tools to help you best develop and cascade your vision widely
across the organization. 
Learning Objectives
Understanding executive presenceLeadership questioning techniquesCascading vision 
 
 
 
 
 
 
 
Methodology
LectureDiscussion 
 
Target Audience
Supervisory to mid-level leadersHigh-potential individual contributorsProject/Program managers','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146452996.jpg','00082','active'),
('841231311','Problem Solving Tools and Techniques','Introduces a range of structured problem-solving methodologies applicable to government contexts. Participants practice root cause analysis, fishbone diagrams, gap analysis, and collaborative problem-solving facilitation.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231311/5816039562.jpg','GGS-LMT-PSTT','active'),
('841231341','Procurement Ethics','This course covers the ethical standards and regulations that govern federal procurement activities. Participants will learn about the laws and rules that prohibit unethical conduct in the acquisition process and understand the consequences of ethical violations.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231341/5816040060.jpg','GGS-FAC-015','active'),
('711500802','Program Management','Program Management
 
Learn best practices for effective program management, including making decisions that accomplish strategic objectives and managing change and risks. A hands-on experience will give you the tools and practice you need to build your expertise and realize program success. This course is in alignment with The Standard for Program Management as defined by the Project Management Institute (PMI).
Learning Objectives
Define standard industry and government terminology describing Program Management conceptsIncrease effectiveness and efficiency as a program manager in a federal environmentIdentify success factors at each step in the program lifecycleApply effective leadership strategies for program managementConduct program formulation, using best practices, to ensure strategic alignmentEstablish and maintain appropriate stakeholder engagement and communication at multiple levelsProduce integrated program plans to ensure program objectives can be metManage programs successfully to ensure maximum benefit achievementClose out a programCourse Topics
Introduction to Program Management
What is a Program?What is Program Management?Projects, Programs, and PortfoliosLifecyclesRole and Responsibilities of the Program ManagerThe Program Manager as Leader
Leading a ProgramHow is Leading a Program Different from Leading a Project?Leadership Qualities Needed by the Program ManagerExercise: Assessing Leadership EffectivenessProgram Formulation
What is Program Formulation?Program Business CaseThe Program CharterStakeholder Engagement and Program Governance
Stakeholder EngagementProgram GovernanceProgram OversightProgram Planning
What is Program Planning?The Program RoadmapThe Program Management PlanProgram Delivery
Program Delivery PhaseProgram ResultsProgram Closure
Program Closure DefinedProgram AcceptanceRecognizing Program Achievement','Project & Program Management',ARRAY['Project & Program Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4657983374.jpg','00204','active'),
('711477183','Project Management Principles','Project Management Principles
Gain a thorough understanding of how to practically apply project management concepts that will equip you to effectively and successfully define, plan, manage, and close out projects. Through informative content, hands-on activities, class discussions, and a threaded case study, you will explore the tools, techniques, and working practices associated with successful project management. This comprehensive foundational course focuses on the project management principles aligned with A Guide to the Project Management Body of Knowledge (PMBOK® Guide) and many of the GAO guides.
Learning Objectives:
Define project management key terms and fundamental conceptsDefine the project and produce a project charterReview project management plan elements and project documentsSelect a development approachDevelop a communications management plan based on stakeholder''s needsDefine detailed scope using a work breakdown structure (WBS)Determine project estimatesCreate a realistic, defensible project scheduleDevelop a project budgetCreate a project risk registerPlan for project changeEstablish and obtain acceptance for project baselinesManage and communicate project performance resultsPerform closing processesCourse Topics
Introduction to Project Management
What Is a Project?What Is Project Management?Programs, Portfolios, and OperationsFundamental Concepts in Project ManagementResponsibilities of the Project ManagerDefining the Project
Starting the ProjectProject CharterExercise: Create a Project CharterTeam CharterProject Planning Overview
Project Planning IntroductionThe Project Management Plan (PMP)Development ApproachesExercise: Choosing Development ApproachesStakeholders and Communications Management
Stakeholder ManagementExercise: Develop a Stakeholder RegisterCommunicationsPlanning Project CommunicationsExercise: Develop a Communications MatrixDeveloping the Work Breakdown Structure
Progressively Elaborating ScopeRelationship between Scope and WorkThe Work Breakdown Structure (WBS)Exercise: Develop a WBSScope Management PlanProject Estimating
Project EstimatingEstimating MethodsEstimating Best PracticesDocumenting and Validating EstimatesExercise: Project EstimatingDeveloping the Initial Project Schedule
Project SchedulesStep 1: Determine Activities and MilestonesStep 2: Sequence the Activities and MilestonesStep 3: Assign ResourcesStep 4: Estimate Effort and DurationStep 5: Develop the Schedule and Identify the Critical PathStep 6: Portray the ScheduleExercise: Reviewing a Project ScheduleSchedule Management PlanDeveloping the Project Budget
The Project BudgetEstimating Project CostsCommunicating the Project BudgetExercise: Identifying Cost CategoriesCost Management PlanPlanning for Risk
Project RiskRisk ManagementStep 1: Plan for RiskStep 2: Identify RisksStep 3: Assess and Rank RisksStep 4: Determine Appropriate ResponsesStep 5: Update Impacted Plan ComponentsProject Baselines and Change Control
Project BaselinesProject ChangeChange Management Plan','Project & Program Management',ARRAY['Project & Program Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4657982099.jpg','00205','active'),
('490382359','Proofreading','Course Description
TBD
Course ObjectivesTBD
Course OverviewTBD.
Contact Joy Smith Stone, Training Coordinator at jstone@gothamgovernment.com or (828) 750-5994 for more information or to schedule this or any of GGS’s other writing courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146457611.jpg','00039','active'),
('676077734','Proposal Evaluation/Source Selection Training (2-days)','Questions? Contact our training coordinator via email or phone at (202) 843.5447.

Course DescriptionThe Proposal Evaluation and Source Selection training course is designed to provide acquisition professionals, including those holding FAC-C, FAC-COR, and FAC-PPM certifications, with the skills and knowledge necessary to effectively evaluate proposals and make informed source selection decisions. Aligned with the continuous learning goals for these certifications, the course covers best practices, regulatory requirements, and practical techniques to ensure a fair and transparent selection process. Participants will engage in interactive lectures, case studies, and hands-on exercises to develop and refine their evaluation and selection skills.
Course Objectives
 Understand the regulatory framework and policies governing proposal evaluation and source selection.Learn the roles and responsibilities of evaluators and selection officials.Master the techniques for developing evaluation criteria and rating proposals.Ensure compliance with ethical standards and avoid conflicts of interest.Apply best practices in conducting evaluations and making source selection decisions.Enhance skills through practical exercises and real-world case studies.
This training course equips acquisition professionals with the essential skills and knowledge to conduct effective proposal evaluations and make sound source selection decisions, ensuring compliance with federal regulations and contributing to successful procurement outcomes.

 
 Schedule a class or get more information! Contact Joy Stone at jstone@gothamgovernment.com or Sherelle Abernathy at sabernathy@gothamgovernment.com for more information or to schedule this or any of GGS’s other Professional Acquisition and Contracting Training Series courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],NULL,'00197','active'),
('491791409','Psychological Dimensions of Leading and Supervision','Session Description
One of the functions of
leadership is to motivate people to accept responsibility and to be more
autonomous in pursuing shared goals and in meeting their own, and others’,
needs in the workplace. Participants gain insight into how to recognize
and manage psychological aspects of group functioning to reduce the negative
effects of deep emotions, such as fear, on group and individual behavior
and workplace performance. They gain self-awareness and practice,
articulating and advocating for themselves and others. 
In doing so, they learn how to
recognize, and avoid, counterproductive behaviors (e.g. blaming, scapegoating) that can
disrupt cooperative efforts to achieve shared aims.

This course is intended for
employees in leadership and supervisory roles – or for high potentials who
already carry responsibility and seek to advance into such roles. Through
experiential group learning and reflective exercises, participants acquire a deeper
understanding of latent group dynamics that can inhibit, or support, group
cohesion. 

Learning ObjectivesUnderstand how unconscious individual and group processes influence motivation and decision-making in the workplaceUnderstand the psychological defense of projection and how it plays into group dynamics such as scapegoatingIdentify aggressive and passive (e.g. fight vs. flight) approaches to handling workplace challenges and faulty group processesLearn ways to facilitate inclusiveness to gain the benefits of group synergyEnhance the ability to persuade and influence others, and to advocate to meet needsGain insight and skills to manage workplace conflict constructively Methodology
LectureDiscussionSelf-assessmentExperiential simulationTarget Audience
Supervisory to mid-level leadersHigh-potential individual contributors','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146457681.jpg','00061','active'),
('491769673','Psychological Safety: Un-Managing your Team to Increase Ownership and Innovation','Session Description
Psychological Safety defines a
shift in managerial mindset and skillset that increases trust, safety and
inclusion. This shift unleashes the creative potential of your team by
neutralizing the single biggest constraint to that potential -- fear. Often our unconscious, negative patterns of
communication and behavior as leaders have a distinct and immediate
impact on those around us. Those messages then become amplified by
organizational culture.

The result is that people do not
feel it is safe to bring their whole self to the job. You may have their hands,
and some of their heads, but they are reluctant to give you their heart. An
enormous amount of productivity, ownership and innovation are lost when that
happens.

Learning ObjectivesThis program is for leaders in an organization who want their teams to out-perform. Participants will learn the measurable tax an unsafe environment extracts from their organizations, and the mindsets and behaviors that increase safety and productivity. They will gain insights and ideas for action around 4 dimensions:
 1.Inclusion Safety 2.Learner Safety 3.Contributor Safety 4.Challenger Safety Participants will leave with a practical set of tools to apply to model and coach inclusive behavior, and to create thriving workplaces.
 Methodology
Self-assessmentCase study analysisRole-playLecture with interactive discussion 
Target Audience
Supervisory to mid-level leadersHigh-potential individual contributors','Leading Teams',ARRAY['Leading Teams']::text[],'4-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146456659.jpg','00062','active'),
('496091570','Recognizing Cognitive Bias: How Perception Becomes Reality at Work','Typical types of biased thinking and how to avoid them.Increasing critical thinking through the Ladder of Inference when decision making or problem solving.

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Learning & Development',ARRAY['Learning & Development']::text[],'2-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3291319819.jpg','00133','active'),
('487121566','Retirement Planning for CSRS or FERS or CSRS/FERS Combined','Course Description
Retiring from a Federal career is a confusing time and can be a daunting task. Retirement in general is a significant transition for anyone. The Retirement Planning Seminar for CSRS, FERS or combined, is designed for employees nearing retirement (within 5 years) and informs attendees about the complex array of benefits they have earned, the choices they need to make as they retire, and how to best leverage them within the context of their overall financial and retirement plan.

Course ObjectivesAfter attending this seminar, attendees will understand the basic financial planning concepts pertinent to retirement as a Federal employee. They will understand the overall Federal retirement process and know when they become eligible to retire, which provisions of retirement law affect the computation of their retirement benefits, how much those benefits are likely to be (CSRS or FERS, Social Security, and TSP), what choices they will need to make regarding survivor benefits, their health (FEHB) and life insurance (FEGLI) coverages, and their TSP funds.

Course OverviewThis Retirement seminar, for either CSRS/CSRS Offset or FERS employees, begins by establishing the basic financial planning concepts necessary for a successful retirement, and reinforces these concepts in succeeding lessons on history and financing of the Federal retirement programs, eligibility requirements, and benefit computations. It also thoroughly covers survivor benefits, social security, and the Thrift Savings Plan, and well as all of the Federal employee insurance programs. Woven among and supporting these lessons are applicable modules on financial and retirement planning, investing and related topics. The seminar is also designed to effectively convey key points and answer questions on a wide range of topics that cover basic retirement eligibility and benefits, and touch on the emotional and psychological aspects of retirement. The seminar will focus on Federal retirement benefits and the impact of financial decisions on those benefits after retirement.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Retirement Planning & Financial Literacy',ARRAY['Retirement Planning & Financial Literacy','Human Capital Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495351449.png','00019','active'),
('492002025','Run Meetings the Right Way','Session Description
“Oh joy, another meeting that
should have been an email.” If you’ve said this to yourself before, you were
probably right. But how can you be sure people don’t say that about your
meetings?
Take this crash course in running
effective meetings. By the end, your meetings will be productive, efficient,
and start and end when they should. Imagine living in that world!
Learning Objectives
Understanding when it should be an email? Understanding how to plan meetings right the first timeUnderstanding meeting roles and how to use themDesigning a meeting template 
 
 
 
 
 
 
 
 
Methodology
LectureDiscussion 
 
Target Audience
Supervisory to mid-level leadersHigh-potential individual contributorsProject/Program managers','Communication',ARRAY['Communication']::text[],NULL,ARRAY['Live online','In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146460500.jpg','00083','active'),
('487121567','Separating or Early-Out Federal Employees','Course Description
Working careers have changed in America in that many people no longer pursue a single career working in the same business or for a single employer. Many people now have a work life comprised of several careers in a range of businesses, working for numerous employers, of which Federal service will be a portion. Understanding Federal benefits in this new environment and the implications of leaving Federal service before their normal retirement age are now issues many workers must address. This seminar for Separating or Early-Out Employees explores the decisions employees need to make as they consider leaving Federal service, or accepting early retirement offers, or experiencing discontinued service retirement.

Course ObjectivesAfter attending this seminar, attendees will understand the basic vesting and eligibility rules for FERS retirement benefits and the TSP, the implications of taking a refund of FERS contributions, moving their TSP funds to an outside retirement plan, and accepting an offer for early retirement or retiring under the discontinued service provisions of FERS.

Course OverviewThis seminar for Separating or Early-Out Employees includes lessons addressing the Federal retirement and benefits programs and how these benefits fit within the overall framework of a personal financial plan. The seminar will specifically focus on Federal retirement benefits and how they can be affected by the financial decisions attendees are making now and in the future.

Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Human Capital Management',ARRAY['Human Capital Management','Retirement Planning & Financial Literacy']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3480009557.png','00022','active'),
('841231293','Simplified Acquisition Procedures','Covers the rules and best practices for acquisitions at or below the simplified acquisition threshold. Topics include purchase cards, micro-purchases, blanket purchase agreements, and streamlined procedures under FAR Part 13.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231293/5816036204.jpg','GGS-SAP','active'),
('676076414','Simplified Acquisition Procedures (SAP) Training Course (2-days)','Questions? Contact our training coordinator via email or phone at (202) 843.5447.
Course DescriptionThe Simplified Acquisition Procedures (SAP) training course is designed to provide acquisition professionals with a comprehensive understanding of the principles, policies, and procedures associated with simplified acquisitions. Aligned with the FAC-C Continuous Learning Goals, this course aims to enhance the skills and knowledge required to effectively utilize simplified acquisition methods to meet government procurement needs. Participants will engage in interactive lectures, practical exercises, and case studies to ensure they can apply SAP principles in their daily work.
Course ObjectivesUnderstand the regulatory framework governing Simplified Acquisition Procedures.Learn the criteria and thresholds for simplified acquisitions.Master the procedures for conducting simplified acquisitions, including market research, solicitation, evaluation, and award.Identify best practices for ensuring compliance and maximizing efficiency in simplified acquisitions.Enhance skills in using electronic procurement systems and tools.Apply SAP principles through hands-on exercises and real-world scenarios.This training course will equip acquisition professionals with the essential skills and knowledge to effectively use Simplified Acquisition Procedures, ensuring they meet the procurement needs of their agencies efficiently and in compliance with regulations.

 Schedule a class or get more information! Contact Joy Stone at jstone@gothamgovernment.com or Sherelle Abernathy at sabernathy@gothamgovernment.com for more information or to schedule this or any of GGS’s other Professional Acquisition and Contracting Training Series courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],NULL,'00195','active'),
('841231325','Single Audit Requirements for Federal Awards','Provides a comprehensive overview of the single audit requirements under 2 CFR Part 200, Subpart F. Covers audit threshold, selection of auditor, the Schedule of Expenditures of Federal Awards, and corrective action planning.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231325/5816039640.jpg','GGS-GMS-SARA','active'),
('487686073','Situational Leadership','Session Description
In Person - 8 Hours
Managing a team and providing
feedback can be a daunting task for People Leaders. This model provides a common language and
tool to help people leaders assess the needs of their staff and to match their
leadership style to the need. Situational Leadership is a methodology used
globally for the past 30 plus years.
The Situational Leadership® II
model is a practical framework that helps your managers diagnose the needs of
their people and then provide the appropriate
leadership style to meet those needs. Your managers learn the four stages of
development, from enthusiastic beginner (D1) to self-reliant achiever (D4), and
how to apply the appropriate directive and supportive behaviors,
from directing (S1) to delegating (S4), to match the development needs of their
people.
Note: This is for People Leaders
only. All attendees must have direct
reports.
Learning ObjectivesLearn the Situational Leadership ModelPractice and apply Situational Leadership to the teamBegin to speak the same language and develop an internal support from other People LeadersImprove the impact and frequency of conversations with direct reports MethodologyOffered to up to 12 participantsPre-work; Ken Blanchard system set up and management by clientLectureDiscussionParticipants will engage in individual and group activities, such as self-reflection, table group discussions Target Audience
Leaders at all levelsHigh-potential individual contributors','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'1-Day',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146458188.jpg','00035','active'),
('496270740','Staying Focused While Working from Home: Where’s the Balance?','No commute. No dress codes. No consistent schedule. No focus? Remote working can offer abundant flexibility, unless you also have abundant personal responsibilities, in addition to the relentless stream of emails and virtual meetings. Working in an office can make it easier to focus on your work, but at home it can be difficult to draw the line between personal and professional time. After participating in this session, you will be able to . . .

Create a schedule that works for you and those who count on youCreate and preserve buffers between your work and your personal lifeCreate a competitive advantage through solitudePlan for how to avoid too much focused time

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300928485.jpg','00137','active'),
('491791413','Strategic Planning and Execution','Session Description
You’ve carried a vision with you
throughout your career. You know this company, what it can do and where it can
go. It’s time to develop the skills and tools you’ll need to plot a course to
success. This course will help you learn and implement tools and techniques
used in strategic planning and execution.
Learn how to deconstruct your
company’s competitive position and use that understanding to drive innovation
and change.

Learning ObjectivesLearning and implementing strategic tools such as SWAT, SOAR, Porter’s 5 Forces, and the Hoshin Planning SystemDetermining the best tools for your role and begin putting it to useGetting ongoing support from our instructor Methodology
LectureDiscussionTarget Audience
Mid- to senior level leaders','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146461768.jpg','00063','active'),
('841231312','Strategic Thinking for Government Leaders','Develops strategic thinking capabilities for mid- to senior-level government leaders. Covers environmental scanning, competitive analysis, scenario planning, and aligning organizational strategy with agency mission.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231312/5816039568.jpg','GGS-LMT-STGL','active'),
('841231313','Strengths-Based Leadership','Grounded in positive psychology, this course teaches leaders how to identify and leverage the unique strengths of their team members. Topics include strengths assessment tools, strengths-based coaching, and creating a strengths culture.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231313/5816039574.jpg','GGS-LMT-SBL','active'),
('502076297','Stress Management: Minimizing Stress, Burnout, and Compassion Fatigue','Although a certain amount of job stress is to be expected, stress in the workplace can be costly. Stress affects not just individual well-being but also organizational performance. The amount of stress you experience within a specific time period and the way you respond physically and emotionally determine whether stress eventually becomes harmful. When stress is not managed well and is left untreated, it can present itself in physical symptoms, such as headaches, gastritis, colitis, hypertension, and in extreme cases stroke. Burnout is another common response to stress, as well as cynicism and a detached attitude towards work. Compassion fatigue arises as emotional exhaustion builds and results in a breakdown in relationships, confidence, and work capacity. Stress not only affects team members at work but can also affect their personal life and relationships with family and friends. Finding a balance in all aspects of life better prepares us to meet our every-day challenges.

Who Should AttendAnyone who currently experiences stress at work and who would like to exercise greater control over their reactions to workplace challenges. Anyone who would like to avoid burnout, compassion fatigue, and the more advanced effects of stress at work. (This workshop should not be substituted for professional counseling or medical attention when needed.)
What You Will LearnAfter this workshop, participants will be able to:Understand the causes for and consequences of stress on work-life, physiology, cognitive abilities, and emotional stabilityParticipate in problem-solving and decision-making to address underlying causes of stressLearn how to move into acceptance and develop flexibility and resilience with choices and changeBrainstorm effective habits for managing stress and establishing expectations and boundaries with othersEngage in planning for work-life balanceBounce back from stressful events and setbacks with greater resilienceWorkshop TopicsDefinition of stress and the role of individual perceptionsPhysiological and emotional responses to stressThe way stress buildsDanger signals of stress in the workplaceStages of burnoutStress sources, professional and personal triggersChanging your susceptibility to stressStress management and coping strategies for building resilience:Action-oriented strategies (With these strategies you take action that, in time, will help you to take more control over your life … you do whatever you sensibly can to control and eliminate the sources of stress)Emotionally oriented strategies (These strategies help you to intercept destructive negative thinking, and they allow you to think more positively about the situation that you are in)Acceptance-oriented strategies (These strategies temporarily relieve stress symptoms when you cannot regain control)

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3320714097.jpg','00168','active'),
('841231343','Subrecipient Monitoring','This course covers the requirements and best practices for monitoring subrecipients under federal grants and cooperative agreements. Participants will learn how to develop effective monitoring plans, conduct risk assessments, and ensure subrecipient compliance with federal requirements.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231343/5816040077.jpg','GGS-GMS-011','active'),
('491763233','Succession Planning','Session Description
Much of your leadership style may
be unique, but that doesn’t mean you can’t pass on its essence. Strategic
leadership means planning for continuity when a major departure occurs.
This course will teach you how to
build an effective succession plan and lead key members of your team to build
theirs as well.
Learning ObjectivesUnderstanding the value of succession planningUnderstanding how to plan for your successionUnderstanding how to lead key team members in building their succession plans Methodology
LectureDiscussionTarget Audience
Mid- to senior level leaders','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146460371.jpg','00064','active'),
('841231314','Supervisory Skills for New Supervisors','A foundational course for employees newly appointed to supervisory roles in government. Covers the transition from individual contributor to supervisor, delegation, performance management, and legal/ethical supervisory responsibilities.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231314/5816039580.jpg','GGS-LMT-SSNS','active'),
('841231294','Sustainable Acquisition','An introduction to federal sustainable acquisition requirements, including energy efficiency, green products, and environmentally preferable purchasing mandates. Covers Executive Order requirements and agency sustainability goals.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231294/5816036210.jpg','GGS-SA','active'),
('502061628','Team Building/ Leading Teams and Groups','This 3-day workshop will introduce participants to the fundamental principles and tools for understanding how to effectively lead and contribute to their teams and groups. We will focus on the interpersonal leadership and team skills that can help formal and informal leaders at all levels to create and effectively impact teams. This workshop will help equip and empower participants with the experience, knowledge, and tools that they can implement to create an engaging team that performs at a high level.

Course Objectives: Participants who successfully complete this course will be able to:Use the stages of team or group development to better contribute to team effectivenessUse team characteristics and their team member roles to better contribute to team effectivenessUnderstand the role of formal and informal leadership at different stages of team developmentAssess their leadership style and communicationGive & receive constructive feedbackUse active listening with team membersResolve interpersonal conflictsBe able to identify what to look for in team or group dynamicsUnderstand team diversity and how it contributes to conflict, problem solving and innovationBe able to differentiate among different “work styles,” creating a greater appreciation for diversity among team membersUnderstand the role of emotional intelligence in team dynamicsUnderstand the different kinds of trust and how to establish trust on a work teamDiscuss their own and others’ personal & professional valuesCourse Outline
Characteristics of effective teams and team membersWhat roles and responsibilities help make an effective team memberHow to help your organization use your valuable qualities as a team memberStages of group developmentHow to diagnose the stages within teamsHow to use this information to effectively address team problemsDiversity on TeamUnderstanding the different kinds of diversity and their impact on the teamAssessing diverse styles and valuesTeam TrustIdentifying participants’ trust factors13 trust-building behaviorsCreating trust accounts within a teamAssessing your leadership styleYour type of team leaderLeadership and Team Tools for CommunicationResearch on what communication makes teams most effectiveBest practices for creating great team communication that results in exemplary performanceConstructive feedbackHow to give itHow to receive itActive listeningFive Levels of active listeningPersonal assessmentsPersonal practice exerciseConflict styles in teamsPersonal assessment and identification of individual stylesOverview of 5 traditional stylesEight steps towards making conflict constructive using a problem-solving styleSetting conflict resolution goals – applicationTeam or group dynamicsOverview of what to look for in teamsExercise for observing/diagnosing effective and ineffective team dynamicsDifferent work stylesPersonal assessmentIdentify preferred stylesUnderstanding others’ and own strengths and weaknesses for each styleHow to get along with someone who has a different style – how to maximize team diversitySix Thinking HatsPersonal assessmentOverview of each of the six thinking and problem-solving stylesExercise to observe/identify each “Hat” in action

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'3-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300948492.jpg','00176','active'),
('490657224','Team Building with Enneagram','Session Description
In-person - 8 Hours
Unlike almost all other typologies, the Enneagram has a vertical component, showing the path of development and the range of possibilities for each type. The Enneagram describes nine different sets of values and filters through which the world can be seen. It is a respectful and dynamic system that provides a path of healthy development for each type, including how to build on strengths and avoid pitfalls. 

It assists leaders in understanding themselves and others through new eyes. Energy is freed for productivity and creativity that was previously lost in frustration and agitation. Learning ObjectivesUnderstand the Enneagram systemCultivate deep self-awareness and
then translate that into increased team trust, collaboration, and ability to
work even more effectively with each otherLearn more advanced Enneagram
concepts to accelerate the speed and depth of self-awareness, growth, and
development MethodologyIndividual assessments, training videosIndividual Enneagram debriefsTeam sessions Target Audience
Leaders and employees at all levelsHigh-potential individual contributorsProject/Program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'1-Day',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146460655.jpg','00040','active'),
('502085023','Teamwork for Team Members: How to Give the Most to & Get the Most from Your Team','This 2-day workshop will introduce participants to fundamental tools and techniques for understanding how to effectively build and participate in work teams and to solve team problems. We will focus on the interpersonal team skills that can help supervisors and other team members to more effectively serve and contribute to their teams. This workshop will help equip and empower participants with tools that directly affect a team member’s ability to help move the team to higher levels of performance.

Learning Objectives:Students will be able to:Use the stages of team or group development to better contribute to team effectivenessUse team characteristics and their team member roles to better contribute to team effectivenessGive & receive constructive feedbackUse active listening with team membersResolve interpersonal conflictsBe able to identify what to look for in team or group dynamicsBe able to differentiate among different “work styles,” creating a greater appreciation for diversity among team membersSee the individual differences in the way we generate ideas for making decisions and solving problemsDiscuss their own and others’ personal & professional valuesCourse Outline:
Characteristics of effective teams and team membersWhat roles and responsibilities help make an effective team memberHow to help your organization use your valuable qualities as a team memberStages of group developmentHow to diagnose the stages within teamsHow to use this information to effectively address team problemsConstructive feedbackHow to give itPersonal practice exerciseHow to receive itActive listeningPersonal assessmentsPersonal practice exerciseConflict styles in teamsPersonal assessment and identification of individual stylesOverview of 5 traditional stylesEight steps towards making conflict constructive using a problem-solving styleSetting conflict resolution goals – applicationTeam or group dynamicsOverview of what to look for in teamsExercise for observing/diagnosing effective and ineffective team dynamicsDifferent work stylesPersonal assessmentIdentify preferred stylesUnderstanding others’ and own strengths and weaknesses for each styleHow to get along with someone who has a different style – how to maximize team diversitySix Thinking HatsPersonal assessmentOverview of each of the six thinking and problem-solving stylesExercise to observe/identify each “Hat” in actionBalancing personal and professional values within teamsWhat to look forHow to respond someone’s values conflict with your own

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301303691.jpg','00169','active'),
('491791419','Technical Skills and Leadership','Session Description
Every job requires some manner of
technical expertise. As an aspiring leader we must wield a minimum level of
expertise in the systems we use to make sure we can help our team work
efficiently and foresee technology changes that will affect our efforts.

This course will help you take a
strategic view of the technology used by your team and grow a long-term digital
strategy to keep your team up to date and ready for what lays ahead. 

Learning ObjectivesInventorying your technologyUnderstanding digital strategyBuild your digital strategy plan Methodology
LectureDiscussionTarget Audience
Leaders at all levelsHigh-potential individual contributorsProject/Program managers','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146461853.jpg','00065','active'),
('490382588','Technical Writing','Course Description
TBD
Course ObjectivesTBD
Course OverviewTBD.
Contact Joy Smith Stone, Training Coordinator at jstone@gothamgovernment.com or (828) 750-5994 for more information or to schedule this or any of GGS’s other writing courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146460481.jpg','00037','active'),
('502070079','Technical Writing: When Your Message Needs to Reach a Diverse Audience','Wouldn’t life be so much easier if everyone communicated the same way? Working collaboratively to find solutions to problems involves the exploration, input, interpretation, and actions of many people. Within this team of talented individuals lies a wealth of diverse experiences, backgrounds, cultures, and thinking styles.

People often communicate with others the way they would like others to communicate with them. That equates to talking to a mirror. However, many unique individuals must understand the critical information conveyed in technical documents or knowledge briefs, both for current and future applications. This workshop helps exceptional people to identify how to share information with other exceptional team members who also want to demonstrate their passion, their commitment, and the power of their contribution to continuously improve in all business activities. A shared understanding across a potentially diverse audience facilitates constructive and appropriate use.
After this workshop, participants will be able to . . .Demonstrate respect for each other’s differences in the creation and communication of the information inside technical documentsAnticipate others’ unique needs and perspectives when looking at the same informationAnalyze their audience to write for that audience and not just for themselvesStay within the scope of the issue being described through understanding the objectives of each document or knowledge briefMake decisions about what to include and what to eliminate from a larger pool of information, to create a concise yet informative document that does not mislead peopleHelp others on current and future business teams to more effectively utilize their unique contributions in response to shared technical documents

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301303629.jpg','00171','active'),
('632706629','The Federal Budget Process','The Federal Budget Process 2 Days, 16 CLPs

Understand the process of how federal funds are planned for, authorized, appropriated, apportioned, allocated, and executed each year. Through examination of current events, you will learn the formulation, enactment, and execution phases of the federal budget process. 
Who Takes This Course: This course is designed for government and private sector employees new to budgeting responsibilities or those not directly involved in federal budgeting who want an overview of the budget process. 
Course Format: Lecture, group discussion, class exercises, and exam. 
Learning Objectives 
• Identify major legislation that impacts the federal budget process 
• Track the budget timeline and the three major phases of the budget process 
• Identify the roles of the major players in the budget process 
• Outline how agencies use and track their allocated funds 
• Explain how agency budgets are prepared and how they contribute to the President''s Budget 
• List the types of audits used after the budget has been executed 
• Quantify the size and scope of the present budget 
• Identify trends in federal spending during the last 50 years 
Course Topics 
History of the Federal Budget Process 
• The Budget Process Functions 
• History of the Federal Budget Process 
• Efforts to Reduce the Deficit 
• Efforts to Increase Accountability 
• Financial Accountability and Accounting 
• Recent Developments 
• Exercise: What Are the Federal Acts? 
Budget of the United States: Facts, Figures, and Trends 
• Revenues/Receipts 
• Outlays/Expenditures 
• Deficits, Surpluses, and Fiscal Sustainability 
• Exercise: Facts, Figures, and Trends 
Federal Budget Overview 
• Budget Concepts and Terms 
• How Do Agencies Get Their Funds? 
• Budget Authority vs. Outlays 
• Key Players in the Federal Budget Process 
Budget Formulation Process 
• Federal Budget Process 
• President''s Budget 
• Formulation of the President''s Budget 
• Annual Performance Plan 
• Step 1: Budget Policy Development 
• Step 2: Preparation and Submission of Agency Budget Estimates 
• Step 3: OMB Review and Presidential Decisions 
• Exercise: Northern Energy Council 
Congressional Action Process 
• Congressional Action on the President''s Budget 
• Concurrent Budget Resolution 
• Authorizing Legislation 
• Appropriations 
• Authorizations vs. Appropriations 
• Lapse in Appropriation 
• Exercise: Congressional Action 
Budget Execution 
• Key Execution Activities 
• Appropriation Warrant (FMS Form 6200) 
• Appropriation Life Cycle 
• Types of Classifications and Appropriations 
• Availability of Budgetary Resources 
• Internal Control 
• Apportionment 
• Allotment by Agency Headquarters and Suballotment 
• Commitments and Obligations 
• Developing the Operating Plan 
• Monitoring an Operating Plan 
• Revising an Operating Plan 
• Budget Execution Flexibility 
• Impoundment Actions 
• Continuing Resolution 
• Exercise: Budget Execution 
Audits 
• Why Audit? 
• Preparing for an Audit 
• Financial Audits 
• Performance Audits 
• Attestation Engagements 
• After the Audit 
• The Audit Finding 
• Exercise: Audit Concepts','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4147233571.png','00188','active'),
('491975694','The Introverted Networker','Session Description
According to a New York Times
survey, for many people walking into a room full of strangers is a scarier
prospect than death – only slightly worse than public speaking! This session
will take the fear out of networking, giving participants a clear strategy for
choosing and preparing for events, tactics on what to do when in the room and
how to plan for effective follow-up – making networking events not just more
enjoyable but more productive as well. 
Learning Objectives
Overcoming our fears about networkingLearning how to start (and stop) conversations – and be memorable for all the right reasonsDeveloping a strategy for intentional networking Creating an effective follow-up routine to maximize ROI from networkingMethodology
Highly interactiveSharing strategies, tips, & toolsFacilitated group discussionsHands-on practice Action planning for accountability and sustainable change 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsEmployers at all levels','Communication',ARRAY['Communication']::text[],'3-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146464771.jpg','00084','active'),
('491992489','The Power of Speech Acts: Make Things Happen with Active Language Choices','Session Description
There are seven different types
of speech acts that drive all communication. Expressions, factual statements,
directives, requests, apologies, declarations, and commitment statements fall
into two categories.

One category is passive with words that do not always create forward action.
The other is a generative category that produces results. 
This session highlights the power
of using all seven with a fluency that creates purposeful and effective change
in the workplace. 

Learning Objectives
Learning the distinctions of speech actsIdentifying the dominant discourse within your organizationDiscovering how your preferences for language may be working or hinderingCreating awareness of how using all seven of the speech acts with fluency can produce powerful results 
 
Methodology
Instruction/LectureIndividual activitiesLarge group discussion and Q&A 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsStaff at all levels','Communication',ARRAY['Communication']::text[],'2-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146465771.jpg','00085','active'),
('490664399','The Power of Voice: How Silencing Impacts Female Leaders and Ways Both Men and Women Can Respond','Session Description
Live online - 1.5 hours
The silenced female leader is a paradox as leadership implies a sense of voice and efficacy. Leaders need to communicate their purpose and vision to enlist followers. This can hardly be done without language, yet research suggests that there are many women sitting in executive and senior-leader roles feeling silenced. This course covers the phenomenon of silencing while highlighting key original research findings; it also reviews strategies successful women have used to recover and lead with voice currency.The impact of feeling silenced
can hit someone like a virus, which requires a higher level of awareness. Voice
recovery relies on two essential solutions – first, the ability to focus on the
phenomenon and essence of feeling silenced and the act of framing it as a
virus. Second, there are strategies to heal and develop a resiliency that
requires a shift in focus. 
Learning ObjectivesRecognize how feeling silenced
derails careersUnderstand the three ways women
are silenced in their rolesMitigate the viral effects of
silencing and combat the female leader opt-out MethodologyLectureDiscussionParticipants will engage in self-reflection and group discussion Target Audience
Leaders and employees at all levelsHigh-potential individual contributorsProject/Program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'2-Hour',ARRAY['Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146465360.jpg','00041','inactive'),
('487125339','The Thrift Savings Plan','Course Description
The Thrift Savings Plan (TSP) is probably the most critical component of Federal retirement benefits today. This seminar provides employees with an in-depth understanding of the TSP as a retirement savings plan and its relationship to the other Federal retirement benefits to which employees have access.
Course ObjectivesAfter attending this seminar, attendees will understand the importance of the TSP toward their retirement and be equipped with sound investment strategies for best leveraging what TSP has to offer. Finally, they will understand how their Federal employee benefits fit within the overall construct of a financial plan.
Course OverviewThe Thrift Savings Plan Seminar involves a deep-dive into the five primary TSP funds, the Life-Cycle funds, and investment strategies that support building the TSP to the level necessary for a financially sound retirement.
Questions? Contact our training coordinator via email or phone at (202) 843.5447.','Retirement Planning & Financial Literacy',ARRAY['Retirement Planning & Financial Literacy','Human Capital Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3495352740.png','00023','active'),
('491782375','The Vision and the Team - Finding True North','Session Description
You know where you need to go and
you have the team to get you there. How can you walk that path with confidence
and consistency? You need to understand the dynamics of your team, remove
conflict and hesitance, and align your forces toward your true north.

This course will teach you how to
hire, on-board, and guide your team toward your vision.

Learning ObjectivesTying Tuckman’s Team Development Model to visionHow to hire and onboard effectivelyEmbedding cultural development with team development Methodology
LectureDiscussionTarget Audience
Mid- to senior-level leaders','Leading Teams',ARRAY['Leading Teams']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146465442.jpg','00066','active'),
('841231315','Time and Priority Management','Provides government professionals with practical tools to manage competing demands, prioritize effectively, and protect time for high-value work. Covers prioritization frameworks, delegation strategies, and meeting management.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231315/5816039586.jpg','GGS-LMT-TPM','active'),
('502076311','Train-the-Trainer: Teaching and Coaching for Top Performance','Learning Objectives

After this workshop, participants will be able to:Make the training initiative a positive experience for both Coaches and TraineesUse positive coaching strategies to follow up with Trainees as they progress through H & V’s new-hire curriculumExplain the payoffs of coaching efforts, to establish and/or reinforce Coach buy-inDemonstrate what effective Coaches do as they work with TraineesAvoid common coaching pitfallsUse the step-by-step communication process to strategically share information with TraineesIncrease the clarity and focus of their communications to decrease misunderstandings, using the 8 Cs of effective communicationProvide constructive feedback to Trainees to promote education and improvementSolicit constructive feedback from Trainees to evaluate and improve the Coaches’ training effortsCreate an agreement with clearly defined expectations and action plans for both parties, to establish mutually beneficial ground rules for working together during the training processEffectively involve Trainees’ direct supervisors in the coaching process through collaborationExplain the differences that exist within different generations of workersFlexibly communicate across all generationsHelp Trainees see their learning and development efforts from a positive perspective during follow-up conversations between Coaches and TraineesCourse Outline
Trainer/Coaching IntroductionWhat coaching is and is not for the TrainerTrainer/follow-up Coaching benefits to Trainees, Coaches, and your organizationWhat Coaches do – roles and responsibilitiesCoaching PlansDocumenting Trainees’ on-going performanceHow to conduct a SWOT Analysis to identify a Trainee’s existing Strengths, Weaknesses, Opportunities, and ThreatsHow Gap Analysis can help Coaches and Trainees focus training on the most helpful areasHow to set SMART goals for Trainees’ professional developmentHow to build trust between Coaches and TraineesHow to establish clear Coach-Trainee expectations for the working relationship and how to be sure that each sees the benefits of working togetherCoaching Interactions

A step-by-step explanation for how to increase communication effectiveness between Coaches and TraineesHow to communicate to promote understanding and applied knowledgePerformance Log for tracking Trainee progress and collecting performance information for on-going feedbackHow to give and receive constructive feedbackHow to use active listening to create shared understandingHow to use the OSKAR coaching model to organize and discuss Trainee on-going performance, strengths, and improvement strategies, from a positive perspectiveHow the GROW model can help Coaches discuss future professional development plans with TraineesCommunicating across different generationsAssessing and using different learning styles

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301316078.jpg','00172','active'),
('490657226','Unconscious Bias Training for Supervisors, Managers, and HR Professionals','Session Description
Like it or not, everyone brings
hundreds, if not thousands, of biases into every situation.
For the most part these biases
are unconscious. In the workplace, unconscious bias can lead to favoritism
and in some cases discrimination, when making decisions on who to hire, fire,
promote or pay at a certain level.
It’s important, therefore, to
ensure that those within the organization who are responsible for making
employment-related decisions are properly trained to recognize what unconscious
biases they may personally have and how to overcome them.
In this full day workshop, you
will explore the concept that there is nothing more fundamental to performance
than how people see and treat each other as human beings and how unconscious
bias can impact that significantly. 
Learning ObjectivesIdentify your own biases - conscious and unconsciousUnderstand the most common types
of unconscious bias and where they may show up in decision makingIdentify strategies to keep bias
from affecting decisions MethodologyLectureDiscussionIndividual reflection, paired and group discussion Target Audience
Leaders at all levelsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'1-Day',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146468032.jpg','00042','active'),
('502083297','Understanding and Promoting Organizational Values','Organizational culture determines what employees do and why. Culture influences how work gets done, impacts the success or failure of projects, determines who fits in and who does not, and affects the overall morale or atmosphere of an organization. Organizational values, behaviors, and attitudes characterize a business and guide its practices. Therefore, all employees must understand their organizations’ values and consistently demonstrate these values in the way they think and behave.

Course Objectives: Participants who successfully complete this course will be able to:Explain how an organization’s values can drive organizational culture and employee performanceIdentify individual employee values and what motivates employee performanceOperationally define organizational values within team and personal vision and mission statementsAlign individual employee activities with organizational valuesHelp employees work with greater values-driven purposeHelp employees change behaviors to better demonstrate organizational valuesCourse Outline:
The Connection Between Organizational Culture and ValuesThe Cultural Web – aligning your organization’s culture with strategic valuesCommunicating your organization’s strategy or pyramid of values and how they relate to employeesThe Competing Values Framework – Analyzing corporate cultureThe Connection Between Employee Values and Employee ActivitiesUnderstanding workers’ valuesUnderstanding what drives or motivates your people at workDefining Purpose from Organizational ValuesCreating a shared team vision and mission statementsCreating personal vision and mission statementsMeasuring Purpose and Organizational Values in ActionHow to be a good role model for promoting organizational valuesAligning individual employee objectives with organizational values – a special application of Management By ObjectivesSetting values-driven goals with employeesKey Performance Indicators –linking employee activities or organizational valuesThe Desire for Organizational Values-Driven BehaviorHelping employees find deeper personal meaning in their organization – working with purpose and valuesChanging people’s habits – encouraging and sustaining new values-driven behaviors

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'2-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301298230.jpg','00173','active'),
('491980183','Understanding, Embracing & Resolving Conflict','Session Description
Group members don’t always get
along well. Even in the most high-functioning group, one person may trigger
another and the energy in the room may shift from good-vibes-all-around to
defensiveness and hostility. These seemingly counterproductive dynamics are
learning opportunities to be embraced. Leaders and managers who are able to
understand and resolve conflict are better able to deepen connection and grow.
In this fundamental training,
participants learn the five basic causes of conflict, intragroup conflict, and
intergroup conflict and how to navigate them to foster stronger teams and move
work forward.

Learning Objectives
Define and identify examples of transference, countertransference and triggers Understand various types of bias that sustain group conflict Distinguish and identify the causes of task, process, and personal conflict Explore how fairness and justice can be used to better understand group conflict Examine competition, power and domination, aggression, social norms, ingroup loyalty and outgroup hostilityLearn three conflict resolution methods that work 
 
 
Methodology
Individual ReflectionLectureSmall-Group ExercisesSmall- & Large-Group Discussion 
 
 
 
 
 
 
 
 
 
 
 
 
 
Target Audience
Leaders at all levelsHigh-potential individual contributorsProject/program managers','Communication',ARRAY['Communication']::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146467151.jpg','00086','active'),
('841231327','Understanding the Uniform Guidance','A comprehensive overview of 2 CFR Part 200, the Uniform Administrative Requirements, Cost Principles, and Audit Requirements for Federal Awards. Ideal for both new and experienced grants professionals seeking a thorough grounding.','Grants Management',ARRAY['Grants Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231327/5816039646.jpg','GGS-GMS-UUG','active'),
('490707648','Understanding Yourself and Others: Using the DiSC','Session Description
The DiSC
assessment is a widely used communication styles assessment and model that will
help participants understand how their communication style and preferences
impact their performance. This course will help participants understand the
variety of communication style preferences and will afford participants the
opportunity to learn best practices in adapting their styles to be most
effective when working with others. 

Learning ObjectivesGain an understanding of their
own DiSC communication style and their strengths and limitationsGet to know each other better
personally and professionallyGain an understanding and an
appreciation of the style differences that exist within peopleBe able to create effective
interactions with clients and staff based on an understanding of these
differencesIdentify their work style and its
implication to their professional environment MethodologyDiSC –
self-assessmentLectureDiscussionGroup activitiesIndividual activities Target Audience
Leaders at all levelsStaff at all levels','Conscious Leadership',ARRAY['Conscious Leadership']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146468142.jpg','00044','active'),
('490682450','Understanding Yourself and Others: Using the MBTI','Session Description
The Myers-Briggs Type Indicator
(MBTI) is the most widely used personality inventory in the world. Managers and
employees agree that personality clashes can be major deterrence to a team
realizing its full potential. 
The MBTI seeks to help
individuals understand different perspectives in nonjudgmental terms. This increase in understanding
differences leads to increased communication and improved overall team
performance.

Learning ObjectivesGain an understanding of their
own MBTI preference and their strengths and limitationsGet to know each other better
personally and professionallyGain an understanding and an
appreciation of the style differences that exist within peopleBe able to create effective
interactions with clients and staff based on an understanding of these
differencesIdentify their work style and its
implication to their professional environment MethodologyMyers Briggs Type Indicator –
self-assessmentLectureDiscussionGroup activitiesIndividual activities Target Audience
Leaders and employees at all levelsHigh-potential individual contributorsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'1-Day',ARRAY['In-person']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146467906.jpg','00043','active'),
('496301240','Virtual Meeting Ice Breakers: Helping Remote Teams Warm Up and Stay Connected','As more and more people transition to remote working conditions where they need to effectively balance both personal and professional responsibilities, being able to switch their gears to “meeting mode” and then offer fully-present contributions to virtual work meetings does not happen easily. In addition, remote teams often find it challenging to build or sustain existing rapport with one another. As a result, your virtual meetings may struggle to encourage creativity and problem solving when your team members are dispersed and now rarely, if ever, get to meet face-to-face. A virtual ice breaker is a simple approach to get everyone warmed up for a meeting and wearing their meeting hats from home, to get conversations flowing, to break down barriers or shyness associated with being “online,” to energize a meeting, and to help team members learn more about each other. This session helps people . . .

Define a virtual icebreakerExplain when to use and when not to use a virtual icebreakerStrategically select an appropriate virtual icebreakerMatch an icebreaker to a virtual team’s needs and preferencesExperience several examples of virtual icebreakers

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300928495.jpg','00138','active'),
('841231316','Virtual Team Leadership','Addresses the unique challenges of leading distributed and hybrid government teams. Topics include virtual communication norms, maintaining team cohesion, performance oversight in remote environments, and technology best practices.','Leadership & Management',ARRAY['Leadership & Management']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231316/5816039587.jpg','GGS-LMT-VTL','active'),
('496353069','What It Takes to Run Great Virtual Meetings','Virtual meetings are here to stay. However, do you sometimes wonder if anyone is paying attention or simply exhausted from all the virtual meetings we attend these days? As a meeting leader, do you fear that virtual meetings may seem to some like a license to multitask? What happens if someone sits back and tunes out? Have you ever presented an idea in a virtual meeting, paused for a reaction, and then heard, “I’m not sure I followed you,” which might as well mean, “I was shampooing my cat and didn’t realize I would be called on.” It does not have to be this way. With the right preparation and strategy, virtual meetings provide teams with a safe, effective, and efficient way to get things done.

Who Should AttendCurrent and future managers and team leads with responsibilities for coordinating the efforts of remote or hybrid teams or individuals; Human Resources professionals serving as advisors to current and future remote team managers.
What You Will LearnAfter this workshop, participants will be able to:Frame the meeting using a simple organizational strategy so that attendees understand the meeting’s (1) purpose, (2) direction, and (3) contextStrategically use ice breakers to get meeting participants ready to engageCreate voluntary engagement in the conversation taking placeMake virtual meetings inclusive, where everyone has a voiceCreate meaningful interactionsInvite only those people who need to attendEffectively prepare for virtual meetingsEnhance the productivity of remote meetings with people still getting used to working remotelyNurture relationships and be the type of person others want to meet withMake time for small talk in your virtual meetings

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'4-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3300992788.jpg','00140','active'),
('490653668','Why Leadership & Management Matter','Session Description
What is leadership really? Is it
simply about power over people and getting results? And what about management?
Isn’t that just telling people what to do and holding them accountable to it?
In this fundamental training, participants will explore these questions by
defining leadership and management, understanding where they fit in, and
deciding who they want to be in both contexts -- for the purpose of developing
themselves, their teams, and their organization.

Learning ObjectivesExamine the degree to which your
current leadership and management practices support the organization’s mission
and desired cultureDiscuss what the organization
wants leaders and managers to be and do in order to grow into current roles and
meet new organizational demandsEstablish a shared understanding
about what principles and practices leaders and managers want to be held
accountable toUnderstand the positive effects
of distributed, participatory leadership to identify ways traditional leaders
can improve their approachApply trauma-informed practices to leading and managing people and tasks.MethodologyIndividual ReflectionLectureSmall-Group ExercisesSmall- & Large-Group Discussion Target Audience
Leaders at all levelsHigh-potential individual
contributorsProject/program managers','Conscious Leadership',ARRAY['Conscious Leadership']::text[],'3-Hour',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146467241.jpg','00045','active'),
('501779647','Working within or Managing a Multi-Generational Team','Today, as many as five generations of employees must find a way to work together, with some pronounced differences among them. Managers and teammates striving to work towards common goals often struggle to get things done. One key solution involves developing a deeper understanding of the other people with whom they work, why they do what they do, what they care about, and what motivates them at work and in life. Common patterns or themes often emerge when looking at a specific age demographic, due to shared events during their formative years. These themes have a big impact on the way a specific generation of employees approaches work. Rather than seeing generational differences as a hurdle for your team members, this workshop explores the potential to be found in generations respecting and learning from each other instead.

Course Objectives: Participants who successfully complete this course will be able to:Define the five generations represented in the American workforceDefine key differences and similarities across generationsManage across generationsCommunicate across generationsDemonstrate respect across generationsUse generational differences to effectively develop and retain workers across generationsCourse Outline
Defining The Five Generations of American WorkersThe Traditional GenerationThe Baby-Boom GenerationGeneration XGeneration YGeneration ZGenerational Differences and SimilaritiesAttitudes and motivation towards workLoyalty towards the employerAttitudes regarding respect and authorityAttitudes towards supervisionTraining styles and training needsAttitudes toward changeDesire for a better work/life balanceCommunication stylesImplications for EmployersManagement across generationsCommunication across generationsRespect across generationsTraining and learning across generationsRetention across generationsCreating internal team harmony across generations

Up to 30 students
Virtual Classes will be a live, Instructor lead class in Zoom for Government, a virtual technical assistant VTA will be available to assist students with any technical issues, take roll, administer evaluations, and distribute certificates of completion. Course materials will be provided electronically.Onsite classes will be held at your location. The instructor will travel to you. Materials will be printed and shipped to your site. A sign-up sheet will be provided for student to enter their name (as they want it on their certificate) and the email address to send the certificate to. GSA travel costs will be added to the course fee. Contact us for a travel estimate.A minimum of 2 weeks lead time is needed for virtual classes, 3 weeks for onsite classes.Questions? Contact our training coordinator via email or phone at (202) 843.5447.',NULL,ARRAY[]::text[],'1-Day',ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/3301055898.jpg','00159','active'),
('490402932','Writing in "Plain Language"','Course Description
TBD
Course ObjectivesTBD
Course OverviewTBD.
Contact Joy Smith Stone, Training Coordinator at jstone@gothamgovernment.com or (828) 750-5994 for more information or to schedule this or any of GGS’s other writing courses.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146472005.jpg','00038','active'),
('841231295','Writing Statements of Work','Practical guidance for developing clear, complete, and compliant statements of work and performance work statements. Learn how to define requirements, specify deliverables, and avoid common SOW pitfalls.','Federal Acquisition & Contracting',ARRAY['Federal Acquisition & Contracting']::text[],NULL,ARRAY[]::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/products/841231295/5816036216.jpg','GGS-SOW','active'),
('490653671','Your Leadership Legacy','Session Description
What do you hope people will say
about your leadership at the end of your career? We rarely ask this question,
but beginning with the end in mind is the best way to ensure that end is one
we’re proud of. This course will help you understand that value of crafting a
leadership legacy now so you can build toward it for the remainder of your
career.

You will begin this journey and
seek feedback from peers and our team to make sure the path you walk will be
the best version of your leadership you can offer the world.

Learning ObjectivesUnderstand the value of your leadership
legacy

Begin your leadership legacy journeyUnderstand a 6-step process for creating
your leadership legacy MethodologyLectureDiscussion Target Audience
Mid- to senior-level leaders','Conscious Leadership',ARRAY['Conscious Leadership']::text[],NULL,ARRAY['In-person','Live online']::text[],'https://d2j6dbq0eux0bg.cloudfront.net/images/77136787/4146472045.jpg','00046','active')
) AS v(external_id, name, description, category, categories,
       duration_label, delivery_formats, image_url, sku, status)
  ON s.slug = 'gothamculture'
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.storefront_id = s.id AND p.external_id = v.external_id
);

-- 3) Mirror the same catalog into the gothamgovernment store (copy in-DB).
INSERT INTO products
  (storefront_id, external_id, name, description, category, categories,
   duration_label, delivery_formats, image_url, sku, price, status, is_featured, sort_order)
SELECT g.id, p.external_id, p.name, p.description, p.category, p.categories,
       p.duration_label, p.delivery_formats, p.image_url, p.sku, 0, p.status, false, 0
FROM products p
JOIN storefronts src ON src.id = p.storefront_id AND src.slug = 'gothamculture'
JOIN storefronts g ON g.slug = 'gothamgovernment'
WHERE p.external_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products x WHERE x.storefront_id = g.id AND x.external_id = p.external_id
  );
