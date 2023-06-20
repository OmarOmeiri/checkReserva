import type { Dayjs } from 'dayjs'

export interface ReservaRaw {
  id:               string;
  resourceId:       string;
  rendering?:       string;
  start:            string;
  end:              string;
  title?:           string;
  description?:     string;
  backgroundColor?: ReservaBG;
  borderColor?:     string;
  textColor?:       string;
  idRes?:           string;
}

export interface ReservaParsed {
  start: Dayjs;
  end: Dayjs;
  resId: string;
  desc?: string,
  free?: true;
}

export enum ReservaBG {
  check = "#ffbb33",
  sim = "#007E33",
  tgl = "#0099CC",
  solo = "#00C851",
  r595 = "#33b5e5",
}

export interface IResources {
  id: string,
  title: string
}