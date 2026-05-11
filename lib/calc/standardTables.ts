export interface PipeSize {
  dn: string;
  inner: number;
  outer: number;
}

export const DIN_TABLE: PipeSize[] = [
  { dn: 'DN25',  inner: 26,   outer: 28    },
  { dn: 'DN32',  inner: 32,   outer: 34    },
  { dn: 'DN40',  inner: 38,   outer: 40    },
  { dn: 'DN50',  inner: 50,   outer: 52    },
  { dn: 'DN65',  inner: 66,   outer: 70    },
  { dn: 'DN80',  inner: 81,   outer: 85    },
  { dn: 'DN100', inner: 100,  outer: 104   },
];

export const SMS_TABLE: PipeSize[] = [
  { dn: '25 SMS (1")',      inner: 23.4, outer: 25.4  },
  { dn: '38 SMS (1"1/2)',   inner: 36,   outer: 38    },
  { dn: '51 SMS (2")',      inner: 48.5, outer: 51    },
  { dn: '63 SMS (2"1/2)',   inner: 60.5, outer: 63.5  },
  { dn: '76 SMS (3")',      inner: 73,   outer: 76.2  },
  { dn: '101,6 SMS (4")',   inner: 97.6, outer: 101.6 },
];
