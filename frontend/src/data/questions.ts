export interface Question {
  id: string
  text: string      // German (default)
  text_en: string   // English
  dimension: string
  reversed: boolean
}

export const QUESTIONS: Question[] = [
  // OPENNESS
  { id:'O1', dimension:'O', reversed:false, text:'Ich liebte es, neue Ideen zu erkunden und über das Unbekannte nachzudenken.', text_en:'I loved exploring new ideas and thinking about the unknown.' },
  { id:'O2', dimension:'O', reversed:false, text:'Kunst, Musik oder Literatur berührten mich tief.', text_en:'Art, music, or literature moved me deeply.' },
  { id:'O3', dimension:'O', reversed:true,  text:'Ich bevorzugte Routine gegenüber neuen Erfahrungen.', text_en:'I preferred routine over new experiences.' },
  { id:'O4', dimension:'O', reversed:false, text:'Ich ließ mich leicht von Schönheit in der Natur oder im Alltag begeistern.', text_en:'I was easily captivated by beauty in nature or everyday life.' },
  { id:'O5', dimension:'O', reversed:false, text:'Abstrakte Konzepte und philosophische Fragen interessierten mich.', text_en:'Abstract concepts and philosophical questions interested me.' },
  { id:'O6', dimension:'O', reversed:false, text:'Ich probierte gerne neue Küchen oder unbekannte Speisen aus.', text_en:'I enjoyed trying new cuisines or unfamiliar foods.' },
  { id:'O7', dimension:'O', reversed:true,  text:'Ich hielt lieber an bewährten Methoden fest, als Neues auszuprobieren.', text_en:'I preferred sticking to tried methods rather than experimenting.' },
  { id:'O8', dimension:'O', reversed:false, text:'Meine Vorstellungskraft war lebhaft und aktiv.', text_en:'My imagination was vivid and active.' },
  { id:'O9', dimension:'O', reversed:false, text:'Ich interessierte mich für andere Kulturen und Lebensweisen.', text_en:'I was curious about other cultures and ways of living.' },
  { id:'O10',dimension:'O', reversed:true,  text:'Ich mochte es nicht, wenn Dinge zu kompliziert wurden.', text_en:"I didn't like it when things got too complicated." },
  // CONSCIENTIOUSNESS
  { id:'C1', dimension:'C', reversed:false, text:'Ich erledigte meine Aufgaben immer pünktlich und gründlich.', text_en:'I always completed my tasks on time and thoroughly.' },
  { id:'C2', dimension:'C', reversed:false, text:'Ich war von Natur aus ordentlich und organisiert.', text_en:'I was naturally tidy and organised.' },
  { id:'C3', dimension:'C', reversed:true,  text:'Ich neigte dazu, Dinge auf den letzten Drücker zu erledigen.', text_en:'I tended to leave things to the last minute.' },
  { id:'C4', dimension:'C', reversed:false, text:'Ich setzte mir klare Ziele und arbeitete systematisch darauf hin.', text_en:'I set clear goals and worked toward them systematically.' },
  { id:'C5', dimension:'C', reversed:true,  text:'Ich ließ mich leicht durch Ablenkungen aus meiner Arbeit reißen.', text_en:'I was easily distracted from my work.' },
  { id:'C6', dimension:'C', reversed:false, text:'Verlässlichkeit war mir sehr wichtig — wenn ich etwas sagte, hielt ich es.', text_en:'Reliability was very important to me — if I said something, I kept it.' },
  { id:'C7', dimension:'C', reversed:false, text:'Ich plante gerne im Voraus, anstatt spontan zu handeln.', text_en:'I liked to plan ahead rather than act spontaneously.' },
  { id:'C8', dimension:'C', reversed:true,  text:'Ich hatte manchmal Schwierigkeiten, angefangene Projekte zu beenden.', text_en:'I sometimes had difficulty finishing projects I had started.' },
  { id:'C9', dimension:'C', reversed:false, text:'Ich arbeitete hart, auch wenn die Aufgabe langweilig war.', text_en:'I worked hard even when the task was boring.' },
  { id:'C10',dimension:'C', reversed:false, text:'Ich achtete sehr auf Details.', text_en:'I paid close attention to details.' },
  // EXTRAVERSION
  { id:'E1', dimension:'E', reversed:false, text:'In geselliger Runde war ich meistens derjenige, der das Gespräch am Laufen hielt.', text_en:'In social gatherings, I was usually the one keeping the conversation going.' },
  { id:'E2', dimension:'E', reversed:true,  text:'Ich zog es vor, Zeit allein zu verbringen, statt mit vielen Menschen zusammen zu sein.', text_en:'I preferred spending time alone rather than with many people.' },
  { id:'E3', dimension:'E', reversed:true,  text:'Ich fühlte mich nach langen Sozialsituationen eher erschöpft als energiegeladen.', text_en:'I felt drained rather than energised after long social situations.' },
  { id:'E4', dimension:'E', reversed:false, text:'Ich liebte es, im Mittelpunkt zu stehen.', text_en:'I loved being the centre of attention.' },
  { id:'E5', dimension:'E', reversed:false, text:'Ich knüpfte leicht neue Bekanntschaften.', text_en:'I made new acquaintances easily.' },
  { id:'E6', dimension:'E', reversed:false, text:'Ich war die Seele der Party.', text_en:'I was the life of the party.' },
  { id:'E7', dimension:'E', reversed:true,  text:'Ich war eher still und zurückhaltend in Gruppen.', text_en:'I was rather quiet and reserved in groups.' },
  { id:'E8', dimension:'E', reversed:false, text:'Ich suchte aktiv nach Gesellschaft und Anschluss.', text_en:'I actively sought out company and connection.' },
  { id:'E9', dimension:'E', reversed:false, text:'Ich sprach gerne über mich und meine Erfahrungen.', text_en:'I enjoyed talking about myself and my experiences.' },
  { id:'E10',dimension:'E', reversed:true,  text:'Ich fand Smalltalk anstrengend.', text_en:'I found small talk exhausting.' },
  // AGREEABLENESS
  { id:'A1', dimension:'A', reversed:false, text:'Anderen zu helfen bereitete mir echte Freude.', text_en:'Helping others gave me genuine joy.' },
  { id:'A2', dimension:'A', reversed:false, text:'Ich war leicht bereit, Kompromisse zu schließen.', text_en:'I was willing to compromise easily.' },
  { id:'A3', dimension:'A', reversed:true,  text:'Ich konnte sehr direkt und manchmal schroff sein.', text_en:'I could be very direct and sometimes blunt.' },
  { id:'A4', dimension:'A', reversed:false, text:'Das Wohlbefinden anderer lag mir am Herzen.', text_en:'The wellbeing of others was important to me.' },
  { id:'A5', dimension:'A', reversed:false, text:'Ich vertraute Menschen im Allgemeinen schnell.', text_en:'I generally trusted people quickly.' },
  { id:'A6', dimension:'A', reversed:true,  text:'Ich konnte Menschen gegenüber misstrauisch oder skeptisch sein.', text_en:'I could be suspicious or sceptical of people.' },
  { id:'A7', dimension:'A', reversed:true,  text:'Ich stritt mich lieber als nachzugeben, wenn ich recht hatte.', text_en:'I preferred to argue rather than give in when I was right.' },
  { id:'A8', dimension:'A', reversed:false, text:'Ich war jemand, der andere aufbaute und ermutigte.', text_en:'I was someone who lifted and encouraged others.' },
  { id:'A9', dimension:'A', reversed:false, text:'Ich vermied Konflikte, wann immer es möglich war.', text_en:'I avoided conflict whenever possible.' },
  { id:'A10',dimension:'A', reversed:true,  text:'Ich konnte kalt oder gleichgültig wirken, wenn ich beschäftigt war.', text_en:'I could come across as cold or indifferent when busy.' },
  // NEUROTICISM
  { id:'N1', dimension:'N', reversed:false, text:'Ich machte mir häufig Sorgen um Dinge, die außerhalb meiner Kontrolle lagen.', text_en:'I often worried about things outside my control.' },
  { id:'N2', dimension:'N', reversed:true,  text:'Ich blieb in stressigen Situationen meistens ruhig.', text_en:'I stayed calm in stressful situations most of the time.' },
  { id:'N3', dimension:'N', reversed:false, text:'Meine Stimmung schwankte oft ohne offensichtlichen Grund.', text_en:'My mood often changed without obvious reason.' },
  { id:'N4', dimension:'N', reversed:false, text:'Ich wurde leicht ärgerlich oder frustriert.', text_en:'I got angry or frustrated easily.' },
  { id:'N5', dimension:'N', reversed:false, text:'Ich fühlte mich oft unsicher oder zweifelte an mir selbst.', text_en:'I often felt insecure or doubted myself.' },
  { id:'N6', dimension:'N', reversed:true,  text:'Ich war emotional stabil und ausgeglichen.', text_en:'I was emotionally stable and balanced.' },
  { id:'N7', dimension:'N', reversed:false, text:'Kritik traf mich tiefer als die meisten Menschen zugeben würden.', text_en:'Criticism hit me harder than most people would admit.' },
  { id:'N8', dimension:'N', reversed:true,  text:'Ich konnte Rückschläge schnell verarbeiten und weitermachen.', text_en:'I could process setbacks quickly and move on.' },
  { id:'N9', dimension:'N', reversed:false, text:'Ich neigte dazu, Situationen negativer zu sehen als sie wirklich waren.', text_en:'I tended to see situations more negatively than they really were.' },
  { id:'N10',dimension:'N', reversed:false, text:'Ich war jemand, der schnell in Panik geriet.', text_en:'I was someone who panicked easily.' },
  // BEHAVIOURAL
  { id:'BEH1', dimension:'BEH', reversed:false, text:'Ich benutzte oft Humor, um Situationen aufzulockern.', text_en:'I often used humour to lighten situations.' },
  { id:'BEH2', dimension:'BEH', reversed:false, text:'Wenn ich sprach, verwendete ich gerne Geschichten oder Beispiele.', text_en:'When I spoke, I liked to use stories or examples.' },
  { id:'BEH3', dimension:'BEH', reversed:false, text:'Ich war jemand, der klare, direkte Aussagen bevorzugte — kein Umschweife.', text_en:'I preferred clear, direct statements — no beating around the bush.' },
  { id:'BEH4', dimension:'BEH', reversed:false, text:'Ich sprach eher leise und bedächtig als laut und lebhaft.', text_en:'I spoke in a quieter, measured way rather than loudly and animatedly.' },
  { id:'BEH5', dimension:'BEH', reversed:false, text:'In schwierigen Gesprächen suchte ich eher nach Lösungen als nach Mitgefühl.', text_en:'In difficult conversations, I looked for solutions rather than sympathy.' },
  // COMMUNICATION
  { id:'COMM1', dimension:'COMM', reversed:false, text:'Mit meiner Familie sprach ich anders (wärmer, offener) als mit Kollegen.', text_en:'I spoke differently (warmer, more open) with family than with colleagues.' },
  { id:'COMM2', dimension:'COMM', reversed:false, text:'Ich drückte Zuneigung eher durch Taten als durch Worte aus.', text_en:'I expressed affection more through actions than words.' },
  { id:'COMM3', dimension:'COMM', reversed:false, text:'Ich nannte Menschen gerne bei Spitznamen oder Kosenamen.', text_en:'I liked to call people by nicknames or pet names.' },
  { id:'COMM4', dimension:'COMM', reversed:false, text:'Ich schloss Gespräche oft mit einem bestimmten Satz oder Ritual.', text_en:'I often closed conversations with a certain phrase or ritual.' },
  { id:'COMM5', dimension:'COMM', reversed:false, text:'Schweigen war für mich kein Zeichen von Unbehagen — ich war gerne still.', text_en:'Silence was not uncomfortable for me — I was content being quiet.' },
]

export const PAGES: Question[][] = []
for (let i = 0; i < QUESTIONS.length; i += 10) {
  PAGES.push(QUESTIONS.slice(i, i + 10))
}
