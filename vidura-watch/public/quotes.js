// public/quotes.js
// Statements paraphrased from Vidura Niti (Udyoga Parva / Prajagara Parva),
// based on Kisari Mohan Ganguli's public-domain translation. These are
// paraphrased for clarity, not verbatim quotations -- cite the original
// translation (sacred-texts.com, Udyoga Parva, Sections XXXIII-XL) if you
// need exact textual wording for your project report.

const VIDURA_QUOTES = {
  unverified: {
    text: "One should weigh carefully whether a thing can truly be relied upon before accepting it as one's own.",
    citation: "Adapted from Vidura Niti, Udyoga Parva (Prajagara Parva), Ch. 34",
  },
  disputed: {
    text: "Agreement among many is not by itself proof. What is claimed must still be tested against what can be verified.",
    citation: "Adapted from Vidura Niti, Udyoga Parva (Prajagara Parva), Ch. 34",
  },
  confirmed: {
    text: "When testimony and evidence together point the same way, the warning may be trusted and acted upon.",
    citation: "Adapted from the reasoning of Vidura Niti, Udyoga Parva",
  },
  verified_legit: {
    text: "The wise, having examined a matter carefully and from every side, need not fear it any longer.",
    citation: "Adapted from Vidura Niti, Udyoga Parva (Prajagara Parva)",
  },
  pending: {
    text: "Let the matter first be examined; judgment given in haste is judgment given carelessly.",
    citation: "Adapted from Vidura Niti, Udyoga Parva (Prajagara Parva)",
  },
};

// Fallback used if a status somehow has no matching quote above.
const DEFAULT_QUOTE = {
  text: "A person is known as wise not by what they claim, but by how carefully they examine before they speak.",
  citation: "Adapted from Vidura Niti, Udyoga Parva (Prajagara Parva)",
};

function getViduraQuote(status) {
  return VIDURA_QUOTES[status] || DEFAULT_QUOTE;
}

// Longer introductory passage for the login/welcome screen.
const VIDURA_INTRO = {
  text:
    "In the Udyoga Parva, when Hastinapura stood on the edge of war, it was Vidura whose " +
    "counsel Dhritarashtra sought through sleepless nights — not because Vidura spoke the " +
    "loudest, but because his judgment had, again and again, proven sound. He warned of danger " +
    "before it arrived, and weighed every claim carefully before trusting it. This site is built " +
    "on that same discipline: no warning here is trusted simply because many voices repeat it. " +
    "It must also be tested against evidence, exactly as Vidura himself counselled.",
  citation: "Inspired by Vidura Niti, Udyoga Parva (Prajagara Parva), Mahābhārata",
};

// A rotating pool of shorter lines used in the header/footer/sections so the
// Mahabharata connection is visible on every page, not just the report modal.
const VIDURA_GENERAL_QUOTES = [
  {
    text: "The learned examine a matter carefully and from every side before placing their trust in it.",
    citation: "Adapted from Vidura Niti, Udyoga Parva",
  },
  {
    text: "A wrong done in haste returns, in the end, upon the one who was hasty.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Ch. 34",
  },
  {
    text: "One who speaks only what is asked, and only what is true, is counted among the wise.",
    citation: "Adapted from Vidura Niti, Udyoga Parva",
  },
  {
    text: "Forewarned counsel, given in time, has saved kingdoms that force alone could not.",
    citation: "Adapted from the spirit of Vidura's counsel, Udyoga Parva",
  },
  {
    text: "Neither praise nor the crowd's applause should move one who seeks the truth of a matter.",
    citation: "Adapted from Vidura Niti, Udyoga Parva",
  },
];

function getRandomGeneralQuote() {
  return VIDURA_GENERAL_QUOTES[Math.floor(Math.random() * VIDURA_GENERAL_QUOTES.length)];
}
