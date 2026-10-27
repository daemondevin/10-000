// Farkle scoring shared by the server (require) and the browser (window.FarkleScoring).
// Melds follow the rules page: 1 = 100, 5 = 50, three of a kind = face x 100 (three 1s = 1000),
// four of a kind = 1000, five = 2000, six = 3000, three pairs = 1500, run 1 to 6 = 2500.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FarkleScoring = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function kindScore(face, count) {
    if (count === 3) return face === 1 ? 1000 : face * 100;
    if (count === 4) return 1000;
    if (count === 5) return 2000;
    if (count === 6) return 3000;
    return 0;
  }

  function countFaces(values) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(function (v) {
      if (v >= 1 && v <= 6) counts[v]++;
    });
    return counts;
  }

  // Best score that uses every die in counts, or -1 when some die cannot be part of a meld
  const memo = new Map();
  function bestUsingAll(counts) {
    const key = counts.join("");
    if (memo.has(key)) return memo.get(key);

    let face = -1;
    for (let i = 1; i <= 6; i++) {
      if (counts[i] > 0) {
        face = i;
        break;
      }
    }

    let best;
    if (face === -1) {
      best = 0;
    } else {
      best = -1;
      const c = counts[face];
      if (face === 1 || face === 5) {
        const rest = counts.slice();
        rest[face] -= 1;
        const r = bestUsingAll(rest);
        if (r >= 0) best = Math.max(best, r + (face === 1 ? 100 : 50));
      }
      for (let k = 3; k <= c; k++) {
        const rest = counts.slice();
        rest[face] -= k;
        const r = bestUsingAll(rest);
        if (r >= 0) best = Math.max(best, r + kindScore(face, k));
      }
    }
    memo.set(key, best);
    return best;
  }

  // Score for a set of kept dice. Returns 0 when any die in the set does not score.
  function scoreSelection(values) {
    if (!Array.isArray(values) || values.length === 0 || values.length > 6) return 0;
    if (!values.every(function (v) { return Number.isInteger(v) && v >= 1 && v <= 6; })) return 0;

    const counts = countFaces(values);
    let best = bestUsingAll(counts);

    if (values.length === 6) {
      const faces = counts.slice(1);
      if (faces.every(function (c) { return c === 1; })) best = Math.max(best, 2500);
      if (faces.every(function (c) { return c === 0 || c === 2 || c === 4; })) best = Math.max(best, 1500);
    }
    return Math.max(best, 0);
  }

  // True when at least one scoring meld exists among the thrown dice
  function hasScoringDice(values) {
    const counts = countFaces(values);
    if (counts[1] > 0 || counts[5] > 0) return true;
    if (counts.some(function (c) { return c >= 3; })) return true;
    return scoreSelection(values) > 0;
  }

  return { scoreSelection: scoreSelection, hasScoringDice: hasScoringDice };
});
