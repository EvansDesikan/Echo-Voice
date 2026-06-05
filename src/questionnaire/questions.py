"""
Research Engineer — Psychometric Questionnaire
Based on the IPIP-NEO Big Five framework adapted for personality reconstruction.
60 questions across 5 dimensions + 2 behavioral modules.
Each question answered on a 1–5 Likert scale.
  1 = Very unlike me / Strongly disagree
  5 = Very like me / Strongly agree

IMPORTANT: This is a preference assessment, NOT a clinical or diagnostic tool.
See docs/reports/safety_compliance_report.md for full disclaimer requirements.
"""

from dataclasses import dataclass
from typing import List


@dataclass
class Question:
    id: str
    text_de: str       # German (primary for danach.de)
    text_en: str       # English
    dimension: str     # O, C, E, A, N, BEH (behavioural), COMM (communication)
    reversed: bool     # True = reverse-score this item (5 becomes 1, etc.)


QUESTIONNAIRE: List[Question] = [

    # ── OPENNESS (O) — 10 questions ─────────────────────────────────────────
    Question("O1",  "Ich liebte es, neue Ideen zu erkunden und über das Unbekannte nachzudenken.",
                    "I loved exploring new ideas and thinking about the unknown.", "O", False),
    Question("O2",  "Kunst, Musik oder Literatur berührten mich tief.",
                    "Art, music, or literature moved me deeply.", "O", False),
    Question("O3",  "Ich bevorzugte Routine gegenüber neuen Erfahrungen.",
                    "I preferred routine over new experiences.", "O", True),
    Question("O4",  "Ich ließ mich leicht von Schönheit in der Natur oder im Alltag begeistern.",
                    "I was easily captivated by beauty in nature or everyday life.", "O", False),
    Question("O5",  "Abstrakte Konzepte und philosophische Fragen interessierten mich.",
                    "Abstract concepts and philosophical questions interested me.", "O", False),
    Question("O6",  "Ich probierte gerne neue Küchen oder unbekannte Speisen aus.",
                    "I enjoyed trying new cuisines or unfamiliar foods.", "O", False),
    Question("O7",  "Ich hielt lieber an bewährten Methoden fest, als Neues auszuprobieren.",
                    "I preferred sticking to tried methods rather than experimenting.", "O", True),
    Question("O8",  "Meine Vorstellungskraft war lebhaft und aktiv.",
                    "My imagination was vivid and active.", "O", False),
    Question("O9",  "Ich interessierte mich für andere Kulturen und Lebensweisen.",
                    "I was curious about other cultures and ways of living.", "O", False),
    Question("O10", "Ich mochte es nicht, wenn Dinge zu kompliziert wurden.",
                    "I didn't like it when things got too complicated.", "O", True),

    # ── CONSCIENTIOUSNESS (C) — 10 questions ────────────────────────────────
    Question("C1",  "Ich erledigte meine Aufgaben immer pünktlich und gründlich.",
                    "I always completed my tasks on time and thoroughly.", "C", False),
    Question("C2",  "Ich war von Natur aus ordentlich und organisiert.",
                    "I was naturally tidy and organised.", "C", False),
    Question("C3",  "Ich neigte dazu, Dinge auf den letzten Drücker zu erledigen.",
                    "I tended to leave things to the last minute.", "C", True),
    Question("C4",  "Ich setzte mir klare Ziele und arbeitete systematisch darauf hin.",
                    "I set clear goals and worked toward them systematically.", "C", False),
    Question("C5",  "Ich ließ mich leicht durch Ablenkungen aus meiner Arbeit reißen.",
                    "I was easily distracted from my work.", "C", True),
    Question("C6",  "Verlässlichkeit war mir sehr wichtig — wenn ich etwas sagte, hielt ich es.",
                    "Reliability was very important to me — if I said something, I kept it.", "C", False),
    Question("C7",  "Ich plante gerne im Voraus, anstatt spontan zu handeln.",
                    "I liked to plan ahead rather than act spontaneously.", "C", False),
    Question("C8",  "Ich hatte manchmal Schwierigkeiten, angefangene Projekte zu beenden.",
                    "I sometimes had difficulty finishing projects I had started.", "C", True),
    Question("C9",  "Ich arbeitete hart, auch wenn die Aufgabe langweilig war.",
                    "I worked hard even when the task was boring.", "C", False),
    Question("C10", "Ich achtete sehr auf Details.",
                    "I paid close attention to details.", "C", False),

    # ── EXTRAVERSION (E) — 10 questions ─────────────────────────────────────
    Question("E1",  "In geselliger Runde war ich meistens derjenige, der das Gespräch am Laufen hielt.",
                    "In social gatherings, I was usually the one keeping the conversation going.", "E", False),
    Question("E2",  "Ich zog es vor, Zeit allein zu verbringen, statt mit vielen Menschen zusammen zu sein.",
                    "I preferred spending time alone rather than with many people.", "E", True),
    Question("E3",  "Ich fühlte mich nach langen Sozialsituationen eher erschöpft als energiegeladen.",
                    "I felt drained rather than energised after long social situations.", "E", True),
    Question("E4",  "Ich liebte es, im Mittelpunkt zu stehen.",
                    "I loved being the centre of attention.", "E", False),
    Question("E5",  "Ich knüpfte leicht neue Bekanntschaften.",
                    "I made new acquaintances easily.", "E", False),
    Question("E6",  "Ich war die Seele der Party.",
                    "I was the life of the party.", "E", False),
    Question("E7",  "Ich war eher still und zurückhaltend in Gruppen.",
                    "I was rather quiet and reserved in groups.", "E", True),
    Question("E8",  "Ich suchte aktiv nach Gesellschaft und Anschluss.",
                    "I actively sought out company and connection.", "E", False),
    Question("E9",  "Ich sprach gerne über mich und meine Erfahrungen.",
                    "I enjoyed talking about myself and my experiences.", "E", False),
    Question("E10", "Ich fand Smalltalk anstrengend.",
                    "I found small talk exhausting.", "E", True),

    # ── AGREEABLENESS (A) — 10 questions ────────────────────────────────────
    Question("A1",  "Anderen zu helfen bereitete mir echte Freude.",
                    "Helping others gave me genuine joy.", "A", False),
    Question("A2",  "Ich war leicht bereit, Kompromisse zu schließen.",
                    "I was willing to compromise easily.", "A", False),
    Question("A3",  "Ich konnte sehr direkt und manchmal schroff sein.",
                    "I could be very direct and sometimes blunt.", "A", True),
    Question("A4",  "Das Wohlbefinden anderer lag mir am Herzen.",
                    "The wellbeing of others was important to me.", "A", False),
    Question("A5",  "Ich vertraute Menschen im Allgemeinen schnell.",
                    "I generally trusted people quickly.", "A", False),
    Question("A6",  "Ich konnte Menschen gegenüber misstrauisch oder skeptisch sein.",
                    "I could be suspicious or sceptical of people.", "A", True),
    Question("A7",  "Ich stritt mich lieber als nachzugeben, wenn ich recht hatte.",
                    "I preferred to argue rather than give in when I was right.", "A", True),
    Question("A8",  "Ich war jemand, der andere aufbaute und ermutigte.",
                    "I was someone who lifted and encouraged others.", "A", False),
    Question("A9",  "Ich vermied Konflikte, wann immer es möglich war.",
                    "I avoided conflict whenever possible.", "A", False),
    Question("A10", "Ich konnte kalt oder gleichgültig wirken, wenn ich beschäftigt war.",
                    "I could come across as cold or indifferent when busy.", "A", True),

    # ── NEUROTICISM (N) — 10 questions ──────────────────────────────────────
    Question("N1",  "Ich machte mir häufig Sorgen um Dinge, die außerhalb meiner Kontrolle lagen.",
                    "I often worried about things outside my control.", "N", False),
    Question("N2",  "Ich blieb in stressigen Situationen meistens ruhig.",
                    "I stayed calm in stressful situations most of the time.", "N", True),
    Question("N3",  "Meine Stimmung schwankte oft ohne offensichtlichen Grund.",
                    "My mood often changed without obvious reason.", "N", False),
    Question("N4",  "Ich wurde leicht ärgerlich oder frustriert.",
                    "I got angry or frustrated easily.", "N", False),
    Question("N5",  "Ich fühlte mich oft unsicher oder zweifelte an mir selbst.",
                    "I often felt insecure or doubted myself.", "N", False),
    Question("N6",  "Ich war emotional stabil und ausgeglichen.",
                    "I was emotionally stable and balanced.", "N", True),
    Question("N7",  "Kritik traf mich tiefer als die meisten Menschen zugeben würden.",
                    "Criticism hit me harder than most people would admit.", "N", False),
    Question("N8",  "Ich konnte Rückschläge schnell verarbeiten und weitermachen.",
                    "I could process setbacks quickly and move on.", "N", True),
    Question("N9",  "Ich neigte dazu, Situationen negativer zu sehen als sie wirklich waren.",
                    "I tended to see situations more negatively than they really were.", "N", False),
    Question("N10", "Ich war jemand, der schnell in Panik geriet.",
                    "I was someone who panicked easily.", "N", False),

    # ── BEHAVIOURAL MODULE (BEH) — 5 questions ──────────────────────────────
    # These map directly to LLM behavioral tags.
    Question("BEH1", "Ich benutzte oft Humor, um Situationen aufzulockern.",
                     "I often used humour to lighten situations.", "BEH", False),
    Question("BEH2", "Wenn ich sprach, verwendete ich gerne Geschichten oder Beispiele.",
                     "When I spoke, I liked to use stories or examples.", "BEH", False),
    Question("BEH3", "Ich war jemand, der klare, direkte Aussagen bevorzugte — kein Umschweife.",
                     "I was someone who preferred clear, direct statements — no beating around the bush.", "BEH", False),
    Question("BEH4", "Ich sprach eher leise und bedächtig als laut und lebhaft.",
                     "I spoke in a quieter, measured way rather than loudly and animatedly.", "BEH", False),
    Question("BEH5", "In schwierigen Gesprächen suchte ich eher nach Lösungen als nach Mitgefühl.",
                     "In difficult conversations, I looked for solutions rather than sympathy.", "BEH", False),

    # ── COMMUNICATION MODULE (COMM) — 5 questions ───────────────────────────
    Question("COMM1", "Mit meiner Familie sprach ich anders (wärmer, offener) als mit Kollegen.",
                      "I spoke differently (warmer, more open) with family than with colleagues.", "COMM", False),
    Question("COMM2", "Ich drückte Zuneigung eher durch Taten als durch Worte aus.",
                      "I expressed affection more through actions than words.", "COMM", False),
    Question("COMM3", "Ich nannte Menschen gerne bei Spitznamen oder Kosenamen.",
                      "I liked to call people by nicknames or pet names.", "COMM", False),
    Question("COMM4", "Ich schloss Gespräche oft mit einem bestimmten Satz oder Ritual.",
                      "I often closed conversations with a certain phrase or ritual.", "COMM", False),
    Question("COMM5", "Schweigen war für mich kein Zeichen von Unbehagen — ich war gerne still.",
                      "Silence was not uncomfortable for me — I was content being quiet.", "COMM", False),
]


QUESTION_MAP = {q.id: q for q in QUESTIONNAIRE}


def get_questions_by_dimension(dimension: str) -> List[Question]:
    return [q for q in QUESTIONNAIRE if q.dimension == dimension]
