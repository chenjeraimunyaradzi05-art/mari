/**
 * The reference the wellness pillar reads from: crisis lines, the content
 * library, the coping strategies the circles share, the forums, the habit
 * templates with the evidence behind them, the K10 questions, the mental
 * load vocabulary, and the practitioner directory's vocabulary.
 *
 * Every organisation, number and source here is real and Australian. Where
 * a figure could not be verified it is left out rather than guessed. None
 * of it is medical advice, and every page that shows it says so.
 */

export const LIBRARY_AS_AT = 'September 2026';

export interface CrisisLine {
  key: string;
  name: string;
  phone: string;
  url: string;
  when: string;
  who: string;
}

export const CRISIS_LINES: CrisisLine[] = [
  { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'If someone is in immediate danger' },
  { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7, call, text or chat', who: 'Anyone in crisis or thinking about suicide' },
  { key: 'suicide-call-back', name: 'Suicide Call Back Service', phone: '1300 659 467', url: 'https://www.suicidecallbackservice.org.au', when: '24/7', who: 'Anyone affected by suicide, with follow-up calls' },
  { key: 'beyond-blue', name: 'Beyond Blue', phone: '1300 22 4636', url: 'https://www.beyondblue.org.au', when: '24/7', who: 'Anxiety, depression, and how to talk about them' },
  { key: '13yarn', name: '13YARN', phone: '13 92 76', url: 'https://www.13yarn.org.au', when: '24/7', who: 'Aboriginal and Torres Strait Islander crisis support, run by mob' },
  { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', url: 'https://www.1800respect.org.au', when: '24/7', who: 'Domestic, family and sexual violence' },
  { key: 'panda', name: 'PANDA', phone: '1300 726 306', url: 'https://panda.org.au', when: 'Mon to Sat', who: 'Perinatal anxiety and depression, before and after a baby' },
  { key: 'qlife', name: 'QLife', phone: '1800 184 527', url: 'https://qlife.org.au', when: '3pm to midnight', who: 'LGBTIQ+ peer support' },
  { key: 'butterfly', name: 'Butterfly Foundation', phone: '1800 33 4673', url: 'https://butterfly.org.au', when: '8am to midnight', who: 'Eating disorders and body image' },
  { key: 'medicare-mental-health', name: 'Medicare Mental Health', phone: '1800 595 212', url: 'https://www.medicarementalhealth.gov.au', when: 'Business hours', who: 'Free help finding the right mental health service' },
  { key: 'healthdirect', name: 'healthdirect', phone: '1800 022 222', url: 'https://www.healthdirect.gov.au', when: '24/7', who: 'A nurse, for any health question' },
  { key: 'drug-hotline', name: 'National Alcohol and Other Drug Hotline', phone: '1800 250 015', url: 'https://www.health.gov.au/contacts/national-alcohol-and-other-drug-hotline', when: '24/7', who: 'Alcohol and other drugs, for you or someone you love' },
  { key: 'kids-helpline', name: 'Kids Helpline', phone: '1800 55 1800', url: 'https://kidshelpline.com.au', when: '24/7', who: 'Anyone aged 5 to 25' },
];

export interface LibraryItem {
  key: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  kind: 'guide' | 'tool' | 'program' | 'directory';
  minutes?: number;
}

export interface LibraryTopic {
  key: string;
  name: string;
  blurb: string;
  items: LibraryItem[];
}

export const LIBRARY: LibraryTopic[] = [
  {
    key: 'sleep',
    name: 'Sleep',
    blurb: 'Most of what fixes sleep is boring, and it works.',
    items: [
      { key: 'sleep-hygiene', title: 'Good sleep habits', summary: 'The routine, the room and the wind-down, from Australia’s sleep researchers.', source: 'Sleep Health Foundation', url: 'https://www.sleephealthfoundation.org.au', kind: 'guide', minutes: 6 },
      { key: 'insomnia-cbti', title: 'Insomnia, treated without pills', summary: 'Cognitive behavioural therapy for insomnia is the first-line treatment. This free online course teaches it.', source: 'This Way Up (St Vincent’s and UNSW)', url: 'https://thiswayup.org.au', kind: 'program', minutes: 15 },
      { key: 'sleep-hormones', title: 'Sleep through the cycle and menopause', summary: 'Why sleep changes before a period and around menopause, and what helps.', source: 'Jean Hailes for Women’s Health', url: 'https://www.jeanhailes.org.au', kind: 'guide', minutes: 8 },
    ],
  },
  {
    key: 'nutrition',
    name: 'Eating well',
    blurb: 'No diets. The Australian guidelines, and a dietitian when you want one.',
    items: [
      { key: 'dietary-guidelines', title: 'The Australian Dietary Guidelines', summary: 'Five food groups, how much of each, and the serve sizes that make it concrete.', source: 'Eat for Health (NHMRC)', url: 'https://www.eatforhealth.gov.au', kind: 'guide', minutes: 10 },
      { key: 'iron-women', title: 'Iron, and why women run short', summary: 'Heavy periods and pregnancy drain iron. The signs, the foods, and when to test.', source: 'Jean Hailes for Women’s Health', url: 'https://www.jeanhailes.org.au', kind: 'guide', minutes: 6 },
      { key: 'find-dietitian', title: 'Find an accredited practising dietitian', summary: 'Medicare rebates apply with a GP care plan. Search by suburb and specialty.', source: 'Dietitians Australia', url: 'https://dietitiansaustralia.org.au', kind: 'directory' },
    ],
  },
  {
    key: 'movement',
    name: 'Movement',
    blurb: 'Two and a half hours a week, in any pieces you like.',
    items: [
      { key: 'activity-guidelines', title: 'How much movement is enough', summary: '150 to 300 minutes of moderate activity a week, plus strength work on two days. That is the national guideline.', source: 'Australian Department of Health', url: 'https://www.health.gov.au/topics/physical-activity-and-exercise/physical-activity-and-exercise-guidelines-for-all-australians', kind: 'guide', minutes: 5 },
      { key: 'strength-women', title: 'Strength training for women', summary: 'Bone density, metabolism and mood all respond to lifting. Where to start with no gym.', source: 'Healthy Bones Australia', url: 'https://healthybonesaustralia.org.au', kind: 'guide', minutes: 7 },
      { key: 'exercise-pregnancy', title: 'Moving through pregnancy and after', summary: 'What is safe, what to change, and pelvic floor first.', source: 'Pregnancy, Birth and Baby (healthdirect)', url: 'https://www.pregnancybirthbaby.org.au', kind: 'guide', minutes: 6 },
    ],
  },
  {
    key: 'stress',
    name: 'Stress and mind',
    blurb: 'Skills that are taught, not talents you either have or do not.',
    items: [
      { key: 'smiling-mind', title: 'Ten minutes of mindfulness', summary: 'A free Australian app with guided programs for stress, sleep and focus.', source: 'Smiling Mind', url: 'https://www.smilingmind.com.au', kind: 'tool', minutes: 10 },
      { key: 'mindspot', title: 'Free online treatment for anxiety and stress', summary: 'Assessment and therapist-guided courses, free, from Macquarie University.', source: 'MindSpot', url: 'https://www.mindspot.org.au', kind: 'program' },
      { key: 'cci-workbooks', title: 'Self-help workbooks that therapists use', summary: 'Worry, perfectionism, self-esteem, panic and more, in plain modules you work through.', source: 'Centre for Clinical Interventions (WA Health)', url: 'https://www.cci.health.wa.gov.au', kind: 'tool' },
      { key: 'beyond-blue-anxiety', title: 'Anxiety and depression, explained', summary: 'The signs, what treatment looks like, and how to start the conversation.', source: 'Beyond Blue', url: 'https://www.beyondblue.org.au', kind: 'guide', minutes: 8 },
    ],
  },
  {
    key: 'hormones',
    name: 'Hormone health',
    blurb: 'Periods, PMS, perimenopause and menopause, without the mystery.',
    items: [
      { key: 'cycle-basics', title: 'Your cycle, explained', summary: 'What each phase does, what a normal range is, and what is worth a GP visit.', source: 'Jean Hailes for Women’s Health', url: 'https://www.jeanhailes.org.au', kind: 'guide', minutes: 8 },
      { key: 'endometriosis', title: 'Endometriosis and painful periods', summary: 'Pain that stops your day is not normal. Symptoms, diagnosis and the delay to avoid.', source: 'Endometriosis Australia', url: 'https://endometriosisaustralia.org', kind: 'guide', minutes: 7 },
      { key: 'menopause-doctor', title: 'Find a menopause doctor', summary: 'A directory of doctors with an interest in menopause and perimenopause.', source: 'Australasian Menopause Society', url: 'https://www.menopause.org.au', kind: 'directory' },
      { key: 'pcos', title: 'PCOS', summary: 'Irregular cycles, and the evidence-based guideline written in Australia.', source: 'Monash Centre for Health Research and Implementation', url: 'https://www.monash.edu/medicine/mchri/pcos', kind: 'guide', minutes: 9 },
    ],
  },
  {
    key: 'sexual-wellness',
    name: 'Sexual wellness and relationships',
    blurb: 'Contraception, desire, pain, consent, and where to ask the questions.',
    items: [
      { key: 'true-qld', title: 'Sexual and reproductive health clinics, Queensland', summary: 'Contraception, cervical screening, pregnancy options and counselling.', source: 'True Relationships & Reproductive Health', url: 'https://www.true.org.au', kind: 'directory' },
      { key: 'fpa', title: 'Family Planning Australia', summary: 'Clinics and a talkline for contraception and sexual health questions.', source: 'Family Planning Australia', url: 'https://www.fpnsw.org.au', kind: 'directory' },
      { key: 'relationships-australia', title: 'Relationship counselling', summary: 'Counselling for couples, families and after separation, on a sliding fee.', source: 'Relationships Australia', url: 'https://www.relationships.org.au', kind: 'directory' },
    ],
  },
  {
    key: 'ageing',
    name: 'Ageing well',
    blurb: 'Heart, bones and screening. The checks that are due, and when.',
    items: [
      { key: 'heart-women', title: 'Heart disease in women', summary: 'The leading cause of death in Australian women, with symptoms that differ from men’s. A Heart Health Check is free with Medicare.', source: 'Heart Foundation', url: 'https://www.heartfoundation.org.au', kind: 'guide', minutes: 7 },
      { key: 'bone-health', title: 'Bone health after 45', summary: 'Oestrogen protects bone; menopause removes it. Calcium, vitamin D, strength work and when to scan.', source: 'Healthy Bones Australia', url: 'https://healthybonesaustralia.org.au', kind: 'guide', minutes: 6 },
      { key: 'screening', title: 'The screening that is due', summary: 'Cervical screening every five years from 25, breast screening every two years from 50, bowel screening from 45.', source: 'Australian Department of Health', url: 'https://www.health.gov.au/topics/cancer/screening', kind: 'guide', minutes: 5 },
    ],
  },
  {
    key: 'substance-use',
    name: 'Alcohol, drugs and support',
    blurb: 'Judgement-free, confidential, and there when you want to change something.',
    items: [
      { key: 'hello-sunday-morning', title: 'Changing your relationship with alcohol', summary: 'An online community and app for drinking less, with no requirement to stop.', source: 'Hello Sunday Morning', url: 'https://hellosundaymorning.org', kind: 'program' },
      { key: 'counselling-online', title: 'Free online alcohol and drug counselling', summary: 'Chat with a counsellor any time, or work through self-help modules.', source: 'Counselling Online', url: 'https://www.counsellingonline.org.au', kind: 'program' },
      { key: 'adf', title: 'The facts on any drug', summary: 'Effects, risks and interactions, plainly written.', source: 'Alcohol and Drug Foundation', url: 'https://adf.org.au', kind: 'guide', minutes: 5 },
      { key: 'quitline', title: 'Quitline', summary: 'Call 13 7848 for a counsellor and a plan to quit smoking or vaping.', source: 'Quitline', url: 'https://www.quit.org.au', kind: 'tool' },
    ],
  },
];

export interface CopingStrategy {
  key: string;
  name: string;
  topics: string[];
  minutes: number;
  how: string[];
  source: string;
  url: string;
}

/** Evidence-based strategies the circles share, each from a source that teaches it. */
export const COPING_STRATEGIES: CopingStrategy[] = [
  { key: 'paced-breathing', name: 'Paced breathing', topics: ['anxiety', 'stress', 'panic', 'burnout'], minutes: 3, how: ['Breathe in for four counts through your nose.', 'Out for six counts through your mouth, as if through a straw.', 'Ten rounds. The long out-breath is what settles the nervous system.'], source: 'Beyond Blue', url: 'https://www.beyondblue.org.au' },
  { key: 'grounding-54321', name: 'Grounding, five to one', topics: ['anxiety', 'trauma', 'panic'], minutes: 2, how: ['Name five things you can see.', 'Four you can feel, three you can hear, two you can smell, one you can taste.', 'It pulls attention out of the spiral and into the room.'], source: 'Phoenix Australia, Centre for Posttraumatic Mental Health', url: 'https://www.phoenixaustralia.org' },
  { key: 'thought-record', name: 'A thought record', topics: ['anxiety', 'depression', 'career-anxiety', 'confidence'], minutes: 10, how: ['Write the situation, the thought, and how strongly you believe it.', 'List the evidence for it, then the evidence against.', 'Write a fairer thought and re-rate the feeling. The gap is the point.'], source: 'Centre for Clinical Interventions', url: 'https://www.cci.health.wa.gov.au' },
  { key: 'behavioural-activation', name: 'Do the thing before you feel like it', topics: ['depression', 'grief', 'burnout'], minutes: 15, how: ['Low mood removes the wanting. Schedule one small valued activity anyway.', 'Rate mood before and after. Keep the record.', 'Add one activity a week. Action leads; motivation follows.'], source: 'Centre for Clinical Interventions', url: 'https://www.cci.health.wa.gov.au' },
  { key: 'worry-time', name: 'Worry time', topics: ['anxiety', 'stress', 'career-anxiety'], minutes: 15, how: ['Pick a daily fifteen-minute slot, not at bedtime.', 'When a worry arrives outside it, note it and postpone it to the slot.', 'In the slot, sort each worry into “can act” and “cannot”. Plan the first; practise letting the second go.'], source: 'This Way Up', url: 'https://thiswayup.org.au' },
  { key: 'self-compassion-break', name: 'A self-compassion break', topics: ['motherhood', 'burnout', 'confidence', 'grief'], minutes: 3, how: ['Name it: “This is hard right now.”', 'Common humanity: “Other women feel this too.”', 'Kindness: say to yourself what you would say to a friend, and mean it.'], source: 'Dr Kristin Neff, Self-Compassion research', url: 'https://self-compassion.org' },
  { key: 'values-check', name: 'A values check', topics: ['career-anxiety', 'burnout', 'return-to-work', 'confidence'], minutes: 10, how: ['Write the five things that matter most to you, not the goals, the qualities.', 'Rate how much of this week went toward each.', 'Choose one small action tomorrow that moves toward the lowest.'], source: 'Acceptance and Commitment Therapy, via Centre for Clinical Interventions', url: 'https://www.cci.health.wa.gov.au' },
  { key: 'sleep-wind-down', name: 'A wind-down hour', topics: ['stress', 'anxiety', 'motherhood', 'perimenopause'], minutes: 60, how: ['Screens off an hour before bed, lights low.', 'Same wake time every day, weekends included. That single rule does most of the work.', 'If awake for twenty minutes, get up and do something dull in dim light.'], source: 'Sleep Health Foundation', url: 'https://www.sleephealthfoundation.org.au' },
  { key: 'three-good-things', name: 'Three good things', topics: ['depression', 'stress', 'grief'], minutes: 5, how: ['Each night, write three things that went well and why.', 'Small counts. The coffee that was hot, the email that was kind.', 'Studied for over a decade; the effect on mood builds with weeks of practice.'], source: 'Black Dog Institute', url: 'https://www.blackdoginstitute.org.au' },
  { key: 'reaching-out', name: 'Saying it to one person', topics: ['depression', 'loneliness', 'grief', 'trauma'], minutes: 5, how: ['Pick one person. Send: “I have been struggling lately and wanted to tell someone. Can we talk this week?”', 'You do not need the whole story ready.', 'If no one comes to mind, Beyond Blue’s line is staffed all night.'], source: 'Beyond Blue', url: 'https://www.beyondblue.org.au' },
];

export interface ForumSeed {
  slug: string;
  name: string;
  topic: string;
  description: string;
  guidelines: string;
  sortOrder: number;
}

export const FORUM_SEEDS: ForumSeed[] = [
  { slug: 'anxiety', name: 'Anxiety', topic: 'anxiety', sortOrder: 1, description: 'Worry that will not switch off, panic, and the tricks that help on a bad day.', guidelines: 'Share what helps you, not what someone else must do. No diagnosing. Crisis? Call Lifeline on 13 11 14 first.' },
  { slug: 'depression-and-low-mood', name: 'Depression and low mood', topic: 'depression', sortOrder: 2, description: 'The heavy weeks, getting through them, and what treatment has been like.', guidelines: 'Be gentle with each other. Talk about medication as your own experience, never as advice. If you are thinking about suicide, the lines above are staffed now.' },
  { slug: 'stress-and-burnout', name: 'Stress and burnout', topic: 'stress', sortOrder: 3, description: 'Too much, for too long. Work, home, or both. How you noticed, and what you changed.', guidelines: 'Practical over perfect. No employer or colleague names.' },
  { slug: 'trauma-and-recovery', name: 'Trauma and recovery', topic: 'trauma', sortOrder: 4, description: 'Living after something happened. Flashbacks, boundaries, therapy, and slow progress.', guidelines: 'Use a content warning on anything that describes what happened. No graphic detail. 1800RESPECT is 1800 737 732.' },
  { slug: 'relationships', name: 'Relationships', topic: 'relationships', sortOrder: 5, description: 'Partners, exes, parents, friends. The hard conversations and the ones you are avoiding.', guidelines: 'No identifying details about the other person. If you are unsafe at home, the safety centre has a quiet exit and 1800RESPECT.' },
  { slug: 'motherhood', name: 'Motherhood', topic: 'motherhood', sortOrder: 6, description: 'Trying, pregnancy, loss, newborns, teenagers, and the mental load of all of it.', guidelines: 'Every path here is valid. Use a content warning for loss. PANDA is 1300 726 306 for perinatal support.' },
  { slug: 'career-anxiety', name: 'Career anxiety', topic: 'career-anxiety', sortOrder: 7, description: 'Impostor feelings, redundancy, going back after a break, and asking for more.', guidelines: 'No company names. Wins welcome; so are the days that were not.' },
  { slug: 'grief-and-loss', name: 'Grief and loss', topic: 'grief', sortOrder: 8, description: 'Death, miscarriage, divorce, a diagnosis. Grief takes the shape of the thing lost.', guidelines: 'There is no timeline here. Griefline is 1300 845 745 if you want a voice.' },
];

export const CONTENT_WARNINGS = ['Self-harm', 'Suicide', 'Eating disorders', 'Abuse', 'Sexual violence', 'Pregnancy loss', 'Substance use', 'Medical detail'];

export const CIRCLE_TOPICS = ['anxiety', 'burnout', 'return-to-work', 'new-motherhood', 'grief', 'perimenopause', 'chronic-illness', 'confidence', 'loneliness', 'career-anxiety', 'depression', 'trauma'];

export interface HabitTemplate {
  key: string;
  name: string;
  category: 'sleep' | 'movement' | 'mind' | 'nutrition' | 'connection' | 'hydration';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  targetPerWeek: number;
  cue: string;
  evidenceNote: string;
  evidenceUrl: string;
  metric?: 'HYDRATION_GLASSES' | 'SLEEP_HOURS' | 'ACTIVITY_SESSIONS' | 'MEDITATION_DAYS' | 'STEPS';
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { key: 'water-8', name: 'Drink eight glasses of water', category: 'hydration', difficulty: 'EASY', targetPerWeek: 7, cue: 'One with every meal and every coffee.', evidenceNote: 'The Australian adequate intake for women is about 2.1 litres of fluid a day.', evidenceUrl: 'https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/water', metric: 'HYDRATION_GLASSES' },
  { key: 'walk-30', name: 'Walk for thirty minutes', category: 'movement', difficulty: 'MEDIUM', targetPerWeek: 5, cue: 'After lunch, or the last stop early.', evidenceNote: 'Five brisk walks reach the 150 minutes a week the national guideline asks for.', evidenceUrl: 'https://www.health.gov.au/topics/physical-activity-and-exercise/physical-activity-and-exercise-guidelines-for-all-australians', metric: 'ACTIVITY_SESSIONS' },
  { key: 'strength-2x', name: 'Strength work, twice a week', category: 'movement', difficulty: 'HARD', targetPerWeek: 2, cue: 'Tuesday and Friday, twenty minutes, bodyweight is enough.', evidenceNote: 'Muscle-strengthening on at least two days a week is in the guideline and protects bone after menopause.', evidenceUrl: 'https://healthybonesaustralia.org.au', metric: 'ACTIVITY_SESSIONS' },
  { key: 'same-wake-time', name: 'Wake at the same time', category: 'sleep', difficulty: 'MEDIUM', targetPerWeek: 7, cue: 'Alarm set, weekends too.', evidenceNote: 'A fixed wake time anchors the body clock and is the first rule of insomnia treatment.', evidenceUrl: 'https://www.sleephealthfoundation.org.au', metric: 'SLEEP_HOURS' },
  { key: 'screens-off', name: 'Screens off an hour before bed', category: 'sleep', difficulty: 'HARD', targetPerWeek: 5, cue: 'Phone charges in the kitchen.', evidenceNote: 'Light and stimulation late in the evening delay sleep onset.', evidenceUrl: 'https://www.sleephealthfoundation.org.au' },
  { key: 'meditate-10', name: 'Ten minutes of mindfulness', category: 'mind', difficulty: 'MEDIUM', targetPerWeek: 5, cue: 'Before opening email.', evidenceNote: 'Mindfulness programs show moderate reductions in anxiety and stress across many trials.', evidenceUrl: 'https://www.smilingmind.com.au', metric: 'MEDITATION_DAYS' },
  { key: 'three-good-things', name: 'Write three good things', category: 'mind', difficulty: 'EASY', targetPerWeek: 7, cue: 'On the pillow, before the light goes off.', evidenceNote: 'A brief gratitude practice improves mood over weeks of use.', evidenceUrl: 'https://www.blackdoginstitute.org.au' },
  { key: 'veg-5', name: 'Five serves of vegetables', category: 'nutrition', difficulty: 'HARD', targetPerWeek: 5, cue: 'Two at lunch, three at dinner.', evidenceNote: 'The dietary guidelines recommend five serves a day for adult women.', evidenceUrl: 'https://www.eatforhealth.gov.au' },
  { key: 'breakfast', name: 'Eat breakfast', category: 'nutrition', difficulty: 'EASY', targetPerWeek: 7, cue: 'Oats made the night before.', evidenceNote: 'Regular meals steady energy and mood through the day.', evidenceUrl: 'https://www.eatforhealth.gov.au' },
  { key: 'daylight-10', name: 'Ten minutes of morning daylight', category: 'sleep', difficulty: 'EASY', targetPerWeek: 7, cue: 'Coffee outside.', evidenceNote: 'Morning light sets the circadian clock and improves sleep that night.', evidenceUrl: 'https://www.sleephealthfoundation.org.au' },
  { key: 'call-a-friend', name: 'Reach out to one person', category: 'connection', difficulty: 'MEDIUM', targetPerWeek: 3, cue: 'Walk-and-talk on the way home.', evidenceNote: 'Social connection is one of the strongest protective factors for mental health.', evidenceUrl: 'https://www.beyondblue.org.au' },
  { key: 'alcohol-free', name: 'An alcohol-free day', category: 'nutrition', difficulty: 'MEDIUM', targetPerWeek: 4, cue: 'Sparkling water in the wine glass.', evidenceNote: 'The Australian guideline is no more than ten standard drinks a week and no more than four on any day.', evidenceUrl: 'https://www.nhmrc.gov.au/health-advice/alcohol' },
  { key: 'stretch-10', name: 'Ten minutes of stretching', category: 'movement', difficulty: 'EASY', targetPerWeek: 5, cue: 'While the kettle boils.', evidenceNote: 'Flexibility and balance work belong in the weekly mix, especially from mid-life.', evidenceUrl: 'https://www.health.gov.au/topics/physical-activity-and-exercise/physical-activity-and-exercise-guidelines-for-all-australians' },
  { key: 'steps-8000', name: 'Eight thousand steps', category: 'movement', difficulty: 'MEDIUM', targetPerWeek: 5, cue: 'Stairs, not the lift.', evidenceNote: 'Around 7,000 to 8,000 daily steps is where mortality benefit levels off in large cohorts.', evidenceUrl: 'https://www.health.gov.au/topics/physical-activity-and-exercise', metric: 'STEPS' },
];

export interface K10Question {
  id: number;
  text: string;
}

/** The Kessler Psychological Distress Scale, as used in the National Health Survey. */
export const K10_QUESTIONS: K10Question[] = [
  { id: 1, text: 'tired out for no good reason?' },
  { id: 2, text: 'nervous?' },
  { id: 3, text: 'so nervous that nothing could calm you down?' },
  { id: 4, text: 'hopeless?' },
  { id: 5, text: 'restless or fidgety?' },
  { id: 6, text: 'so restless you could not sit still?' },
  { id: 7, text: 'depressed?' },
  { id: 8, text: 'that everything was an effort?' },
  { id: 9, text: 'so sad that nothing could cheer you up?' },
  { id: 10, text: 'worthless?' },
];

export const K10_OPTIONS = [
  { value: 1, label: 'None of the time' },
  { value: 2, label: 'A little of the time' },
  { value: 3, label: 'Some of the time' },
  { value: 4, label: 'Most of the time' },
  { value: 5, label: 'All of the time' },
];

export const MENTAL_LOAD_CATEGORIES: Array<{ key: string; label: string; invisible: boolean; examples: string }> = [
  { key: 'HOUSEHOLD', label: 'Household', invisible: false, examples: 'Cooking, cleaning, laundry, shopping' },
  { key: 'CHILDCARE', label: 'Childcare', invisible: false, examples: 'Drop-offs, bedtime, sick days' },
  { key: 'ADMIN', label: 'Admin', invisible: true, examples: 'Bills, forms, appointments, insurance' },
  { key: 'EMOTIONAL', label: 'Emotional labour', invisible: true, examples: 'Checking in, smoothing over, remembering birthdays' },
  { key: 'CARE', label: 'Caring for others', invisible: false, examples: 'Parents, relatives, a partner’s health' },
  { key: 'PLANNING', label: 'Planning and remembering', invisible: true, examples: 'Meals, calendars, gifts, school notes, what is running out' },
  { key: 'WORK_OVERFLOW', label: 'Work spilling over', invisible: false, examples: 'Evenings and weekends on the job' },
  { key: 'OTHER', label: 'Other', invisible: false, examples: 'Anything else' },
];

export interface DelegationTemplate {
  category: string;
  ask: string;
  handover: string[];
  boundary: string;
}

export const DELEGATION_TEMPLATES: DelegationTemplate[] = [
  { category: 'HOUSEHOLD', ask: 'Could you own {tasks} from now on, start to finish, including noticing when it needs doing?', handover: ['Agree what “done” looks like, once, and then do not re-do it.', 'Put it in their calendar, not yours.', 'Let the first fortnight be imperfect.'], boundary: 'I am not going to remind you; if it does not happen, it does not happen.' },
  { category: 'CHILDCARE', ask: 'Can you take {tasks} every week, and be the one the school or daycare calls for it?', handover: ['Share the school app and the group chat so the information reaches them first.', 'Hand over the contact details, the routines and the sizes.', 'Resist correcting how it is done.'], boundary: 'I will be off duty for this; please do not pass the questions back to me.' },
  { category: 'ADMIN', ask: 'Would you take over {tasks}? Everything is in the shared folder; you would be the account holder.', handover: ['Move the logins and the reminders to their phone.', 'Set the direct debits so nothing depends on memory.', 'Agree a monthly ten-minute money check together.'], boundary: 'Once it is yours, I will stop tracking it.' },
  { category: 'EMOTIONAL', ask: 'I have been carrying the checking-in and the remembering for everyone. Could you take {tasks}?', handover: ['Name the people and the dates, in their calendar with reminders.', 'Agree that a message from either of us counts.'], boundary: 'I will not be the one who notices for both of us any more.' },
  { category: 'CARE', ask: 'Could you share the care for {tasks}? Alternate weeks, or split the appointments and the calls.', handover: ['Ask the GP or service to list you both as contacts.', 'Keep one shared note with medications and what was said.'], boundary: 'I need at least one week in two where none of this is mine.' },
  { category: 'PLANNING', ask: 'Would you run {tasks} for the next month? The planning is the work; the doing is the small part.', handover: ['Give them the lists, the rhythms, and what tends to go wrong.', 'Do not fix it when it wobbles.'], boundary: 'If I have to plan it, I have not handed it over.' },
  { category: 'WORK_OVERFLOW', ask: 'Work is spilling into evenings. I need {tasks} covered so I can stop at a fixed time.', handover: ['Set a hard stop, and tell your manager it exists.', 'Move one recurring meeting or task off your plate.'], boundary: 'After seven, the laptop is closed.' },
  { category: 'OTHER', ask: 'Could you take {tasks}?', handover: ['Agree what done looks like.', 'Hand it over fully.'], boundary: 'Once handed over, it is not mine.' },
];

export const ACTIVITY_TYPES: Array<{ key: string; label: string; mindful?: boolean; strength?: boolean }> = [
  { key: 'walk', label: 'Walk' }, { key: 'run', label: 'Run' }, { key: 'cycle', label: 'Cycle' }, { key: 'swim', label: 'Swim' },
  { key: 'strength', label: 'Strength', strength: true }, { key: 'pilates', label: 'Pilates', strength: true }, { key: 'yoga', label: 'Yoga', mindful: true },
  { key: 'dance', label: 'Dance' }, { key: 'sport', label: 'Sport' }, { key: 'stretch', label: 'Stretching' },
  { key: 'meditation', label: 'Meditation', mindful: true }, { key: 'breathwork', label: 'Breathwork', mindful: true }, { key: 'other', label: 'Other' },
];

export const PERIOD_SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Breast tenderness', 'Mood swings', 'Acne', 'Back pain', 'Nausea', 'Cravings', 'Insomnia', 'Spotting'];

export const PRACTITIONER_KINDS: Array<{ key: string; label: string; plural: string }> = [
  { key: 'GP', label: 'GP', plural: 'GPs' },
  { key: 'OBGYN', label: 'Obstetrician-gynaecologist', plural: 'Obstetrician-gynaecologists' },
  { key: 'PSYCHOLOGIST', label: 'Psychologist', plural: 'Psychologists' },
  { key: 'PSYCHIATRIST', label: 'Psychiatrist', plural: 'Psychiatrists' },
  { key: 'COUNSELLOR', label: 'Counsellor', plural: 'Counsellors' },
  { key: 'THERAPIST', label: 'Therapist', plural: 'Therapists' },
  { key: 'NUTRITIONIST', label: 'Nutritionist', plural: 'Nutritionists' },
  { key: 'DIETITIAN', label: 'Dietitian', plural: 'Dietitians' },
  { key: 'DERMATOLOGIST', label: 'Dermatologist', plural: 'Dermatologists' },
  { key: 'SPORTS_MEDICINE', label: 'Sports medicine', plural: 'Sports medicine doctors' },
  { key: 'PHYSIOTHERAPIST', label: 'Physiotherapist', plural: 'Physiotherapists' },
  { key: 'MIDWIFE', label: 'Midwife', plural: 'Midwives' },
  { key: 'PELVIC_HEALTH', label: 'Pelvic health', plural: 'Pelvic health physios' },
  { key: 'SERVICE', label: 'Service', plural: 'Services and helplines' },
  { key: 'OTHER', label: 'Other', plural: 'Other practitioners' },
];

export const MODALITIES = ['CBT', 'ACT', 'DBT', 'EMDR', 'Trauma-informed', 'Schema therapy', 'Interpersonal therapy', 'Psychodynamic', 'Mindfulness-based', 'Somatic', 'Family therapy', 'Narrative therapy'];

export const SPECIALTIES = ['Anxiety', 'Depression', 'Trauma and PTSD', 'Perinatal', 'Fertility', 'Menopause', 'PCOS', 'Endometriosis', 'Eating disorders', 'ADHD', 'Grief', 'Relationships', 'Burnout and work stress', 'Sexual health', 'Chronic pain', 'Pelvic floor', 'Sleep', 'Body image', 'LGBTIQ+ affirming', 'Culturally safe care', 'Disability'];

export const SHARE_SCOPES: Array<{ key: string; label: string }> = [
  { key: 'checkins', label: 'Mood, stress, anxiety and energy' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'cycle', label: 'Cycle and symptoms' },
  { key: 'activity', label: 'Movement' },
  { key: 'medications', label: 'Medications' },
  { key: 'symptoms', label: 'Symptoms' },
  { key: 'mental-load', label: 'Mental load' },
];

export interface ServiceSeed {
  slug: string;
  name: string;
  kind: 'SERVICE';
  headline: string;
  bio: string;
  specialties: string[];
  phone?: string;
  website: string;
  state?: string;
  city?: string;
  telehealth: boolean;
  inPerson: boolean;
  bulkBilling: boolean;
  feeNote: string;
}

/**
 * Real Australian services the directory opens with. None accept in-app
 * bookings; each is reached by phone or its own site. Practitioners add
 * themselves from the practice page and are verified before they show.
 */
export const SERVICE_SEEDS: ServiceSeed[] = [
  { slug: 'beyond-blue-support-service', name: 'Beyond Blue Support Service', kind: 'SERVICE', headline: 'Counsellors by phone, chat or email, day and night', bio: 'Free, confidential support for anxiety, depression and suicide prevention. A counsellor can talk you through what is going on and where to go next.', specialties: ['Anxiety', 'Depression'], phone: '1300 22 4636', website: 'https://www.beyondblue.org.au', telehealth: true, inPerson: false, bulkBilling: true, feeNote: 'Free' },
  { slug: 'panda', name: 'PANDA National Helpline', kind: 'SERVICE', headline: 'Perinatal anxiety and depression, before and after birth', bio: 'Counsellors with lived and professional experience for expecting and new parents, partners included.', specialties: ['Perinatal', 'Anxiety', 'Depression'], phone: '1300 726 306', website: 'https://panda.org.au', telehealth: true, inPerson: false, bulkBilling: true, feeNote: 'Free' },
  { slug: 'mindspot', name: 'MindSpot Clinic', kind: 'SERVICE', headline: 'Free online assessment and treatment courses', bio: 'A digital mental health clinic from Macquarie University. Assessment, then therapist-guided courses for anxiety, depression and chronic pain, at no cost.', specialties: ['Anxiety', 'Depression', 'Chronic pain'], website: 'https://www.mindspot.org.au', telehealth: true, inPerson: false, bulkBilling: true, feeNote: 'Free' },
  { slug: 'this-way-up', name: 'This Way Up', kind: 'SERVICE', headline: 'Online CBT programs, clinician-supervised', bio: 'Evidence-based online courses for anxiety, depression, insomnia, stress and more, developed by St Vincent’s Hospital and UNSW. Free with a clinician, or a small fee alone.', specialties: ['Anxiety', 'Depression', 'Sleep', 'Burnout and work stress'], website: 'https://thiswayup.org.au', telehealth: true, inPerson: false, bulkBilling: false, feeNote: 'Free when prescribed by a clinician' },
  { slug: 'jean-hailes', name: 'Jean Hailes for Women’s Health', kind: 'SERVICE', headline: 'Women’s health information and clinics', bio: 'A national not-for-profit for women’s health: periods, fertility, PCOS, endometriosis, menopause and mental health, with clinics in Victoria and information for everyone.', specialties: ['Menopause', 'PCOS', 'Endometriosis', 'Fertility'], website: 'https://www.jeanhailes.org.au', state: 'VIC', city: 'Melbourne', telehealth: true, inPerson: true, bulkBilling: false, feeNote: 'Information free; clinic fees vary' },
  { slug: 'true-relationships-reproductive-health', name: 'True Relationships & Reproductive Health', kind: 'SERVICE', headline: 'Sexual and reproductive health clinics across Queensland', bio: 'Contraception, cervical screening, pregnancy options, menopause and sexual health, with clinics in Brisbane and regional Queensland.', specialties: ['Sexual health', 'Fertility', 'Menopause'], website: 'https://www.true.org.au', state: 'QLD', city: 'Brisbane', telehealth: true, inPerson: true, bulkBilling: true, feeNote: 'Bulk billing for eligible patients' },
  { slug: 'family-planning-australia', name: 'Family Planning Australia', kind: 'SERVICE', headline: 'Reproductive and sexual health clinics and talkline', bio: 'Clinics across New South Wales and a talkline for contraception, pregnancy and sexual health questions.', specialties: ['Sexual health', 'Fertility'], website: 'https://www.fpnsw.org.au', state: 'NSW', city: 'Sydney', telehealth: true, inPerson: true, bulkBilling: true, feeNote: 'Bulk billing for eligible patients' },
  { slug: 'butterfly-foundation', name: 'Butterfly National Helpline', kind: 'SERVICE', headline: 'Eating disorders and body image', bio: 'Counsellors for anyone concerned about eating, exercise or body image, for themselves or someone they love.', specialties: ['Eating disorders', 'Body image'], phone: '1800 33 4673', website: 'https://butterfly.org.au', telehealth: true, inPerson: false, bulkBilling: true, feeNote: 'Free' },
  { slug: '13yarn', name: '13YARN', kind: 'SERVICE', headline: 'Crisis support for Aboriginal and Torres Strait Islander people', bio: 'Run by mob, for mob. A confidential yarn with an Aboriginal or Torres Strait Islander crisis supporter, any time.', specialties: ['Culturally safe care'], phone: '13 92 76', website: 'https://www.13yarn.org.au', telehealth: true, inPerson: false, bulkBilling: true, feeNote: 'Free' },
  { slug: 'qlife', name: 'QLife', kind: 'SERVICE', headline: 'LGBTIQ+ peer support and referral', bio: 'Anonymous peer support by phone and webchat for sexuality, identity, gender, bodies, feelings and relationships.', specialties: ['LGBTIQ+ affirming'], phone: '1800 184 527', website: 'https://qlife.org.au', telehealth: true, inPerson: false, bulkBilling: true, feeNote: 'Free' },
  { slug: 'australian-psychological-society', name: 'Find a Psychologist (APS)', kind: 'SERVICE', headline: 'The national register of psychologists', bio: 'Search registered psychologists by location, issue and whether they offer telehealth. A GP mental health treatment plan brings a Medicare rebate to up to ten sessions a year.', specialties: ['Anxiety', 'Depression', 'Trauma and PTSD'], website: 'https://psychology.org.au/find-a-psychologist', telehealth: true, inPerson: true, bulkBilling: false, feeNote: 'Fees set by each psychologist' },
  { slug: 'australasian-menopause-society', name: 'Find a Doctor (Australasian Menopause Society)', kind: 'SERVICE', headline: 'Doctors with an interest in menopause', bio: 'A directory of GPs and specialists who have registered an interest in menopause and perimenopause care.', specialties: ['Menopause'], website: 'https://www.menopause.org.au', telehealth: false, inPerson: true, bulkBilling: false, feeNote: 'Fees set by each doctor' },
  { slug: 'healthdirect', name: 'healthdirect', kind: 'SERVICE', headline: 'A registered nurse, any hour, and a service finder', bio: 'Call for a nurse, use the symptom checker, or find a GP, pharmacy or after-hours clinic near you.', specialties: [], phone: '1800 022 222', website: 'https://www.healthdirect.gov.au', telehealth: true, inPerson: false, bulkBilling: true, feeNote: 'Free' },
  { slug: 'medicare-mental-health', name: 'Medicare Mental Health', kind: 'SERVICE', headline: 'Help finding the right mental health service', bio: 'A free national phone line and the Medicare Mental Health Centres, where you can walk in without a referral.', specialties: ['Anxiety', 'Depression'], phone: '1800 595 212', website: 'https://www.medicarementalhealth.gov.au', telehealth: true, inPerson: true, bulkBilling: true, feeNote: 'Free' },
];
