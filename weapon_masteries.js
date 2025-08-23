// 2024 Player’s Handbook — Weapon Mastery properties (concise quick‑reference)
// Sources summarized: D&D Beyond + Roll20 Free Basic Rules (2024).
const WEAPON_MASTERIES = [
  {
    name: 'Cleave',
    summary: 'After you hit a creature with a melee attack, make a second attack roll against a different creature within 5 ft of the first. On a hit, deal the weapon’s damage dice (no ability mod).',
    tags: ['melee','multitarget'],
    effects: [
      'Trigger: You hit with a Melee Weapon Attack.',
      'Target: A different creature you can see within 5 feet of the first target.',
      'Effect: Make another melee attack roll against the second creature. On a hit, it takes damage equal to the weapon’s damage (no ability modifier added to the damage).'
    ]
  },
  {
    name: 'Graze',
    summary: 'When you miss with an attack, the target still takes damage equal to the ability modifier you used for the attack.',
    tags: ['reliable','on-miss'],
    effects: [
      'Trigger: You miss with the weapon’s attack roll.',
      'Effect: The target takes damage equal to the ability modifier used for the attack (for example, Strength for a melee weapon).'
    ]
  },
  {
    name: 'Nick',
    summary: 'When you take the Attack action and attack with a Light weapon in one hand, you can make one extra attack with a Light weapon in the other hand as part of the same action (no Bonus Action needed).',
    tags: ['action-economy','two-weapon'],
    effects: [
      'Requirement: You are wielding a Light weapon in each hand.',
      'Effect: As part of the Attack action, make one additional attack with the other Light weapon. This doesn’t use your Bonus Action.'
    ]
  },
  {
    name: 'Push',
    summary: 'On a hit, you can push the target up to 10 feet away from you in a straight line.',
    tags: ['control','movement'],
    effects: [
      'Trigger: You hit a creature (typically Large or smaller).',
      'Effect: You can push it up to 10 feet away from you in a straight line.'
    ]
  },
  {
    name: 'Sap',
    summary: 'On a hit, the target has Disadvantage on the next attack roll it makes before the start of your next turn.',
    tags: ['debuff','defense'],
    effects: [
      'Trigger: You hit a creature.',
      'Effect: Until the start of your next turn, the target has Disadvantage on the next attack roll it makes.'
    ]
  },
  {
    name: 'Slow',
    summary: 'On a hit (and you deal damage), the target’s Speed is reduced by 10 feet until the start of your next turn.',
    tags: ['control','movement'],
    effects: [
      'Trigger: You hit and deal damage to a creature.',
      'Effect: Reduce the target’s Speed by 10 feet until the start of your next turn.'
    ]
  },
  {
    name: 'Topple',
    summary: 'On a hit, the target must succeed on a Constitution save (vs. your Mastery DC) or fall Prone.',
    tags: ['control','prone','save'],
    effects: [
      'Trigger: You hit a creature.',
      'Effect: The target makes a Constitution saving throw against your Mastery DC. On a failure, it falls Prone.'
    ]
  },
  {
    name: 'Vex',
    summary: 'On a hit, you have Advantage on your next attack roll against that target before the end of your next turn.',
    tags: ['advantage','setup'],
    effects: [
      'Trigger: You hit a creature.',
      'Effect: You have Advantage on the next attack roll you make against that creature before the end of your next turn.'
    ]
  }
];
