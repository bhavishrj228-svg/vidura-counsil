// public/quotes.js
// Statements paraphrased from Vidura Niti (Udyoga Parva / Prajagara Parva),
// based on Kisari Mohan Ganguli's public-domain translation. These are
// paraphrased for clarity, not verbatim quotations -- cite the original
// translation (sacred-texts.com, Udyoga Parva, Sections XXXIII-XL) if you
// need exact textual wording for your project report.

const VIDURA_QUOTES = {
  unverified: {
    text: "Do not yet accept this warning as settled; examine it carefully before you act.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
  disputed: {
    text: "You have heard opposing signs; let neither the crowd nor suspicion alone command your trust.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
  confirmed: {
    text: "The testimony and the independent signs agree: heed this warning, and do not send what is asked.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
  verified_legit: {
    text: "The testimony and the evidence both counsel trust; still, share no secret you would not share openly.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
  pending: {
    text: "Let the matter be examined before judgment is spoken; haste can make the careful pay dearly.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
};

// Fallback used if a status somehow has no matching quote above.
const DEFAULT_QUOTE = {
  text: "Examine the matter from every side before you lend it your trust.",
  citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
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
  citation: "Inspired by the Prajagara Parva, Udyoga Parva, trans. K. M. Ganguli, Sections XXXIII-XL",
};

// A rotating pool of shorter lines used in the header/footer/sections so the
// Mahabharata connection is visible on every page, not just the report modal.
const VIDURA_GENERAL_QUOTES = [
  {
    text: "Examine the matter from every side before you place your trust in it.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
  {
    text: "Do not act in haste; the cost of a careless choice may return to you.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
  {
    text: "Speak what is true, even when a pleasing falsehood would be easier.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
  {
    text: "Take warning while there is time to act; regret cannot undo a danger ignored.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
  {
    text: "Let neither praise nor the crowd's applause decide what you know to be true.",
    citation: "Adapted from Vidura Niti, Udyoga Parva, Prajagara Parva, Sections XXXIII-XL, trans. K. M. Ganguli",
  },
];

function getRandomGeneralQuote() {
  return VIDURA_GENERAL_QUOTES[Math.floor(Math.random() * VIDURA_GENERAL_QUOTES.length)];
}
