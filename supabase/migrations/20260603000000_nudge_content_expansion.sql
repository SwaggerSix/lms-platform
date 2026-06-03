-- =============================================================
-- Expanded global MicroAction seed library
-- Adds 5 additional actions per category (80 total) so managers
-- have a rich starting library for assignments and campaigns.
-- All rows have NULL organization_id / created_by = global seed.
-- =============================================================

INSERT INTO public.nudge_actions (title, description, category, estimated_minutes, quote, quote_author) VALUES

-- ===================== Purpose =====================
('Write your personal "why"', 'Spend three minutes writing a sentence about why your work matters to you personally, beyond the paycheck.', 'Purpose', 3, 'He who has a why to live for can bear almost any how.', 'Friedrich Nietzsche'),
('Connect today to your values', 'Before diving in, identify one task on your to-do list that directly reflects something you care about and do it first.', 'Purpose', 3, 'When your values are clear to you, making decisions becomes easier.', 'Roy E. Disney'),
('Share your purpose with a teammate', 'Tell a colleague what motivates you about the work you do together and ask them the same question.', 'Purpose', 5, 'The meaning of life is to find your gift. The purpose of life is to give it away.', 'Pablo Picasso'),
('Audit one task for meaning', 'Pick a routine task and ask: does this still serve our mission? If not, note how it could be improved or eliminated.', 'Purpose', 5, 'Efforts and courage are not enough without purpose and direction.', 'John F. Kennedy'),
('End the day with an impact note', 'Before logging off, write one sentence about the impact your work had on someone today.', 'Purpose', 2, 'The two most important days in your life are the day you are born and the day you find out why.', 'Mark Twain'),

-- ===================== Strategy =====================
('Map one decision to a goal', 'For the next decision you face, explicitly write down which team or company goal it supports.', 'Strategy', 3, 'Strategy is about making choices, trade-offs; it''s about deliberately choosing to be different.', 'Michael Porter'),
('Identify one thing to stop doing', 'Look at your current projects and identify one activity that no longer moves the needle. Propose stopping it.', 'Strategy', 5, 'The essence of strategy is choosing what not to do.', 'Michael Porter'),
('Think two steps ahead', 'Before starting your next task, write down what will happen after it is done and who will be affected.', 'Strategy', 3, 'In preparing for battle I have always found that plans are useless, but planning is indispensable.', 'Dwight D. Eisenhower'),
('Review your team''s top three priorities', 'Check whether the work you have scheduled this week aligns with your team''s stated top three priorities.', 'Strategy', 5, 'If you don''t know where you are going, any road will get you there.', 'Lewis Carroll'),
('Challenge one assumption', 'Identify an assumption your team is making about a project and ask: what if this were wrong?', 'Strategy', 5, 'The only way to win is to learn faster than anyone else.', 'Eric Ries'),

-- ===================== Values =====================
('Catch someone living a value', 'Notice a colleague demonstrating a team value today and thank them specifically for it.', 'Values', 3, 'Your beliefs become your thoughts, your thoughts become your words, your words become your actions.', 'Mahatma Gandhi'),
('Make a values-based decision', 'For the next choice you face, explicitly name which team value is guiding your decision before you act.', 'Values', 3, 'It''s not hard to make decisions when you know what your values are.', 'Roy E. Disney'),
('Start a meeting with a value', 'Open your next meeting by reading one of your organization''s values aloud and asking the team what it means to them.', 'Values', 5, 'Culture is not just one aspect of the game, it is the game.', 'Lou Gerstner'),
('Reflect on a values conflict', 'Think of a moment this week where two values seemed to conflict. Write down how you navigated the tension.', 'Values', 5, 'In matters of style, swim with the current; in matters of principle, stand like a rock.', 'Thomas Jefferson'),
('Tell a values story', 'Share a brief story with your team about a time you saw your organization''s values in action and the impact it had.', 'Values', 5, 'Values are like fingerprints. Nobody''s are the same, but you leave them all over everything you do.', 'Elvis Presley'),

-- ===================== Efficiency =====================
('Batch your interruptions', 'Block a one-hour window today where you silence notifications and focus on a single important task.', 'Efficiency', 5, 'Focus is a matter of deciding what things you''re not going to do.', 'John Carmack'),
('Apply the two-minute rule', 'Scan your inbox or task list. Anything that takes two minutes or less, do it right now instead of scheduling it.', 'Efficiency', 5, 'The secret of getting ahead is getting started.', 'Mark Twain'),
('Simplify one process', 'Find one workflow step that could be removed without reducing quality and propose the change to your team.', 'Efficiency', 5, 'Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'),
('Prepare tomorrow''s plan tonight', 'Before ending your day, write down your top three tasks for tomorrow so you can start focused.', 'Efficiency', 3, 'Give me six hours to chop down a tree and I will spend the first four sharpening the axe.', 'Abraham Lincoln'),
('Decline one meeting', 'Review your calendar for this week. Decline or delegate attendance at one meeting that doesn''t need you.', 'Efficiency', 3, 'The difference between successful people and really successful people is that really successful people say no to almost everything.', 'Warren Buffett'),

-- ===================== Customer =====================
('Walk in the customer''s shoes', 'Use your product or service as a customer would for five minutes and note one friction point.', 'Customer', 5, 'Get closer than ever to your customers. So close that you tell them what they need before they realize it themselves.', 'Steve Jobs'),
('Read one piece of customer feedback', 'Go to your support queue or feedback channel and read one recent customer comment. Note one actionable insight.', 'Customer', 3, 'Your most unhappy customers are your greatest source of learning.', 'Bill Gates'),
('Say thank you to a customer', 'Send a brief, genuine thank-you note to a customer or client who has been loyal or patient.', 'Customer', 3, 'Courteous treatment will make a customer a walking advertisement.', 'James Cash Penney'),
('Anticipate an unspoken need', 'Think about a current customer interaction and consider what they might need next before they ask for it.', 'Customer', 5, 'The goal as a company is to have customer service that is not just the best, but legendary.', 'Sam Walton'),
('Share a customer win', 'Tell your team about a recent customer success story and what your team did to make it happen.', 'Customer', 3, 'There is only one boss: the customer.', 'Sam Walton'),

-- ===================== Collaboration =====================
('Ask before assuming', 'Before starting a task that affects another team, reach out and ask how your work connects to theirs.', 'Collaboration', 5, 'Alone we can do so little; together we can do so much.', 'Helen Keller'),
('Give credit publicly', 'In your next team meeting or chat, publicly acknowledge a colleague''s contribution that might otherwise go unnoticed.', 'Collaboration', 2, 'A candle loses nothing by lighting another candle.', 'James Keller'),
('Pair up on a problem', 'Find a task you''re working on solo and invite a colleague to co-work on it for 15 minutes.', 'Collaboration', 5, 'If you want to go fast, go alone. If you want to go far, go together.', 'African Proverb'),
('Close the loop', 'Follow up on a request someone made of you, even if just to say "still working on it." Don''t leave people wondering.', 'Collaboration', 2, 'The single biggest problem in communication is the illusion that it has taken place.', 'George Bernard Shaw'),
('Listen without solving', 'In your next conversation, focus entirely on understanding the other person''s perspective before offering a solution.', 'Collaboration', 5, 'Most people do not listen with the intent to understand; they listen with the intent to reply.', 'Stephen R. Covey'),

-- ===================== Empowered Teams =====================
('Ask "What do you think?"', 'Instead of providing the answer, ask a team member for their recommendation on a decision today.', 'Empowered Teams', 3, 'The best executive is the one who has sense enough to pick good people to do what needs to be done, and self-restraint to keep from meddling.', 'Theodore Roosevelt'),
('Let someone own the outcome', 'Identify a task where you normally review every detail. Step back and let the person own it end-to-end.', 'Empowered Teams', 5, 'Trust is the glue of life. It''s the foundational principle that holds all relationships.', 'Stephen R. Covey'),
('Share context, not just tasks', 'When assigning work, explain the why and the context so the person can make good decisions independently.', 'Empowered Teams', 5, 'If you want to build a ship, don''t drum up the men to gather wood but teach them to yearn for the vast and endless sea.', 'Antoine de Saint-Exupery'),
('Celebrate autonomous decisions', 'Find a decision someone on your team made without asking you and thank them for taking initiative.', 'Empowered Teams', 3, 'The greatest leader is not the one who does the greatest things, but the one who gets people to do the greatest things.', 'Ronald Reagan'),
('Remove one blocker', 'Ask your team: what is one thing slowing you down? Then take action to remove that obstacle today.', 'Empowered Teams', 5, 'Leadership is about making others better as a result of your presence and making sure that impact lasts in your absence.', 'Sheryl Sandberg'),

-- ===================== Capability Development =====================
('Share a resource you found valuable', 'Send your team an article, podcast, or video that taught you something useful and explain why it matters.', 'Capability Development', 3, 'An investment in knowledge pays the best interest.', 'Benjamin Franklin'),
('Give developmental feedback', 'Offer one specific piece of growth-oriented feedback to a colleague. Focus on behavior, not character.', 'Capability Development', 5, 'Feedback is the breakfast of champions.', 'Ken Blanchard'),
('Ask someone to teach you', 'Identify a skill a colleague has that you admire and ask them to spend five minutes showing you how they do it.', 'Capability Development', 5, 'The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.', 'Brian Herbert'),
('Document one thing you learned', 'After solving a problem today, write a brief note about what you learned so others (or future you) can benefit.', 'Capability Development', 5, 'Knowledge is of no value unless you put it into practice.', 'Anton Chekhov'),
('Set a 30-day learning goal', 'Choose one skill you want to improve in the next 30 days and write down three small steps to get there.', 'Capability Development', 5, 'The expert in anything was once a beginner.', 'Helen Hayes'),

-- ===================== Learning =====================
('Read outside your field', 'Spend ten minutes reading an article from a field completely different from yours. Note one transferable idea.', 'Learning', 10, 'The more that you read, the more things you will know. The more that you learn, the more places you''ll go.', 'Dr. Seuss'),
('Teach what you just learned', 'After learning something new, explain it to a colleague in your own words within the hour.', 'Learning', 5, 'If you can''t explain it simply, you don''t understand it well enough.', 'Albert Einstein'),
('Try a new tool or method', 'Pick one tool, shortcut, or technique you''ve been meaning to try and use it on a real task today.', 'Learning', 10, 'I have no special talents. I am only passionately curious.', 'Albert Einstein'),
('Reflect on a mistake', 'Think of a recent mistake or setback. Write down one lesson you can carry forward.', 'Learning', 5, 'Anyone who has never made a mistake has never tried anything new.', 'Albert Einstein'),
('Listen to a five-minute podcast or talk', 'Find a short talk on a topic that stretches your thinking and listen during a break or commute.', 'Learning', 5, 'Education is not the filling of a pail, but the lighting of a fire.', 'W.B. Yeats'),

-- ===================== Change Ready =====================
('Name your resistance', 'Identify one change you are currently resisting. Write down the specific fear or concern driving the resistance.', 'Change Ready', 5, 'The secret of change is to focus all of your energy not on fighting the old, but on building the new.', 'Socrates'),
('Talk to an early adopter', 'Find someone who has already embraced a change you''re uncertain about and ask what they learned.', 'Change Ready', 5, 'Progress is impossible without change, and those who cannot change their minds cannot change anything.', 'George Bernard Shaw'),
('Experiment on a small scale', 'Pick one new approach and try it in a low-risk context today. Evaluate what happened.', 'Change Ready', 5, 'The only way to make sense out of change is to plunge into it, move with it, and join the dance.', 'Alan Watts'),
('Update one outdated habit', 'Identify a routine you follow out of habit rather than effectiveness. Try a small variation today.', 'Change Ready', 5, 'Your life does not get better by chance, it gets better by change.', 'Jim Rohn'),
('Write a change benefit list', 'For a change you are navigating, list three concrete benefits it could bring to you or your team.', 'Change Ready', 3, 'Change is the law of life. And those who look only to the past or present are certain to miss the future.', 'John F. Kennedy'),

-- ===================== Future Focused =====================
('Scan for weak signals', 'Spend five minutes browsing industry news or trends and note one emerging pattern that could affect your work.', 'Future Focused', 5, 'The best way to predict the future is to create it.', 'Peter Drucker'),
('Write a "What if?" scenario', 'Think about one possible future disruption to your team and write down a simple contingency step.', 'Future Focused', 5, 'It is not the strongest of the species that survives, nor the most intelligent, but the one most responsive to change.', 'Charles Darwin'),
('Ask your team about the future', 'In your next conversation, ask: "What do you think we''ll need to be good at a year from now?"', 'Future Focused', 3, 'The future belongs to those who prepare for it today.', 'Malcolm X'),
('Invest ten minutes in a future skill', 'Spend ten minutes learning something that isn''t urgent today but will be important in six months.', 'Future Focused', 10, 'Someone is sitting in the shade today because someone planted a tree a long time ago.', 'Warren Buffett'),
('Revisit a shelved idea', 'Look back at an idea you or your team set aside. Has anything changed that makes it worth revisiting?', 'Future Focused', 5, 'Innovation distinguishes between a leader and a follower.', 'Steve Jobs'),

-- ===================== Community =====================
('Welcome a newcomer', 'If someone new joined recently, reach out with a brief welcome message and offer to answer any questions.', 'Community', 3, 'We rise by lifting others.', 'Robert Ingersoll'),
('Reconnect with a distant colleague', 'Send a quick message to someone you haven''t spoken to in a while to check in and maintain the relationship.', 'Community', 3, 'No man is an island entire of itself; every man is a piece of the continent.', 'John Donne'),
('Organize a virtual coffee', 'Invite a colleague you don''t work with directly for a casual 15-minute conversation to build your network.', 'Community', 5, 'The currency of real networking is not greed but generosity.', 'Keith Ferrazzi'),
('Contribute to a shared resource', 'Add something useful to a shared document, wiki, or channel that helps the broader team.', 'Community', 5, 'We make a living by what we get, but we make a life by what we give.', 'Winston Churchill'),
('Express genuine gratitude', 'Write a specific thank-you message to someone whose work positively affects your day-to-day, even indirectly.', 'Community', 3, 'Gratitude is not only the greatest of virtues, but the parent of all the others.', 'Marcus Tullius Cicero'),

-- ===================== Psychological Safety =====================
('Normalize not knowing', 'In your next meeting, say "I don''t know" about something and model the behavior of openly seeking help.', 'Psychological Safety', 3, 'Vulnerability is the birthplace of innovation, creativity, and change.', 'Brene Brown'),
('Ask for feedback on yourself', 'Ask a colleague: "What is one thing I could do differently to make our collaboration better?"', 'Psychological Safety', 5, 'Feedback is a gift. Ideas are the currency of our next success.', 'Jim Trinka'),
('Celebrate a productive failure', 'Share or acknowledge a recent experiment that didn''t work out and highlight what the team learned from it.', 'Psychological Safety', 5, 'Failure is simply the opportunity to begin again, this time more intelligently.', 'Henry Ford'),
('Make space for quiet voices', 'In your next group discussion, specifically invite input from someone who hasn''t spoken yet.', 'Psychological Safety', 3, 'Diversity is being invited to the party; inclusion is being asked to dance.', 'Verna Myers'),
('Respond to bad news with curiosity', 'The next time someone shares a problem or mistake, respond with a question ("Tell me more") instead of judgment.', 'Psychological Safety', 3, 'In a growth mindset, challenges are exciting rather than threatening.', 'Carol Dweck'),

-- ===================== DEIA =====================
('Audit your meeting dynamics', 'In your next meeting, notice who speaks the most and who the least. Afterward, consider how to balance participation.', 'DEIA', 5, 'Diversity is not about how we differ. Diversity is about embracing one another''s uniqueness.', 'Ola Joseph'),
('Learn one thing about a colleague''s background', 'Ask a colleague about a cultural tradition, holiday, or experience that is important to them.', 'DEIA', 5, 'We all should know that diversity makes for a rich tapestry.', 'Maya Angelou'),
('Review your language', 'Scan a recent email or document for jargon, idioms, or phrases that might not translate well across cultures.', 'DEIA', 5, 'Inclusion is not a matter of political correctness. It is the key to growth.', 'Jesse Jackson'),
('Amplify an overlooked idea', 'If you notice a colleague''s idea being talked over or ignored, restate it and credit them by name.', 'DEIA', 3, 'The highest result of education is tolerance.', 'Helen Keller'),
('Seek a different perspective', 'Before making a decision, deliberately ask someone with a different background or role for their viewpoint.', 'DEIA', 5, 'It is not our differences that divide us. It is our inability to recognize, accept, and celebrate those differences.', 'Audre Lorde'),

-- ===================== Wellbeing =====================
('Set a hard stop', 'Choose a time to stop working today and honor it. Close the laptop and step away.', 'Wellbeing', 2, 'You can''t pour from an empty cup. Take care of yourself first.', ''),
('Move your body', 'Take a five-minute walk, stretch, or do a quick exercise. Movement resets your focus and energy.', 'Wellbeing', 5, 'Take care of your body. It''s the only place you have to live.', 'Jim Rohn'),
('Practice a one-minute breathing exercise', 'Close your eyes and take six slow, deep breaths. Inhale for four counts, exhale for six.', 'Wellbeing', 2, 'Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.', 'Thich Nhat Hanh'),
('Eat one meal mindfully', 'At your next meal, put away your phone and eat without multitasking. Notice the taste and texture.', 'Wellbeing', 10, 'The greatest wealth is health.', 'Virgil'),
('Acknowledge your energy level', 'Check in with yourself: rate your energy 1-10. If it is below 5, take one restorative action before continuing.', 'Wellbeing', 2, 'Rest when you''re weary. Refresh and renew yourself, your body, your mind, your spirit.', 'Ralph Marston'),

-- ===================== General =====================
('Start the day with intention', 'Before checking email, write down the one thing that would make today a success if you accomplished it.', 'General', 3, 'Either you run the day, or the day runs you.', 'Jim Rohn'),
('Practice the 2-minute gratitude', 'Write down two things you are grateful for right now: one personal, one professional.', 'General', 2, 'Gratitude turns what we have into enough.', 'Melody Beattie'),
('Do a weekly review', 'Spend five minutes reviewing what you accomplished this week and what you want to carry into next week.', 'General', 5, 'Without reflection, we go blindly on our way.', 'Margaret J. Wheatley'),
('Clean up one thing', 'Tidy your desk, organize one folder, or clear out five old emails. A small reset creates mental clarity.', 'General', 5, 'For every minute spent organizing, an hour is earned.', 'Benjamin Franklin'),
('Write down one thing you''re proud of', 'At the end of the day, note one thing you did well. Building a record of wins fuels resilience.', 'General', 2, 'Believe you can and you''re halfway there.', 'Theodore Roosevelt');
