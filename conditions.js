// Verified against SRD 5.2 (2025), which reflects the 2024 rules. These are concise summaries for quick play.
const CONDITIONS = [
  {
    name: 'Blinded',
    summary: 'You can’t see; attacks against you have Advantage; your attacks have Disadvantage.',
    tags: ['attack','perception','checks'],
    effects: [
      "You can’t see and automatically fail ability checks that require sight.",
      "Attack rolls against you have Advantage.",
      "Your attack rolls have Disadvantage."
    ]
  },
  {
    name: 'Charmed',
    summary: 'Can’t attack the charmer; they have Advantage on social checks with you.',
    tags: ['checks'],
    effects: [
      "You can’t attack the charmer or target the charmer with damaging abilities or magical effects.",
      "The charmer has Advantage on Charisma checks to interact with you socially."
    ]
  },
  {
    name: 'Deafened',
    summary: 'You can’t hear; auto‑fail hearing checks.',
    tags: ['perception','checks'],
    effects: [
      "You can’t hear and automatically fail ability checks that require hearing."
    ]
  },
  {
    name: 'Exhaustion',
    summary: 'Cumulative levels (die at 6): −2 × level to d20 tests; −5 ft × level to Speed; −1 level on a Long Rest.',
    tags: ['attack','checks','saves','movement'],
    effects: [
      "This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die at level 6.",
      "D20 Tests Affected: subtract 2 × your Exhaustion level from ability checks, attack rolls, and saving throws.",
      "Speed Reduced: reduce your Speed by 5 feet × your Exhaustion level.",
      "Finishing a Long Rest removes 1 Exhaustion level. When your level reaches 0, the condition ends."
    ]
  },
  {
    name: 'Frightened',
    summary: 'Disadvantage on checks and attacks while the source is in sight; can’t willingly move closer.',
    tags: ['attack','checks','movement'],
    effects: [
      "You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.",
      "You can’t willingly move closer to the source of fear."
    ]
  },
  {
    name: 'Grappled',
    summary: 'Speed 0; Disadvantage on attacks against targets other than the grappler; the grappler can drag you.',
    tags: ['movement','attack'],
    effects: [
      "Your Speed is 0 and can’t increase.",
      "You have Disadvantage on attack rolls against any target other than the grappler.",
      "The grappler can move you when it moves, but each foot of its movement costs 1 extra foot unless you are Tiny or 2+ sizes smaller than it."
    ]
  },
  {
    name: 'Incapacitated',
    summary: 'You can’t take actions, Bonus Actions, or Reactions; Concentration ends; you can’t speak.',
    tags: ['attack','checks'],
    effects: [
      "You can’t take any action, Bonus Action, or Reaction.",
      "Your Concentration is broken.",
      "You can’t speak.",
      "If you’re Incapacitated when you roll Initiative, you have Disadvantage on the roll."
    ]
  },
  {
    name: 'Invisible',
    summary: 'Can’t be seen; attackers have Disadvantage; your attacks have Advantage; Advantage on Initiative when you roll while Invisible.',
    tags: ['attack','perception','checks'],
    effects: [
      "If you’re Invisible when you roll Initiative, you have Advantage on the roll.",
      "You aren’t affected by any effect that requires its target to be seen unless the effect’s creator can see you.",
      "Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can see you, you don’t gain this benefit against that creature."
    ]
  },
  {
    name: 'Paralyzed',
    summary: 'Incapacitated; Speed 0; auto‑fail Str/Dex saves; attacks against you have Advantage; melee hits auto‑crit.',
    tags: ['attack','saves','movement'],
    effects: [
      "You have the Incapacitated condition.",
      "Your Speed is 0 and can’t increase.",
      "You automatically fail Strength and Dexterity saving throws.",
      "Attack rolls against you have Advantage.",
      "Any attack that hits you is a Critical Hit if the attacker is within 5 feet of you."
    ]
  },
  {
    name: 'Petrified',
    summary: 'Turned to solid substance; Incapacitated; Speed 0; auto‑fail Str/Dex saves; Resist all damage; Immune to Poison.',
    tags: ['attack','saves','movement'],
    effects: [
      "You and your worn and carried nonmagical objects turn into a solid inanimate substance (usually stone), your weight increases tenfold, and you cease aging.",
      "You have the Incapacitated condition.",
      "Your Speed is 0 and can’t increase.",
      "Attack rolls against you have Advantage.",
      "You automatically fail Strength and Dexterity saving throws.",
      "You have Resistance to all damage.",
      "You have Immunity to the Poisoned condition."
    ]
  },
  {
    name: 'Poisoned',
    summary: 'Disadvantage on attack rolls and ability checks.',
    tags: ['attack','checks'],
    effects: [
      "You have Disadvantage on attack rolls and ability checks."
    ]
  },
  {
    name: 'Prone',
    summary: 'Stand by spending movement; attackers within 5 ft have Advantage; other attacks against you have Disadvantage; your ranged attacks are Disadvantaged.',
    tags: ['attack','movement'],
    effects: [
      "Your only movement options are to crawl or spend movement equal to half your Speed (round down) to stand. If your Speed is 0, you can’t stand.",
      "Attack rolls against you have Advantage if the attacker is within 5 feet of you; otherwise those rolls have Disadvantage.",
      "Your attack rolls have Disadvantage."
    ]
  },
  {
    name: 'Restrained',
    summary: 'Speed 0; attacks against you have Advantage; your attacks have Disadvantage; Disadvantage on Dex saves.',
    tags: ['attack','movement','saves'],
    effects: [
      "Your Speed is 0 and can’t increase.",
      "Attack rolls against you have Advantage, and your attack rolls have Disadvantage.",
      "You have Disadvantage on Dexterity saving throws."
    ]
  },
  {
    name: 'Stunned',
    summary: 'Incapacitated; auto‑fail Str/Dex saves; attacks against you have Advantage.',
    tags: ['attack','saves'],
    effects: [
      "You have the Incapacitated condition.",
      "You automatically fail Strength and Dexterity saving throws.",
      "Attack rolls against you have Advantage."
    ]
  },
  {
    name: 'Unconscious',
    summary: 'Incapacitated and Prone; Speed 0; auto‑fail Str/Dex saves; attackers have Advantage; melee hits auto‑crit; you’re unaware.',
    tags: ['attack','saves','movement','perception'],
    effects: [
      "You have the Incapacitated and Prone conditions, and you drop whatever you’re holding.",
      "Your Speed is 0 and can’t increase.",
      "Attack rolls against you have Advantage.",
      "You automatically fail Strength and Dexterity saving throws.",
      "Any attack that hits you is a Critical Hit if the attacker is within 5 feet of you.",
      "You’re unaware of your surroundings."
    ]
  }
];
