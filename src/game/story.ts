import { StoryEntry, ZoneId } from './types';

export const ZONE_NAMES: Record<ZoneId, string> = {
  forecourt: 'Vorhof der Großen Pyramide',
  entrance_hall: 'Vorhalle des Ra',
  trap_corridor: 'Passage der Prüfungen',
  secret_alcove: 'Geheime Schatzkammer des Wesirs',
  catacombs: 'Katakomben der Wächter',
  secret_catacombs: 'Geheime Nische der Katakomben',
  sanctum: 'Grabkammer des Chnum-Re',
};

export const STORY_ENTRIES: StoryEntry[] = [
  {
    id: 'prologue',
    chapter: 1,
    title: 'Das versiegelte Erbe von Chnum-Re',
    subtitle: 'Expeditionstagebuch · Eintrag I',
    text: 'Im Sandsturm von Sakkara legte unsere Grabung eine bisher unentdeckte Stufenpyramide frei. Alte Kartuschen nennen den vergessenen Pharao Chnum-Re, dessen Name aus allen Königslisten gemeißelt wurde. Der Legende nach verbarg er hier das Herz der Sonne — ein Artefakt von unermesslichem Licht, bewacht von uralten Mechanismen und den einbalsamierten Leibwächtern seines Hofes.',
    clue: 'Untersuche die Steintafeln in jeder Kammer. Sie bergen die Hinweise zur Öffnung der Siegel.',
  },
  {
    id: 'stele_hall',
    chapter: 2,
    title: 'Die Waage der Ma’at',
    subtitle: 'Inschrift der Vorhalle',
    text: '„Ehe du die Schwelle des Schattenkorridors überschreitest, Wanderer, bezeuge die Ordnung der Schöpfung. Nur wer die drei Drehsäulen im Einklang mit dem Lied der Priester ausrichtet, darf das Granittor öffnen.“',
    clue: 'Rätsel der drei Säulen (von links nach rechts): Zuerst erhebt sich der FALKE über den Nil, dann rollt der SKARABÄUS die Sonne empor, zuletzt schenkt das ANKH ewiges Leben.',
  },
  {
    id: 'secret_vesir',
    chapter: 3,
    title: 'Der Verrat des Hohepriesters Seti',
    subtitle: 'Geheime Aufzeichnung des Wesirs',
    text: '„Ich, Wesir Pentaur, verberge diese Zeilen hinter dem falschen Stein der Klingenpassage. Hohepriester Seti hat den Pharao verraten: Er versiegelte die Grabkammer von innen und erweckte den Fluch der Mumien, um die Krone der Ewigkeit für sich zu beanspruchen. Doch das Licht des Ra bleibt seine einzige Schwäche.“',
    clue: 'Nutze deinen Sonnenblitz [Q], um erwachte Mumien zu blenden, und schlage mit der Fackel [Klick / F] zu.',
  },
  {
    id: 'catacombs_hymn',
    chapter: 4,
    title: 'Hymne an die Brücke des Osiris',
    subtitle: 'Stele der Katakomben',
    text: '„Der Abgrund trennt die Sterblichen vom Allerheiligsten. Vier Siegel ruhen im Staub vor der Schlucht. Betritt sie im ewigen Kreislauf des Nils, auf dass der goldene Steg aus der Tiefe emporsteige.“',
    clue: 'Reihenfolge der 4 Bodenplatten: Zuerst der LOTUS des Morgens, dann die SCHLANGE der Tiefe, darauf die SONNE im Zenit und zuletzt der FALKE des Himmels.',
  },
  {
    id: 'sanctum_revelation',
    chapter: 5,
    title: 'Das Geheimnis des Sonnenkönigs',
    subtitle: 'Inschrift am Sarkophag des Chnum-Re',
    text: '„Chnum-Re wurde nicht gestürzt — er opferte sich selbst, um Setis dunklen Kult in der Tiefe einzuschließen. Erst wenn die beiden goldenen Sonnenspiegel das Himmelslicht auf den Kristall des Sarkophags bündeln, zerbricht das Siegel des Fluchs und die Krone der Ewigkeit kehrt ans Licht zurück.“',
    clue: 'Drehe die beiden Sonnenspiegel links und rechts in der Grabkammer mit [E], bis beide Lichtstrahlen den zentralen Kristall treffen.',
  },
];

export function getStoryById(id: string): StoryEntry | undefined {
  return STORY_ENTRIES.find((s) => s.id === id);
}
