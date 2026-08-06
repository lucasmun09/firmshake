import {
  shieldCheckmarkOutline,
  storefrontOutline,
  walletOutline,
} from 'ionicons/icons';

export const LANDING_CARDS = [
  {
    icon: storefrontOutline,
    title: 'Community marketplace',
    body:
      'FirmShake is a community-focused marketplace built around FirmShakes — trusted meetups between buyers and sellers in your communities.',
  },
  {
    icon: shieldCheckmarkOutline,
    title: 'Bounded FirmShakes',
    body:
      'Every FirmShake bounds the meetup, price, and agreement so both sides know exactly what they are committing to before they meet.',
  },
  {
    icon: walletOutline,
    title: 'Deposits with protection',
    body:
      'Users put deposits down to secure a FirmShake. If a FirmShake is broken, the offended party receives 50% of the deposit as compensation.',
  },
] as const;
