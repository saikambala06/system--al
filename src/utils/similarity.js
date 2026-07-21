// Bigram Dice coefficient: compares two strings by the character
// bigrams they share. Good at tolerating small wording differences
// between how two different ATS platforms phrase "the same" question,
// while staying strict enough not to confuse two unrelated questions
// that merely share common words like "what is your".

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBigrams(str) {
  const s = normalize(str);
  const bigrams = [];
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.push(s.substring(i, i + 2));
  }
  return bigrams;
}

function diceCoefficient(strA, strB) {
  const a = getBigrams(strA);
  const b = getBigrams(strB);

  if (a.length === 0 || b.length === 0) {
    return normalize(strA) === normalize(strB) ? 1 : 0;
  }

  const bCopy = b.slice();
  let matches = 0;

  for (const bigram of a) {
    const idx = bCopy.indexOf(bigram);
    if (idx !== -1) {
      matches++;
      bCopy.splice(idx, 1);
    }
  }

  return (2 * matches) / (a.length + b.length);
}

function findBestMatch(query, candidates, key = 'question') {
  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = diceCoefficient(query, candidate[key]);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return { match: best, score: bestScore };
}

module.exports = { diceCoefficient, findBestMatch, normalize };
