export type TrackCondition = 'fast' | 'good' | 'sloppy' | 'muddy';
export type PaceScenario = 'slow' | 'honest' | 'fast';
export type RunningStyle = 'E' | 'E/P' | 'P' | 'S';

export type SilkPattern =
  | 'solid'
  | 'diamonds'
  | 'stripes'
  | 'quartered'
  | 'chevrons'
  | 'hoops';

export interface Silk {
  pattern: SilkPattern;
  primary: string;
  secondary: string;
}

export interface Horse {
  id: string;
  name: string;
  post_position: number;
  jockey?: string | null;
  trainer?: string | null;
  morning_line?: string | null;
  beyer_last_3: number[];
  running_style: RunningStyle;
  distance_aptitude: number;
  class_rating: number;
  surface_aptitude_dirt: number;
  surface_aptitude_wet?: number | null;
  pace_figure_avg: number;
  silk?: Silk | null;
}

export interface FieldFile {
  meta: {
    race: string;
    date: string;
    distance?: string;
    surface?: string;
    note?: string;
    updated?: string;
  };
  horses: Horse[];
}

export interface Scenario {
  track: TrackCondition;
  pace: PaceScenario;
  beliefs: Record<string, number>;
  iterations?: number;
  seed?: number | null;
}

export interface HorseResult {
  id: string;
  name: string;
  post_position: number;
  p_win: number;
  p_top3: number;
  p_top4: number;
  mean_finish: number;
  finish_histogram: number[];
}

export interface SimResponse {
  results: HorseResult[];
  scenario: Scenario;
  iterations: number;
  elapsed_ms: number;
  field_size: number;
}

export interface ResultFile {
  meta: {
    race: string;
    date: string;
    track?: string | null;
    pace?: string | null;
    final_time?: string | null;
    status: 'pending' | 'official';
    note?: string;
  };
  finish_order: { position: number; horse_id: string }[];
}
