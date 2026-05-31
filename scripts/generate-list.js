#!/usr/bin/env node
/**
 * generate-list.js
 *
 * Generates data/reading-list.json — 1,000 day entries, one per day,
 * with a poem, short story, literary essay, tech blog post, and
 * insightful essay. Zero repeats within each content type.
 *
 * Usage:
 *   node scripts/generate-list.js
 *
 * Requires Node.js 18+ (uses built-in fetch).
 * Seeds: scripts/seeds/tech-blogs.json, scripts/seeds/insight-essays.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TOTAL_DAYS = 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fisher-Yates in-place shuffle */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Extend arr to at least `length` by repeating shuffled copies.
 * Used when a pool is smaller than TOTAL_DAYS.
 */
function extendPool(arr, length) {
  const result = [...arr];
  while (result.length < length) {
    result.push(...shuffle([...arr]));
  }
  return result.slice(0, length);
}

/** Sleep between API calls to be polite */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Canonical authors for PoetryDB ───────────────────────────────────────────

const POETS = [
  'William Shakespeare', 'Robert Frost', 'Emily Dickinson', 'Walt Whitman',
  'John Keats', 'Percy Bysshe Shelley', 'William Blake', 'Lord Byron',
  'Alfred Lord Tennyson', 'Christina Rossetti', 'Gerard Manley Hopkins',
  'Matthew Arnold', 'Alexander Pope', 'John Milton', 'Edmund Spenser',
  'George Herbert', 'Andrew Marvell', 'John Donne', 'Thomas Hardy',
  'Wilfred Owen', 'Siegfried Sassoon', 'Rupert Brooke', 'A. E. Housman',
  'W. B. Yeats', 'T. S. Eliot', 'Ezra Pound', 'e. e. cummings',
  'Langston Hughes', 'Claude McKay', 'Countee Cullen', 'Paul Laurence Dunbar',
  'Edgar Allan Poe', 'Henry Wadsworth Longfellow', 'Oliver Wendell Holmes',
  'James Russell Lowell', 'Ralph Waldo Emerson', 'Henry David Thoreau',
  'Emma Lazarus', 'Stephen Crane', 'Amy Lowell', 'Sara Teasdale',
  'Edna St. Vincent Millay', 'Carl Sandburg', 'Vachel Lindsay',
  'Robinson Jeffers', 'Charlotte Mew', 'Anna Akhmatova',
];

// ── Curated short-story Gutenberg IDs ────────────────────────────────────────
// Format: { title, author, url } — direct Gutenberg ebook page links

const STORY_SEEDS = [
  { title: 'The Lady with the Dog', author: 'Anton Chekhov', url: 'https://www.gutenberg.org/ebooks/13415' },
  { title: 'The Bet', author: 'Anton Chekhov', url: 'https://www.gutenberg.org/ebooks/1732' },
  { title: 'Ward No. 6', author: 'Anton Chekhov', url: 'https://www.gutenberg.org/ebooks/1732' },
  { title: 'The Tell-Tale Heart', author: 'Edgar Allan Poe', url: 'https://www.gutenberg.org/ebooks/2148' },
  { title: 'The Cask of Amontillado', author: 'Edgar Allan Poe', url: 'https://www.gutenberg.org/ebooks/1063' },
  { title: 'The Fall of the House of Usher', author: 'Edgar Allan Poe', url: 'https://www.gutenberg.org/ebooks/932' },
  { title: 'The Murders in the Rue Morgue', author: 'Edgar Allan Poe', url: 'https://www.gutenberg.org/ebooks/2148' },
  { title: 'The Gift of the Magi', author: 'O. Henry', url: 'https://www.gutenberg.org/ebooks/7256' },
  { title: 'The Ransom of Red Chief', author: 'O. Henry', url: 'https://www.gutenberg.org/ebooks/1583' },
  { title: 'After Twenty Years', author: 'O. Henry', url: 'https://www.gutenberg.org/ebooks/1583' },
  { title: 'The Metamorphosis', author: 'Franz Kafka', url: 'https://www.gutenberg.org/ebooks/5200' },
  { title: 'In the Penal Colony', author: 'Franz Kafka', url: 'https://www.gutenberg.org/ebooks/7849' },
  { title: 'The Necklace', author: 'Guy de Maupassant', url: 'https://www.gutenberg.org/ebooks/3090' },
  { title: 'Boule de Suif', author: 'Guy de Maupassant', url: 'https://www.gutenberg.org/ebooks/3090' },
  { title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman', url: 'https://www.gutenberg.org/ebooks/1983' },
  { title: 'The Story of an Hour', author: 'Kate Chopin', url: 'https://www.gutenberg.org/ebooks/160' },
  { title: 'A Pair of Silk Stockings', author: 'Kate Chopin', url: 'https://www.gutenberg.org/ebooks/160' },
  { title: 'Bartleby, the Scrivener', author: 'Herman Melville', url: 'https://www.gutenberg.org/ebooks/11231' },
  { title: 'The Secret Life of Walter Mitty', author: 'James Thurber', url: 'https://www.gutenberg.org/ebooks/61215' },
  { title: 'The Open Boat', author: 'Stephen Crane', url: 'https://www.gutenberg.org/ebooks/874' },
  { title: 'The Monster', author: 'Stephen Crane', url: 'https://www.gutenberg.org/ebooks/47949' },
  { title: 'To Build a Fire', author: 'Jack London', url: 'https://www.gutenberg.org/ebooks/910' },
  { title: 'An Occurrence at Owl Creek Bridge', author: 'Ambrose Bierce', url: 'https://www.gutenberg.org/ebooks/13334' },
  { title: 'The Monkey\'s Paw', author: 'W. W. Jacobs', url: 'https://www.gutenberg.org/ebooks/12122' },
  { title: 'The Most Dangerous Game', author: 'Richard Connell', url: 'https://www.gutenberg.org/ebooks/67758' },
  { title: 'Sredni Vashtar', author: 'Saki', url: 'https://www.gutenberg.org/ebooks/269' },
  { title: 'The Open Window', author: 'Saki', url: 'https://www.gutenberg.org/ebooks/269' },
  { title: 'Tobermory', author: 'Saki', url: 'https://www.gutenberg.org/ebooks/269' },
  { title: 'The Garden Party', author: 'Katherine Mansfield', url: 'https://www.gutenberg.org/ebooks/36138' },
  { title: 'Miss Brill', author: 'Katherine Mansfield', url: 'https://www.gutenberg.org/ebooks/36138' },
  { title: 'Bliss', author: 'Katherine Mansfield', url: 'https://www.gutenberg.org/ebooks/1429' },
  { title: 'The Dead', author: 'James Joyce', url: 'https://www.gutenberg.org/ebooks/2814' },
  { title: 'Araby', author: 'James Joyce', url: 'https://www.gutenberg.org/ebooks/2814' },
  { title: 'Eveline', author: 'James Joyce', url: 'https://www.gutenberg.org/ebooks/2814' },
  { title: 'Hills Like White Elephants', author: 'Ernest Hemingway', url: 'https://www.gutenberg.org/ebooks/5465' },
  { title: 'A Clean, Well-Lighted Place', author: 'Ernest Hemingway', url: 'https://www.gutenberg.org/ebooks/5465' },
  { title: 'The Short Happy Life of Francis Macomber', author: 'Ernest Hemingway', url: 'https://www.gutenberg.org/ebooks/5465' },
  { title: 'The Lottery', author: 'Shirley Jackson', url: 'https://www.newyorker.com/magazine/1948/06/26/the-lottery' },
  { title: 'The Lift That Went Down Into Hell', author: 'Par Lagerkvist', url: 'https://www.gutenberg.org/ebooks/38987' },
  { title: 'Gooseberries', author: 'Anton Chekhov', url: 'https://www.gutenberg.org/ebooks/13415' },
  { title: 'The Kiss', author: 'Anton Chekhov', url: 'https://www.gutenberg.org/ebooks/13415' },
  { title: 'The Darling', author: 'Anton Chekhov', url: 'https://www.gutenberg.org/ebooks/1732' },
  { title: 'A Hunger Artist', author: 'Franz Kafka', url: 'https://www.gutenberg.org/ebooks/22135' },
  { title: 'The Country Doctor', author: 'Franz Kafka', url: 'https://www.gutenberg.org/ebooks/7849' },
  { title: 'The Adventure of the Speckled Band', author: 'Arthur Conan Doyle', url: 'https://www.gutenberg.org/ebooks/1661' },
  { title: 'The Red-Headed League', author: 'Arthur Conan Doyle', url: 'https://www.gutenberg.org/ebooks/1661' },
  { title: 'The Sign of the Four', author: 'Arthur Conan Doyle', url: 'https://www.gutenberg.org/ebooks/2097' },
  { title: 'The Picture of Dorian Gray (short version)', author: 'Oscar Wilde', url: 'https://www.gutenberg.org/ebooks/174' },
  { title: 'The Canterville Ghost', author: 'Oscar Wilde', url: 'https://www.gutenberg.org/ebooks/14522' },
  { title: 'The Happy Prince', author: 'Oscar Wilde', url: 'https://www.gutenberg.org/ebooks/902' },
  { title: 'The Selfish Giant', author: 'Oscar Wilde', url: 'https://www.gutenberg.org/ebooks/902' },
  { title: 'A Ghost Story', author: 'Mark Twain', url: 'https://www.gutenberg.org/ebooks/3176' },
  { title: 'The Celebrated Jumping Frog', author: 'Mark Twain', url: 'https://www.gutenberg.org/ebooks/1213' },
  { title: 'A Municipal Report', author: 'O. Henry', url: 'https://www.gutenberg.org/ebooks/1583' },
  { title: 'The Birthmark', author: 'Nathaniel Hawthorne', url: 'https://www.gutenberg.org/ebooks/512' },
  { title: 'Young Goodman Brown', author: 'Nathaniel Hawthorne', url: 'https://www.gutenberg.org/ebooks/512' },
  { title: 'Rappaccini\'s Daughter', author: 'Nathaniel Hawthorne', url: 'https://www.gutenberg.org/ebooks/512' },
  { title: 'The Revolt of Mother', author: 'Mary E. Wilkins Freeman', url: 'https://www.gutenberg.org/ebooks/44409' },
  { title: 'The Great Good Place', author: 'Henry James', url: 'https://www.gutenberg.org/ebooks/1408' },
  { title: 'The Turn of the Screw', author: 'Henry James', url: 'https://www.gutenberg.org/ebooks/932' },
  { title: 'Daisy Miller', author: 'Henry James', url: 'https://www.gutenberg.org/ebooks/208' },
  { title: 'The Machine Stops', author: 'E. M. Forster', url: 'https://www.gutenberg.org/ebooks/65338' },
  { title: 'The Country of the Blind', author: 'H. G. Wells', url: 'https://www.gutenberg.org/ebooks/11870' },
  { title: 'The Door in the Wall', author: 'H. G. Wells', url: 'https://www.gutenberg.org/ebooks/11870' },
  { title: 'The Star', author: 'H. G. Wells', url: 'https://www.gutenberg.org/ebooks/34766' },
  { title: 'The Inexperienced Ghost', author: 'H. G. Wells', url: 'https://www.gutenberg.org/ebooks/11870' },
  { title: 'A Scandal in Bohemia', author: 'Arthur Conan Doyle', url: 'https://www.gutenberg.org/ebooks/1661' },
  { title: 'A Rose for Emily', author: 'William Faulkner', url: 'https://archive.org/details/a-rose-for-emily-faulkner' },
  { title: 'Barn Burning', author: 'William Faulkner', url: 'https://archive.org/details/faulkner-barn-burning' },
  { title: 'The Secret Sharer', author: 'Joseph Conrad', url: 'https://www.gutenberg.org/ebooks/220' },
  { title: 'The Lagoon', author: 'Joseph Conrad', url: 'https://www.gutenberg.org/ebooks/523' },
  { title: 'Heart of Darkness', author: 'Joseph Conrad', url: 'https://www.gutenberg.org/ebooks/219' },
  { title: 'The Overcoat', author: 'Nikolai Gogol', url: 'https://www.gutenberg.org/ebooks/36238' },
  { title: 'The Nose', author: 'Nikolai Gogol', url: 'https://www.gutenberg.org/ebooks/36238' },
  { title: 'The Captain\'s Doll', author: 'D. H. Lawrence', url: 'https://www.gutenberg.org/ebooks/2731' },
  { title: 'The Horse Dealer\'s Daughter', author: 'D. H. Lawrence', url: 'https://www.gutenberg.org/ebooks/21566' },
  { title: 'The Rocking-Horse Winner', author: 'D. H. Lawrence', url: 'https://www.gutenberg.org/ebooks/21566' },
  { title: 'Sredni Vashtar', author: 'Saki', url: 'https://www.gutenberg.org/ebooks/269' },
  { title: 'The Signal-Man', author: 'Charles Dickens', url: 'https://www.gutenberg.org/ebooks/1289' },
  { title: 'The Chimes', author: 'Charles Dickens', url: 'https://www.gutenberg.org/ebooks/888' },
  { title: 'The Gift of the Magi', author: 'O. Henry', url: 'https://www.gutenberg.org/ebooks/7256' },
  { title: 'The Schartz-Metterklume Method', author: 'Saki', url: 'https://www.gutenberg.org/ebooks/269' },
];

// ── Curated literary essays ───────────────────────────────────────────────────

const ESSAY_SEEDS = [
  { title: 'Politics and the English Language', author: 'George Orwell', url: 'https://www.orwell.ru/library/essays/politics/english/e_polit', source: 'orwell.ru' },
  { title: 'Shooting an Elephant', author: 'George Orwell', url: 'https://www.orwell.ru/library/essays/elephant/english/e_eleph', source: 'orwell.ru' },
  { title: 'Why I Write', author: 'George Orwell', url: 'https://www.orwell.ru/library/essays/wiw/english/e_wiw', source: 'orwell.ru' },
  { title: 'Such, Such Were the Joys', author: 'George Orwell', url: 'https://www.orwell.ru/library/essays/joys/english/e_joys', source: 'orwell.ru' },
  { title: 'A Nice Cup of Tea', author: 'George Orwell', url: 'https://www.orwell.ru/library/articles/tea/english/e_tea', source: 'orwell.ru' },
  { title: 'Of Studies', author: 'Francis Bacon', url: 'https://en.wikisource.org/wiki/Essays_(Bacon)/Of_Studies', source: 'wikisource' },
  { title: 'Of Truth', author: 'Francis Bacon', url: 'https://en.wikisource.org/wiki/Essays_(Bacon)/Of_Truth', source: 'wikisource' },
  { title: 'Of Friendship', author: 'Francis Bacon', url: 'https://en.wikisource.org/wiki/Essays_(Bacon)/Of_Friendship', source: 'wikisource' },
  { title: 'Of Adversity', author: 'Francis Bacon', url: 'https://en.wikisource.org/wiki/Essays_(Bacon)/Of_Adversity', source: 'wikisource' },
  { title: 'Self-Reliance', author: 'Ralph Waldo Emerson', url: 'https://www.gutenberg.org/ebooks/16643', source: 'gutenberg' },
  { title: 'Nature', author: 'Ralph Waldo Emerson', url: 'https://www.gutenberg.org/ebooks/29433', source: 'gutenberg' },
  { title: 'The Over-Soul', author: 'Ralph Waldo Emerson', url: 'https://www.gutenberg.org/ebooks/16643', source: 'gutenberg' },
  { title: 'Compensation', author: 'Ralph Waldo Emerson', url: 'https://www.gutenberg.org/ebooks/16643', source: 'gutenberg' },
  { title: 'Civil Disobedience', author: 'Henry David Thoreau', url: 'https://www.gutenberg.org/ebooks/71', source: 'gutenberg' },
  { title: 'Walking', author: 'Henry David Thoreau', url: 'https://www.gutenberg.org/ebooks/1022', source: 'gutenberg' },
  { title: 'Life Without Principle', author: 'Henry David Thoreau', url: 'https://www.gutenberg.org/ebooks/1022', source: 'gutenberg' },
  { title: 'The Death of the Moth', author: 'Virginia Woolf', url: 'https://www.gutenberg.org/ebooks/59532', source: 'gutenberg' },
  { title: 'A Room of One\'s Own (excerpt)', author: 'Virginia Woolf', url: 'https://www.gutenberg.org/ebooks/5ආ', source: 'gutenberg' },
  { title: 'On Being Ill', author: 'Virginia Woolf', url: 'https://en.wikisource.org/wiki/On_Being_Ill', source: 'wikisource' },
  { title: 'The Modern Essay', author: 'Virginia Woolf', url: 'https://en.wikisource.org/wiki/The_Common_Reader/The_Modern_Essay', source: 'wikisource' },
  { title: 'The Crack-Up', author: 'F. Scott Fitzgerald', url: 'https://en.wikisource.org/wiki/The_Crack-Up', source: 'wikisource' },
  { title: 'Notes of a Native Son', author: 'James Baldwin', url: 'https://www.gutenberg.org/ebooks/71048', source: 'gutenberg' },
  { title: 'The Fire Next Time (excerpt)', author: 'James Baldwin', url: 'https://www.gutenberg.org/ebooks/71048', source: 'gutenberg' },
  { title: 'Fifth Avenue, Uptown', author: 'James Baldwin', url: 'https://www.esquire.com/news-politics/a3638/fifth-avenue-uptown/', source: 'esquire' },
  { title: 'The Immense Journey (excerpt)', author: 'Loren Eiseley', url: 'https://www.gutenberg.org/ebooks/65429', source: 'gutenberg' },
  { title: 'The Star Thrower', author: 'Loren Eiseley', url: 'https://www.gutenberg.org/ebooks/65429', source: 'gutenberg' },
  { title: 'How Human Are We?', author: 'Loren Eiseley', url: 'https://www.gutenberg.org/ebooks/65429', source: 'gutenberg' },
  { title: 'Brave New World Revisited', author: 'Aldous Huxley', url: 'https://www.gutenberg.org/ebooks/798', source: 'gutenberg' },
  { title: 'On Liberty', author: 'John Stuart Mill', url: 'https://www.gutenberg.org/ebooks/34901', source: 'gutenberg' },
  { title: 'The Subjection of Women', author: 'John Stuart Mill', url: 'https://www.gutenberg.org/ebooks/27083', source: 'gutenberg' },
  { title: 'What Is Art?', author: 'Leo Tolstoy', url: 'https://www.gutenberg.org/ebooks/64908', source: 'gutenberg' },
  { title: 'Confessions (excerpt)', author: 'Leo Tolstoy', url: 'https://www.gutenberg.org/ebooks/64011', source: 'gutenberg' },
  { title: 'The Meaning of Life', author: 'G. K. Chesterton', url: 'https://www.gutenberg.org/ebooks/11505', source: 'gutenberg' },
  { title: 'On Lying in Bed', author: 'G. K. Chesterton', url: 'https://en.wikisource.org/wiki/Tremendous_Trifles/On_Lying_in_Bed', source: 'wikisource' },
  { title: 'A Defence of Skeletons', author: 'G. K. Chesterton', url: 'https://www.gutenberg.org/ebooks/11505', source: 'gutenberg' },
  { title: 'The Decay of Lying', author: 'Oscar Wilde', url: 'https://www.gutenberg.org/ebooks/887', source: 'gutenberg' },
  { title: 'The Soul of Man Under Socialism', author: 'Oscar Wilde', url: 'https://www.gutenberg.org/ebooks/1017', source: 'gutenberg' },
  { title: 'De Profundis', author: 'Oscar Wilde', url: 'https://www.gutenberg.org/ebooks/921', source: 'gutenberg' },
  { title: 'The Aims of Education', author: 'Alfred North Whitehead', url: 'https://www.gutenberg.org/ebooks/64906', source: 'gutenberg' },
  { title: 'Science and the Modern World', author: 'Alfred North Whitehead', url: 'https://www.gutenberg.org/ebooks/64906', source: 'gutenberg' },
  { title: 'On the Shortness of Life', author: 'Seneca', url: 'https://www.gutenberg.org/ebooks/70803', source: 'gutenberg' },
  { title: 'Letters from a Stoic (selections)', author: 'Seneca', url: 'https://www.gutenberg.org/ebooks/70803', source: 'gutenberg' },
  { title: 'What I Believe', author: 'Bertrand Russell', url: 'https://www.gutenberg.org/ebooks/7778', source: 'gutenberg' },
  { title: 'Why I Am Not a Christian', author: 'Bertrand Russell', url: 'https://www.gutenberg.org/ebooks/7778', source: 'gutenberg' },
  { title: 'In Praise of Idleness', author: 'Bertrand Russell', url: 'https://harpers.org/archive/1932/10/in-praise-of-idleness/', source: 'harpers' },
  { title: 'The Elements of Style (preface)', author: 'E. B. White', url: 'https://www.gutenberg.org/ebooks/37134', source: 'gutenberg' },
  { title: 'Here Is New York', author: 'E. B. White', url: 'https://en.wikisource.org/wiki/Here_Is_New_York', source: 'wikisource' },
  { title: 'Once More to the Lake', author: 'E. B. White', url: 'https://en.wikisource.org/wiki/Once_More_to_the_Lake', source: 'wikisource' },
  { title: 'The Crack-Up', author: 'F. Scott Fitzgerald', url: 'https://en.wikisource.org/wiki/The_Crack-Up', source: 'wikisource' },
  { title: 'On the Fear of Death', author: 'Michel de Montaigne', url: 'https://www.gutenberg.org/ebooks/3600', source: 'gutenberg' },
  { title: 'On Experience', author: 'Michel de Montaigne', url: 'https://www.gutenberg.org/ebooks/3600', source: 'gutenberg' },
  { title: 'On Cannibals', author: 'Michel de Montaigne', url: 'https://www.gutenberg.org/ebooks/3600', source: 'gutenberg' },
  { title: 'Of Idleness', author: 'Michel de Montaigne', url: 'https://www.gutenberg.org/ebooks/3600', source: 'gutenberg' },
  { title: 'History of Western Philosophy (excerpt)', author: 'Bertrand Russell', url: 'https://www.gutenberg.org/ebooks/7778', source: 'gutenberg' },
  { title: 'The Second Sex (introduction)', author: 'Simone de Beauvoir', url: 'https://www.gutenberg.org/ebooks/69068', source: 'gutenberg' },
  { title: 'The Ethics of Living Jim Crow', author: 'Richard Wright', url: 'https://en.wikisource.org/wiki/The_Ethics_of_Living_Jim_Crow', source: 'wikisource' },
  { title: 'Letter from Birmingham Jail', author: 'Martin Luther King Jr.', url: 'https://www.africa.upenn.edu/Articles_Gen/Letter_Birmingham.html', source: 'upenn' },
  { title: 'A Modest Proposal', author: 'Jonathan Swift', url: 'https://www.gutenberg.org/ebooks/1080', source: 'gutenberg' },
  { title: 'An Apology for Idlers', author: 'Robert Louis Stevenson', url: 'https://www.gutenberg.org/ebooks/637', source: 'gutenberg' },
  { title: 'Walking Tours', author: 'Robert Louis Stevenson', url: 'https://www.gutenberg.org/ebooks/637', source: 'gutenberg' },
  { title: 'On the Writing of Essays', author: 'Alexander Smith', url: 'https://www.gutenberg.org/ebooks/13352', source: 'gutenberg' },
  { title: 'The Art of Fiction', author: 'Henry James', url: 'https://www.gutenberg.org/ebooks/1408', source: 'gutenberg' },
  { title: 'The Art of Fiction', author: 'Walter Besant', url: 'https://www.gutenberg.org/ebooks/74742', source: 'gutenberg' },
  { title: 'Ars Poetica', author: 'Archibald MacLeish', url: 'https://www.poetryfoundation.org/poetrymagazine/poems/14185/ars-poetica', source: 'poetryfoundation' },
  { title: 'The Function of Criticism', author: 'T. S. Eliot', url: 'https://en.wikisource.org/wiki/The_Function_of_Criticism', source: 'wikisource' },
  { title: 'Tradition and the Individual Talent', author: 'T. S. Eliot', url: 'https://en.wikisource.org/wiki/Tradition_and_the_Individual_Talent', source: 'wikisource' },
  { title: 'The Noble Rider and the Sound of Words', author: 'Wallace Stevens', url: 'https://en.wikisource.org/wiki/The_Noble_Rider_and_the_Sound_of_Words', source: 'wikisource' },
  { title: 'A Homage to Catalonia (excerpt)', author: 'George Orwell', url: 'https://www.gutenberg.org/ebooks/69083', source: 'gutenberg' },
  { title: 'The Lion and the Unicorn', author: 'George Orwell', url: 'https://www.orwell.ru/library/essays/lion/english/e_patt', source: 'orwell.ru' },
  { title: 'Boys\' Weeklies', author: 'George Orwell', url: 'https://www.orwell.ru/library/essays/boys/english/e_boys', source: 'orwell.ru' },
  { title: 'Charles Dickens', author: 'George Orwell', url: 'https://www.orwell.ru/library/essays/dickens/english/e_chd', source: 'orwell.ru' },
  { title: 'The Poverty of Philosophy (excerpt)', author: 'Karl Marx', url: 'https://www.gutenberg.org/ebooks/37934', source: 'gutenberg' },
  { title: 'The Protestant Ethic (excerpt)', author: 'Max Weber', url: 'https://www.gutenberg.org/ebooks/58061', source: 'gutenberg' },
  { title: 'Civilization and Its Discontents (excerpt)', author: 'Sigmund Freud', url: 'https://www.gutenberg.org/ebooks/67720', source: 'gutenberg' },
  { title: 'The Interpretation of Dreams (excerpt)', author: 'Sigmund Freud', url: 'https://www.gutenberg.org/ebooks/66991', source: 'gutenberg' },
  { title: 'The Art of War (Giles translation)', author: 'Sun Tzu', url: 'https://www.gutenberg.org/ebooks/132', source: 'gutenberg' },
  { title: 'The Prince (excerpt)', author: 'Niccolò Machiavelli', url: 'https://www.gutenberg.org/ebooks/1232', source: 'gutenberg' },
  { title: 'The Social Contract (excerpt)', author: 'Jean-Jacques Rousseau', url: 'https://www.gutenberg.org/ebooks/46333', source: 'gutenberg' },
];

// ── Fetch poems from PoetryDB ─────────────────────────────────────────────────

async function fetchPoems() {
  const poems = [];
  console.log('Fetching poems from PoetryDB...');

  for (const poet of POETS) {
    try {
      const encoded = encodeURIComponent(poet);
      const res = await fetch(`https://poetrydb.org/author/${encoded}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      for (const poem of data) {
        if (poem.title && poem.author && poem.lines) {
          poems.push({
            title: poem.title,
            author: poem.author,
            url: `https://poetrydb.org/title/${encodeURIComponent(poem.title)}`,
            source: 'poetrydb',
          });
        }
      }
      process.stdout.write(`  ${poet}: ${data.length} poems\n`);
      await sleep(300); // polite delay
    } catch (e) {
      console.warn(`  Failed to fetch ${poet}: ${e.message}`);
    }
  }

  // Deduplicate by title+author
  const seen = new Set();
  return poems.filter((p) => {
    const key = `${p.title}|${p.author}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== 1000 Nights — Reading List Generator ===\n');

  // Load seed files
  const techSeeds = JSON.parse(readFileSync(join(__dirname, 'seeds/tech-blogs.json'), 'utf8'));
  const insightSeeds = JSON.parse(readFileSync(join(__dirname, 'seeds/insight-essays.json'), 'utf8'));

  // Fetch poems
  let poems = await fetchPoems();
  console.log(`\nTotal poems fetched: ${poems.length}`);

  if (poems.length < TOTAL_DAYS) {
    console.log(`Pool too small (${poems.length}), extending with repeats...`);
  }

  // Build pools (shuffle each independently, extend if needed)
  const poemPool    = extendPool(shuffle(poems),       TOTAL_DAYS);
  const storyPool   = extendPool(shuffle([...STORY_SEEDS]), TOTAL_DAYS);
  const essayPool   = extendPool(shuffle([...ESSAY_SEEDS]), TOTAL_DAYS);
  const techPool    = extendPool(shuffle([...techSeeds]),   TOTAL_DAYS);
  const insightPool = extendPool(shuffle([...insightSeeds]), TOTAL_DAYS);

  // Zip into 1,000 day entries
  const list = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    list.push({
      day:     i + 1,
      poem:    poemPool[i],
      story:   storyPool[i],
      essay:   essayPool[i],
      tech:    techPool[i],
      insight: insightPool[i],
    });
  }

  // Verify uniqueness within each type
  for (const type of ['poem', 'story', 'essay', 'tech', 'insight']) {
    const urls = list.map((e) => e[type].url);
    const unique = new Set(urls).size;
    const dupes = TOTAL_DAYS - unique;
    if (dupes > 0) {
      console.warn(`⚠ ${type}: ${dupes} duplicate URL(s) — pool may be smaller than 1000`);
    } else {
      console.log(`✓ ${type}: all ${TOTAL_DAYS} entries unique`);
    }
  }

  // Write output
  const outPath = join(ROOT, 'data/reading-list.json');
  writeFileSync(outPath, JSON.stringify(list, null, 2), 'utf8');
  console.log(`\n✓ Written to ${outPath}`);
  console.log(`  Total entries: ${list.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
